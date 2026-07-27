"use server";

import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { buildReservationsCsv } from "@/lib/report-metrics";
import { getDayRange, toLocalDateInput, zonedDateTimeToUtc } from "@/lib/reservation-dates";

export type ReportsActionResult = { ok: true; csv: string } | { ok: false; error: string };

export async function exportReservationsCsvAction(
  slug: string,
  input: { start: string; end: string }
): Promise<ReportsActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  // Anchored at noon so it's unambiguously within the intended calendar day
  // once viewed in the restaurant's timezone.
  const { start } = getDayRange(zonedDateTimeToUtc(input.start, "12:00", restaurant.timezone), restaurant.timezone);
  const { end } = getDayRange(zonedDateTimeToUtc(input.end, "12:00", restaurant.timezone), restaurant.timezone); // end date is inclusive

  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end } },
    include: { customer: { select: { name: true } }, table: { select: { number: true } } },
    orderBy: { startsAt: "asc" },
  });

  const csv = buildReservationsCsv(
    reservations.map((r) => ({
      date: toLocalDateInput(r.startsAt, restaurant.timezone),
      time: r.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: restaurant.timezone }),
      guestName: r.customer.name,
      partySize: r.partySize,
      table: r.table?.number ?? "",
      status: r.status,
    }))
  );

  return { ok: true, csv };
}
