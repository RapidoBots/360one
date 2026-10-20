"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantOwner, assertRestaurantMember } from "@/lib/auth-guards";
import { createUserAccount } from "@/lib/user-accounts";
import type { StaffPosition } from "@/generated/prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

// ── Position ──

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

// ── Employee management ──

export async function addEmployeeAction(
  slug: string,
  input: { name: string; email: string; password: string }
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  let user;
  try {
    user = await createUserAccount({ name: input.name, email: input.email, password: input.password });
  } catch {
    return { ok: false, error: `Could not create account for "${input.email}" — it may already be in use.` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "STAFF", restaurantId: restaurant.id } });
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function toggleStaffActiveAction(
  slug: string,
  userId: string,
  active: boolean
): Promise<ActionResult> {
  const { user, restaurant } = await assertRestaurantOwner(slug);
  if (userId === user.id) return { ok: false, error: "You can't deactivate your own account." };
  const { count } = await prisma.user.updateMany({
    where: { id: userId, restaurantId: restaurant.id },
    data: { active },
  });
  if (count === 0) return { ok: false, error: "Staff member not found." };
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function deleteStaffAction(
  slug: string,
  userId: string
): Promise<ActionResult> {
  const { user, restaurant } = await assertRestaurantOwner(slug);
  if (userId === user.id) return { ok: false, error: "You can't delete your own account." };
  const { count } = await prisma.user.deleteMany({ where: { id: userId, restaurantId: restaurant.id } });
  if (count === 0) return { ok: false, error: "Staff member not found." };
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

// ── Shifts ──

export async function createShiftAction(
  slug: string,
  input: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    position: StaffPosition;
    customPosition?: string;
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
        customPosition: input.position === "OTHER" ? (input.customPosition || null) : null,
        notes: input.notes || null,
      },
    });
  } catch {
    return { ok: false, error: "This person already has a shift starting at that time." };
  }
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function createBulkShiftsAction(
  slug: string,
  input: {
    userId: string;
    dates: string[];
    startTime: string;
    endTime: string;
    position: StaffPosition;
    customPosition?: string;
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

  const customPos = input.position === "OTHER" ? (input.customPosition || null) : null;

  const existing = await prisma.shift.findMany({
    where: { userId: input.userId, date: { in: input.dates }, startTime: input.startTime },
    select: { date: true },
  });
  const existingDates = new Set(existing.map((s) => s.date));

  const toCreate = input.dates
    .filter((d) => !existingDates.has(d))
    .map((date) => ({
      restaurantId: restaurant.id,
      userId: input.userId,
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      position: input.position,
      customPosition: customPos,
      notes: input.notes || null,
    }));

  if (toCreate.length === 0) {
    return { ok: false, error: "All selected days already have a shift at this time." };
  }

  await prisma.shift.createMany({ data: toCreate });
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
    customPosition?: string;
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
      customPosition: input.position === "OTHER" ? (input.customPosition || null) : null,
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
      customPosition: s.customPosition,
      notes: s.notes,
    }))
    .filter((s) => !existingKeys.has(`${s.userId}|${s.date}|${s.startTime}`));

  if (newShifts.length > 0) {
    await prisma.shift.createMany({ data: newShifts });
  }

  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

// ── Shift exchange ──

export async function requestShiftExchangeAction(
  slug: string,
  input: { requesterShiftId: string; targetShiftId: string; note?: string }
): Promise<ActionResult> {
  const { user, restaurant } = await assertRestaurantMember(slug);
  const [requester, target] = await Promise.all([
    prisma.shift.findFirst({
      where: { id: input.requesterShiftId, restaurantId: restaurant.id },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.shift.findFirst({
      where: { id: input.targetShiftId, restaurantId: restaurant.id },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);
  if (!requester || !target) return { ok: false, error: "One or both shifts not found." };
  if (requester.userId === target.userId) return { ok: false, error: "Can't exchange a shift with yourself." };
  // Staff can only request swaps for their own shifts
  if (user.role === "STAFF" && requester.userId !== user.id)
    return { ok: false, error: "You can only swap your own shifts." };

  await prisma.shiftExchange.create({
    data: {
      restaurantId: restaurant.id,
      requesterShiftId: input.requesterShiftId,
      targetShiftId: input.targetShiftId,
      note: input.note || null,
      requesterUserId: requester.user.id,
      requesterUserName: requester.user.name,
      targetUserId: target.user.id,
      targetUserName: target.user.name,
    },
  });
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function reviewShiftExchangeAction(
  slug: string,
  exchangeId: string,
  approve: boolean
): Promise<ActionResult> {
  const { user, restaurant } = await assertRestaurantMember(slug);
  const exchange = await prisma.shiftExchange.findFirst({
    where: { id: exchangeId, restaurantId: restaurant.id, status: "PENDING" },
    include: { requesterShift: true, targetShift: true },
  });
  if (!exchange) return { ok: false, error: "Exchange request not found or already resolved." };
  // Staff can only approve/reject exchanges targeting their own shift
  if (user.role === "STAFF" && exchange.targetShift.userId !== user.id)
    return { ok: false, error: "You can only review exchanges for your own shifts." };

  if (approve) {
    try {
      await prisma.$transaction([
        prisma.shift.update({
          where: { id: exchange.requesterShiftId },
          data: { userId: exchange.targetShift.userId },
        }),
        prisma.shift.update({
          where: { id: exchange.targetShiftId },
          data: { userId: exchange.requesterShift.userId },
        }),
        prisma.shiftExchange.update({
          where: { id: exchangeId },
          data: { status: "APPROVED", reviewedAt: new Date() },
        }),
      ]);
    } catch {
      return { ok: false, error: "Couldn't swap — one of them already has a shift at that date and time." };
    }
  } else {
    await prisma.shiftExchange.update({
      where: { id: exchangeId },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });
  }

  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

// ── Publish ──

export async function publishWeekAction(
  slug: string,
  weekStart: string
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  const dates = weekDates(weekStart);
  await prisma.shift.updateMany({
    where: { restaurantId: restaurant.id, date: { in: dates }, draft: true },
    data: { draft: false },
  });
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

// ── Time off ──

export async function createTimeOffRequestAction(
  slug: string,
  input: { fromDate: string; toDate: string; reason?: string }
): Promise<ActionResult> {
  const { user, restaurant } = await assertRestaurantMember(slug);
  if (input.fromDate > input.toDate) {
    return { ok: false, error: "End date must be on or after start date." };
  }
  await prisma.timeOffRequest.create({
    data: {
      restaurantId: restaurant.id,
      userId: user.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason || null,
    },
  });
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

export async function reviewTimeOffRequestAction(
  slug: string,
  requestId: string,
  approve: boolean
): Promise<ActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  const { count } = await prisma.timeOffRequest.updateMany({
    where: { id: requestId, restaurantId: restaurant.id, status: "PENDING" },
    data: { status: approve ? "APPROVED" : "DECLINED", reviewedAt: new Date() },
  });
  if (count === 0) return { ok: false, error: "Request not found or already resolved." };
  revalidatePath(`/r/${slug}/staff`);
  return { ok: true };
}

// ── Availability ──

export async function updateAvailabilityAction(
  slug: string,
  daysOff: number[]
): Promise<ActionResult> {
  const { user, restaurant } = await assertRestaurantMember(slug);
  const valid = daysOff.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!valid) return { ok: false, error: "Invalid day values." };
  await prisma.user.updateMany({
    where: { id: user.id, restaurantId: restaurant.id },
    data: { availabilityOff: daysOff },
  });
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
