"use server";

import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { getAvailableSlots } from "@/lib/widget-availability";

export async function getSlotsForDateAction(
  slug: string,
  date: string,
  partySize: number
): Promise<string[]> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") return [];

  const { start, end } = getDayRange(new Date(`${date}T00:00:00`));
  const [tables, reservations] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
  ]);

  return getAvailableSlots(tables, reservations, { partySize, date });
}
