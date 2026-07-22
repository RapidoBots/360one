"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { getAvailableSlots } from "@/lib/widget-availability";
import { getHoursForDay } from "@/lib/business-hours";
import { findOrCreateCustomer } from "@/lib/reservations-data";
import { syncContactToGhl } from "@/lib/ghl-sync";
import type { ContactChannel } from "@/generated/prisma/client";

export type SlotsForDateResult = { slots: string[]; isOpen: boolean };

export async function getSlotsForDateAction(
  slug: string,
  date: string,
  partySize: number
): Promise<SlotsForDateResult> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") return { slots: [], isOpen: true };

  const { start, end } = getDayRange(new Date(`${date}T00:00:00`));
  const [tables, reservations, businessHours] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
  ]);

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const isOpen = getHoursForDay(businessHours, dayOfWeek).isOpen;

  const slots = getAvailableSlots(tables, reservations, {
    partySize,
    date,
    businessHours,
    durationMinutes: restaurant.defaultReservationDurationMinutes,
  });

  return { slots, isOpen };
}

export type WidgetActionResult =
  | { ok: true; booking: { partySize: number; date: string; time: string } }
  | { ok: false; error: string };

export async function createWidgetReservationAction(
  slug: string,
  input: {
    partySize: number;
    date: string;
    time: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    preferredContact: ContactChannel;
    specialRequests: string;
  }
): Promise<WidgetActionResult> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") {
    return { ok: false, error: "This restaurant isn't currently accepting online reservations." };
  }

  const startsAt = new Date(`${input.date}T${input.time}`);
  const { start, end } = getDayRange(startsAt);
  const [tables, reservations, businessHours] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
  ]);

  // Re-check right before writing -- another visitor may have taken this
  // slot between this visitor loading the page and submitting.
  const stillAvailable = getAvailableSlots(tables, reservations, {
    partySize: input.partySize,
    date: input.date,
    businessHours,
    durationMinutes: restaurant.defaultReservationDurationMinutes,
  }).includes(input.time);
  if (!stillAvailable) {
    return { ok: false, error: "That time was just booked by someone else -- please pick another." };
  }

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail,
    phone: input.guestPhone,
  });
  await prisma.customer.update({
    where: { id: customer.id },
    data: { preferredContact: input.preferredContact },
  });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId: null,
      partySize: input.partySize,
      startsAt,
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      specialRequests: input.specialRequests || null,
      status: "PENDING",
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
    }
  );

  revalidatePath(`/r/${slug}/reservations`);

  return { ok: true, booking: { partySize: input.partySize, date: input.date, time: input.time } };
}
