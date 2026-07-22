"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantOwner } from "@/lib/auth-guards";
import { createUserAccount } from "@/lib/user-accounts";
import type { Role } from "@/generated/prisma/client";

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

export async function addTeamMemberAction(
  slug: string,
  input: { name: string; email: string; password: string; role: Role }
): Promise<SettingsActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  let user;
  try {
    user = await createUserAccount({ name: input.name, email: input.email, password: input.password });
  } catch {
    return { ok: false, error: `Could not create an account for "${input.email}" — it may already be in use.` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: input.role, restaurantId: restaurant.id } });
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true };
}

export async function setTeamMemberActiveAction(
  slug: string,
  userId: string,
  active: boolean
): Promise<SettingsActionResult> {
  const { user, restaurant } = await assertRestaurantOwner(slug);
  if (userId === user.id) {
    return { ok: false, error: "You can't deactivate your own account." };
  }
  const { count } = await prisma.user.updateMany({
    where: { id: userId, restaurantId: restaurant.id },
    data: { active },
  });
  if (count === 0) return { ok: false, error: "Team member not found." };
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true };
}
