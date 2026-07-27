"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { assertRestaurantOwner } from "@/lib/auth-guards";
import { createUserAccount } from "@/lib/user-accounts";
import type { Role } from "@/generated/prisma/client";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateRestaurantProfileAction(
  slug: string,
  input: { timezone: string; mapsEmbedUrl: string; phone: string; notes: string }
): Promise<ProfileActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);

  // Only ever store the src URL from Google's "Embed a map" share option --
  // never raw iframe HTML, which would be an XSS vector if rendered as-is.
  if (input.mapsEmbedUrl) {
    let url: URL;
    try {
      url = new URL(input.mapsEmbedUrl);
    } catch {
      return { ok: false, error: "That doesn't look like a valid URL." };
    }
    if (url.hostname !== "www.google.com" || !url.pathname.startsWith("/maps/embed")) {
      return { ok: false, error: "Please paste the map URL from Google Maps' \"Embed a map\" option." };
    }
  }

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      timezone: input.timezone,
      mapsEmbedUrl: input.mapsEmbedUrl || null,
      phone: input.phone || null,
      notes: input.notes || null,
    },
  });

  revalidatePath(`/r/${slug}/settings`);
  revalidatePath(`/reservations/${slug}`);
  return { ok: true };
}

export async function uploadRestaurantLogoAction(
  slug: string,
  formData: FormData
): Promise<ProfileActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please upload an image file." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Image must be smaller than 5MB." };
  }

  const blob = await put(`restaurant-logos/${restaurant.id}-${Date.now()}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { logoUrl: blob.url } });

  revalidatePath(`/r/${slug}/settings`);
  revalidatePath(`/reservations/${slug}`);
  return { ok: true };
}

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
