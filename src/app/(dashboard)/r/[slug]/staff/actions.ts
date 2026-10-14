"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantOwner } from "@/lib/auth-guards";
import type { StaffPosition } from "@/generated/prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateStaffPositionAction(
  slug: string,
  userId: string,
  position: StaffPosition | null
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  const { count } = await prisma.user.updateMany({
    where: { id: userId, restaurantId: restaurant.id },
    data: { position },
  });
  if (count === 0) return { ok: false, error: "Staff member not found." };
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function createShiftAction(
  slug: string,
  input: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    position: StaffPosition;
    notes?: string;
  }
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  const member = await prisma.user.findFirst({
    where: { id: input.userId, restaurantId: restaurant.id },
  });
  if (!member) return { ok: false, error: "Staff member not found." };
  if (input.startTime >= input.endTime) {
    return { ok: false, error: "End time must be after start time." };
  }
  try {
    await prisma.shift.create({
      data: {
        restaurantId: restaurant.id,
        userId: input.userId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        position: input.position,
        notes: input.notes || null,
      },
    });
  } catch {
    return { ok: false, error: "This person already has a shift starting at that time." };
  }
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function updateShiftAction(
  slug: string,
  shiftId: string,
  input: {
    startTime: string;
    endTime: string;
    position: StaffPosition;
    notes?: string;
  }
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  if (input.startTime >= input.endTime) {
    return { ok: false, error: "End time must be after start time." };
  }
  const { count } = await prisma.shift.updateMany({
    where: { id: shiftId, restaurantId: restaurant.id },
    data: {
      startTime: input.startTime,
      endTime: input.endTime,
      position: input.position,
      notes: input.notes || null,
    },
  });
  if (count === 0) return { ok: false, error: "Shift not found." };
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function deleteShiftAction(
  slug: string,
  shiftId: string
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  const { count } = await prisma.shift.deleteMany({
    where: { id: shiftId, restaurantId: restaurant.id },
  });
  if (count === 0) return { ok: false, error: "Shift not found." };
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function copyWeekScheduleAction(
  slug: string,
  input: { sourceStartDate: string; targetStartDate: string }
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);

  const sourceDates = weekDates(input.sourceStartDate);
  const targetDates = weekDates(input.targetStartDate);

  const sourceShifts = await prisma.shift.findMany({
    where: { restaurantId: restaurant.id, date: { in: sourceDates } },
  });

  if (sourceShifts.length === 0) {
    return { ok: false, error: "No shifts found in the source week to copy." };
  }

  const dateMap = new Map(sourceDates.map((s, i) => [s, targetDates[i]]));

  const existingTarget = await prisma.shift.findMany({
    where: { restaurantId: restaurant.id, date: { in: targetDates } },
    select: { userId: true, date: true, startTime: true },
  });
  const existingKeys = new Set(
    existingTarget.map((s) => `${s.userId}|${s.date}|${s.startTime}`)
  );

  const newShifts = sourceShifts
    .map((s) => ({
      restaurantId: restaurant.id,
      userId: s.userId,
      date: dateMap.get(s.date)!,
      startTime: s.startTime,
      endTime: s.endTime,
      position: s.position,
      notes: s.notes,
    }))
    .filter((s) => !existingKeys.has(`${s.userId}|${s.date}|${s.startTime}`));

  if (newShifts.length > 0) {
    await prisma.shift.createMany({ data: newShifts });
  }

  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

function weekDates(mondayIso: string): string[] {
  const d = new Date(mondayIso + "T12:00:00Z");
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setUTCDate(d.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}
