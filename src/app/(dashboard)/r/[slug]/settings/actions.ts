"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantOwner } from "@/lib/auth-guards";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

export type BusinessHoursInput = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export async function updateBusinessSettingsAction(
  slug: string,
  input: { hours: BusinessHoursInput[]; defaultReservationDurationMinutes: number }
): Promise<SettingsActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);

  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { defaultReservationDurationMinutes: input.defaultReservationDurationMinutes },
    }),
    ...input.hours.map((day) =>
      prisma.businessHours.upsert({
        where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek: day.dayOfWeek } },
        update: { isOpen: day.isOpen, openTime: day.openTime, closeTime: day.closeTime },
        create: {
          restaurantId: restaurant.id,
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
        },
      })
    ),
  ]);

  revalidatePath(`/r/${slug}/settings`);
  return { ok: true };
}
