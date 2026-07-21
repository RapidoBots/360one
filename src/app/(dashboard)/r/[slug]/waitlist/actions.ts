"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
import { syncContactToGhl } from "@/lib/ghl-sync";
import type { WaitlistStatus } from "@/generated/prisma/client";

export type WaitlistActionResult = { ok: true } | { ok: false; error: string };

export async function addToWaitlistAction(
  slug: string,
  input: {
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    partySize: number;
    quotedWaitMinutes: number | null;
    notes: string;
  }
): Promise<WaitlistActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail || null,
    phone: input.guestPhone || null,
  });

  await prisma.waitlistEntry.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      partySize: input.partySize,
      quotedWaitMinutes: input.quotedWaitMinutes,
      notes: input.notes || null,
    },
  });

  revalidatePath(`/r/${slug}/waitlist`);
  return { ok: true };
}

export async function seatFromWaitlistAction(
  slug: string,
  waitlistEntryId: string,
  tableId: string
): Promise<WaitlistActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: waitlistEntryId, restaurantId: restaurant.id },
    include: { customer: true },
  });
  if (!entry) return { ok: false, error: "Waitlist entry not found." };

  const startsAt = new Date();
  const conflict = await hasTableConflict(tableId, startsAt, restaurant.defaultReservationDurationMinutes);
  if (conflict) return { ok: false, error: "That table is already booked for this time." };

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: entry.customerId,
      tableId,
      partySize: entry.partySize,
      startsAt,
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      status: "SEATED",
    },
  });

  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    {
      name: entry.customer.name,
      email: entry.customer.email,
      phone: entry.customer.phone,
      startsAt,
      partySize: entry.partySize,
      restaurantName: restaurant.name,
    }
  );

  await prisma.waitlistEntry.update({
    where: { id: waitlistEntryId },
    data: { status: "SEATED" },
  });

  revalidatePath(`/r/${slug}/waitlist`);
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}

export async function updateWaitlistStatusAction(
  slug: string,
  waitlistEntryId: string,
  status: Extract<WaitlistStatus, "CANCELLED" | "NO_SHOW">
): Promise<WaitlistActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.waitlistEntry.updateMany({
    where: { id: waitlistEntryId, restaurantId: restaurant.id },
    data: { status },
  });
  if (count === 0) return { ok: false, error: "Waitlist entry not found." };
  revalidatePath(`/r/${slug}/waitlist`);
  return { ok: true };
}
