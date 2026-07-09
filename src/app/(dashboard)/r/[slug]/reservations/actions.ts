"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
import { assertRestaurantMember } from "@/lib/auth-guards";
import type { ReservationStatus } from "@/generated/prisma/client";

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
  const startsAt = new Date(`${input.date}T${input.time}`);

  if (input.tableId) {
    const conflict = await hasTableConflict(input.tableId, startsAt, input.durationMinutes);
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
  const startsAt = new Date(`${input.date}T${input.time}`);

  if (input.tableId) {
    const conflict = await hasTableConflict(input.tableId, startsAt, input.durationMinutes, reservationId);
    if (conflict) return { ok: false, error: "That table is already booked for an overlapping time." };
  }

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail || null,
    phone: input.guestPhone || null,
  });

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

export async function createTableAction(
  slug: string,
  input: { number: string; capacity: number; area: string }
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  await prisma.table.create({
    data: {
      restaurantId: restaurant.id,
      number: input.number,
      capacity: input.capacity,
      area: input.area || null,
    },
  });
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}
