"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toLocalDateInput, toLocalTimeInput, zonedDateTimeToUtc, getDayRange } from "@/lib/reservation-dates";
import { getAvailableSlots } from "@/lib/widget-availability";
import type { ReservationStatus } from "@/generated/prisma/client";

export type ManagedReservation = {
  status: ReservationStatus;
  partySize: number;
  date: string;
  time: string;
  specialRequests: string | null;
  restaurant: {
    slug: string;
    name: string;
    timezone: string;
    address: string | null;
    phone: string | null;
  };
};

// Still-open statuses a guest can act on -- a cancelled, completed, or
// no-show reservation is final and shown read-only instead.
const EDITABLE_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED"];

export async function getReservationByTokenAction(token: string): Promise<ManagedReservation | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { manageToken: token },
    include: { restaurant: { select: { slug: true, name: true, timezone: true, address: true, phone: true } } },
  });
  if (!reservation) return null;
  return {
    status: reservation.status,
    partySize: reservation.partySize,
    date: toLocalDateInput(reservation.startsAt, reservation.restaurant.timezone),
    time: toLocalTimeInput(reservation.startsAt, reservation.restaurant.timezone),
    specialRequests: reservation.specialRequests,
    restaurant: reservation.restaurant,
  };
}

export type ManageActionResult = { ok: true } | { ok: false; error: string };

export async function cancelReservationByTokenAction(token: string): Promise<ManageActionResult> {
  const reservation = await prisma.reservation.findUnique({
    where: { manageToken: token },
    select: { id: true, status: true, restaurant: { select: { slug: true } } },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };
  if (!EDITABLE_STATUSES.includes(reservation.status)) {
    return { ok: false, error: "This reservation can no longer be cancelled here -- please call the restaurant." };
  }

  await prisma.reservation.update({ where: { id: reservation.id }, data: { status: "CANCELLED" } });

  const { slug } = reservation.restaurant;
  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/floor-manager`);
  revalidatePath(`/r/${slug}/customers`);
  return { ok: true };
}

// A guest-requested time change doesn't overwrite the live reservation
// outright -- it re-checks availability, moves the reservation to PENDING,
// and clears its table (the old table may not suit the new time), so staff
// review and re-confirm it exactly like a fresh widget booking. Matches the
// restaurant's existing process instead of letting a guest silently commit
// a change the dashboard was never designed to double-check unsupervised.
export async function requestRescheduleByTokenAction(
  token: string,
  input: { date: string; time: string; partySize: number }
): Promise<ManageActionResult> {
  const reservation = await prisma.reservation.findUnique({
    where: { manageToken: token },
    include: { restaurant: true },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };
  if (!EDITABLE_STATUSES.includes(reservation.status)) {
    return { ok: false, error: "This reservation can no longer be changed here -- please call the restaurant." };
  }

  const { restaurant } = reservation;
  const startsAt = zonedDateTimeToUtc(input.date, input.time, restaurant.timezone);
  const { start, end } = getDayRange(startsAt, restaurant.timezone);

  const [tables, otherReservations, businessHours, closedDate, blockedSlots] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        id: { not: reservation.id },
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

  const stillAvailable =
    !closedDate &&
    getAvailableSlots(tables, otherReservations, {
      partySize: input.partySize,
      date: input.date,
      businessHours,
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      timeZone: restaurant.timezone,
      blockedTimes: blockedSlots.map((b) => b.time),
      now: new Date(),
    }).includes(input.time);

  if (!stillAvailable) {
    return { ok: false, error: "That time isn't available -- please pick another." };
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      startsAt,
      partySize: input.partySize,
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      tableId: null,
      status: "PENDING",
    },
  });

  revalidatePath(`/r/${restaurant.slug}/reservations`);
  return { ok: true };
}
