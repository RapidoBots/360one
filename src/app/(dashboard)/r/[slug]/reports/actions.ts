"use server";

import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { buildReservationsCsv } from "@/lib/report-metrics";
import { toLocalDateInput } from "@/lib/reservation-dates";

export type ReportsActionResult = { ok: true; csv: string } | { ok: false; error: string };

export async function exportReservationsCsvAction(
  slug: string,
  input: { start: string; end: string }
): Promise<ReportsActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const start = new Date(`${input.start}T00:00:00`);
  const end = new Date(`${input.end}T00:00:00`);
  end.setDate(end.getDate() + 1); // end date is inclusive

  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end } },
    include: { customer: { select: { name: true } }, table: { select: { number: true } } },
    orderBy: { startsAt: "asc" },
  });

  const csv = buildReservationsCsv(
    reservations.map((r) => ({
      date: toLocalDateInput(r.startsAt),
      time: r.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      guestName: r.customer.name,
      partySize: r.partySize,
      table: r.table?.number ?? "",
      status: r.status,
    }))
  );

  return { ok: true, csv };
}
