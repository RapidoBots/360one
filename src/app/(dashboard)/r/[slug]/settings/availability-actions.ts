"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantOwner } from "@/lib/auth-guards";
import { getSlotTimesForDay } from "@/lib/widget-availability";

export type DateAvailability = { closed: boolean; slotTimes: string[]; blockedTimes: string[] };

export async function getAvailabilityForDateAction(slug: string, date: string): Promise<DateAvailability> {
  const { restaurant } = await assertRestaurantOwner(slug);

  const [businessHours, closedDate, blockedSlots] = await Promise.all([
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
    prisma.closedDate.findUnique({ where: { restaurantId_date: { restaurantId: restaurant.id, date } } }),
    prisma.blockedSlot.findMany({ where: { restaurantId: restaurant.id, date }, select: { time: true } }),
  ]);

  return {
    closed: Boolean(closedDate),
    slotTimes: getSlotTimesForDay(businessHours, date, restaurant.defaultReservationDurationMinutes),
    blockedTimes: blockedSlots.map((b) => b.time),
  };
}

export async function setDateClosedAction(slug: string, date: string, closed: boolean): Promise<DateAvailability> {
  const { restaurant } = await assertRestaurantOwner(slug);

  if (closed) {
    await prisma.closedDate.upsert({
      where: { restaurantId_date: { restaurantId: restaurant.id, date } },
      update: {},
      create: { restaurantId: restaurant.id, date },
    });
  } else {
    await prisma.closedDate.deleteMany({ where: { restaurantId: restaurant.id, date } });
  }

  revalidatePath(`/reservations/${slug}`);
  return getAvailabilityForDateAction(slug, date);
}

export async function toggleBlockedSlotAction(
  slug: string,
  date: string,
  time: string
): Promise<DateAvailability> {
  const { restaurant } = await assertRestaurantOwner(slug);

  const existing = await prisma.blockedSlot.findUnique({
    where: { restaurantId_date_time: { restaurantId: restaurant.id, date, time } },
  });
  if (existing) {
    await prisma.blockedSlot.delete({ where: { id: existing.id } });
  } else {
    await prisma.blockedSlot.create({ data: { restaurantId: restaurant.id, date, time } });
  }

  revalidatePath(`/reservations/${slug}`);
  return getAvailabilityForDateAction(slug, date);
}
