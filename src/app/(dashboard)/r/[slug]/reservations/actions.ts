"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
import { zonedDateTimeToUtc } from "@/lib/reservation-dates";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { syncContactToGhl } from "@/lib/ghl-sync";
import { Prisma, type ReservationStatus } from "@/generated/prisma/client";

export type ReservationInput = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  specialRequests: string;
  tableId: string | null;
  status?: ReservationStatus;
};

export type ReservationActionResult = { ok: true } | { ok: false; error: string };

export async function createReservationAction(
  slug: string,
  input: ReservationInput
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const startsAt = zonedDateTimeToUtc(input.date, input.time, restaurant.timezone);

  if (input.tableId) {
    const conflict = await hasTableConflict(input.tableId, startsAt, input.durationMinutes, restaurant.timezone);
    if (conflict) return { ok: false, error: "That table is already booked for an overlapping time." };
  }

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail || null,
    phone: input.guestPhone || null,
  });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId: input.tableId,
      partySize: input.partySize,
      startsAt,
      durationMinutes: input.durationMinutes,
      specialRequests: input.specialRequests || null,
    },
  });

  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      startsAt,
      partySize: input.partySize,
      restaurantName: restaurant.name,
      timeZone: restaurant.timezone,
    }
  );

  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/customers`);
  return { ok: true };
}

export async function updateReservationAction(
  slug: string,
  reservationId: string,
  input: ReservationInput
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const current = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId: restaurant.id },
    select: { customerId: true },
  });
  if (!current) return { ok: false, error: "Reservation not found." };

  const startsAt = zonedDateTimeToUtc(input.date, input.time, restaurant.timezone);

  if (input.tableId) {
    const conflict = await hasTableConflict(
      input.tableId,
      startsAt,
      input.durationMinutes,
      restaurant.timezone,
      reservationId
    );
    if (conflict) return { ok: false, error: "That table is already booked for an overlapping time." };
  }

  const customer = await findOrCreateCustomer(
    restaurant.id,
    {
      name: input.guestName,
      email: input.guestEmail || null,
      phone: input.guestPhone || null,
    },
    current.customerId
  );

  const { count } = await prisma.reservation.updateMany({
    where: { id: reservationId, restaurantId: restaurant.id },
    data: {
      customerId: customer.id,
      tableId: input.tableId,
      partySize: input.partySize,
      startsAt,
      durationMinutes: input.durationMinutes,
      specialRequests: input.specialRequests || null,
      status: input.status,
    },
  });
  if (count === 0) return { ok: false, error: "Reservation not found." };

  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/customers`);
  return { ok: true };
}

export async function deleteReservationAction(
  slug: string,
  reservationId: string
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.reservation.deleteMany({
    where: { id: reservationId, restaurantId: restaurant.id },
  });
  if (count === 0) return { ok: false, error: "Reservation not found." };

  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/customers`);
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}

export async function setReservationStatusAction(
  slug: string,
  reservationId: string,
  status: ReservationStatus
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.reservation.updateMany({
    where: { id: reservationId, restaurantId: restaurant.id },
    data: { status },
  });
  if (count === 0) return { ok: false, error: "Reservation not found." };
  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/customers`);
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}

export async function createTableAction(
  slug: string,
  input: { number: string; capacity: number; area: string; floorId: string }
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  try {
    await prisma.table.create({
      data: {
        restaurantId: restaurant.id,
        floorId: input.floorId,
        number: input.number,
        capacity: input.capacity,
        area: input.area || null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `Table "${input.number}" already exists.` };
    }
    throw e;
  }
  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}

export async function updateTableAction(
  slug: string,
  tableId: string,
  input: { number: string; capacity: number; area: string; floorId: string }
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  try {
    const { count } = await prisma.table.updateMany({
      where: { id: tableId, restaurantId: restaurant.id },
      data: {
        number: input.number,
        capacity: input.capacity,
        area: input.area || null,
        floorId: input.floorId,
      },
    });
    if (count === 0) return { ok: false, error: "Table not found." };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `Table "${input.number}" already exists.` };
    }
    throw e;
  }
  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}

// Reservation.tableId is optional, so Prisma's default FK action here is
// SetNull, not Restrict -- deleting a table unassigns it from any
// reservations rather than blocking. That's the desired behavior: nothing
// about the reservation is lost, it just needs a new table.
export async function deleteTableAction(slug: string, tableId: string): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.table.deleteMany({
    where: { id: tableId, restaurantId: restaurant.id },
  });
  if (count === 0) return { ok: false, error: "Table not found." };
  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}
