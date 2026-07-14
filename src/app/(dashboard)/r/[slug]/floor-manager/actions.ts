"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
import { toLocalDateInput } from "@/lib/reservation-dates";
import { syncContactToGhl } from "@/lib/ghl-sync";
import type { TableShape } from "@/generated/prisma/client";

export type FloorActionResult = { ok: true } | { ok: false; error: string };

export async function updateTableLayoutAction(
  slug: string,
  tableId: string,
  input: { posX: number; posY: number; shape: TableShape }
): Promise<FloorActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.table.updateMany({
    where: { id: tableId, restaurantId: restaurant.id },
    data: input,
  });
  if (count === 0) return { ok: false, error: "Table not found." };
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}

export async function quickSeatWalkInAction(
  slug: string,
  tableId: string,
  input: { partySize: number; time: string }
): Promise<FloorActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const startsAt = new Date(`${toLocalDateInput(new Date())}T${input.time}`);

  const conflict = await hasTableConflict(tableId, startsAt, 90);
  if (conflict) return { ok: false, error: "That table is already booked for this time." };

  const customer = await findOrCreateCustomer(restaurant.id, { name: "Walk-in" });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId,
      partySize: input.partySize,
      startsAt,
      durationMinutes: 90,
      // A slot later today books like a normal reservation; "now or already
      // past" seats immediately, matching what "walk-in" actually means.
      status: startsAt.getTime() <= Date.now() ? "SEATED" : "CONFIRMED",
    },
  });

  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: customer.name, email: customer.email, phone: customer.phone }
  );

  revalidatePath(`/r/${slug}/floor-manager`);
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}
