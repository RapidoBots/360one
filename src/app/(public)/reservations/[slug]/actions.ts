"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDayRange, zonedDateTimeToUtc } from "@/lib/reservation-dates";
import { getAllSlotsForDay, getAvailableSlots, type SlotAvailability } from "@/lib/widget-availability";
import { getHoursForDay } from "@/lib/business-hours";
import { findOrCreateCustomer } from "@/lib/reservations-data";
import { syncContactToGhl } from "@/lib/ghl-sync";
import type { ContactChannel } from "@/generated/prisma/client";

export type SlotsForDateResult = { slots: SlotAvailability[]; isOpen: boolean };

export async function getSlotsForDateAction(
  slug: string,
  date: string,
  partySize: number
): Promise<SlotsForDateResult> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") return { slots: [], isOpen: true };

  // Anchored at noon so it's unambiguously within the intended calendar day
  // once viewed in the restaurant's timezone -- midnight UTC could fall on
  // the previous day for a zone west of UTC.
  const { start, end } = getDayRange(zonedDateTimeToUtc(date, "12:00", restaurant.timezone), restaurant.timezone);
  const [tables, reservations, businessHours, closedDate, blockedSlots] = await Promise.all([
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
    prisma.closedDate.findUnique({ where: { restaurantId_date: { restaurantId: restaurant.id, date } } }),
    prisma.blockedSlot.findMany({ where: { restaurantId: restaurant.id, date }, select: { time: true } }),
  ]);

  // A fixed Y-M-D string's day-of-week is the same regardless of timezone.
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const isOpen = getHoursForDay(businessHours, dayOfWeek).isOpen && !closedDate;
  if (!isOpen) return { slots: [], isOpen: false };

  const slots = getAllSlotsForDay(tables, reservations, {
    partySize,
    date,
    businessHours,
    durationMinutes: restaurant.defaultReservationDurationMinutes,
    timeZone: restaurant.timezone,
    blockedTimes: blockedSlots.map((b) => b.time),
    now: new Date(),
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

  const startsAt = zonedDateTimeToUtc(input.date, input.time, restaurant.timezone);
  const { start, end } = getDayRange(startsAt, restaurant.timezone);
  const [tables, reservations, businessHours, closedDate, blockedSlots] = await Promise.all([
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
    prisma.closedDate.findUnique({
      where: { restaurantId_date: { restaurantId: restaurant.id, date: input.date } },
    }),
    prisma.blockedSlot.findMany({ where: { restaurantId: restaurant.id, date: input.date }, select: { time: true } }),
  ]);

  // Re-check right before writing -- another visitor may have taken this
  // slot, or the owner may have blocked it, between page load and submit.
  const stillAvailable =
    !closedDate &&
    getAvailableSlots(tables, reservations, {
      partySize: input.partySize,
      date: input.date,
      businessHours,
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      timeZone: restaurant.timezone,
      blockedTimes: blockedSlots.map((b) => b.time),
      now: new Date(),
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
      timeZone: restaurant.timezone,
    }
  );

  revalidatePath(`/r/${slug}/reservations`);

  return { ok: true, booking: { partySize: input.partySize, date: input.date, time: input.time } };
}
