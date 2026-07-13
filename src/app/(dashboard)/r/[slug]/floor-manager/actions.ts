"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
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
  partySize: number
): Promise<FloorActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const startsAt = new Date();

  const conflict = await hasTableConflict(tableId, startsAt, 90);
  if (conflict) return { ok: false, error: "That table is already booked for this time." };

  const customer = await findOrCreateCustomer(restaurant.id, { name: "Walk-in" });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId,
      partySize,
      startsAt,
      durationMinutes: 90,
      status: "SEATED",
    },
  });

  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}
