"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth-guards";
import { createUserAccount, setUserPassword } from "@/lib/user-accounts";
import { Prisma, type Role, type RestaurantStatus } from "@/generated/prisma/client";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function createRestaurantAction(input: {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
}): Promise<AdminActionResult> {
  await assertSuperAdmin();

  let restaurant;
  try {
    restaurant = await prisma.restaurant.create({
      data: { name: input.name, slug: input.slug, floors: { create: { name: "Main Floor" } } },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `A restaurant with slug "${input.slug}" already exists.` };
    }
    throw e;
  }

  let owner;
  try {
    owner = await createUserAccount({ name: `${input.name} Owner`, email: input.ownerEmail, password: input.ownerPassword });
  } catch {
    // Roll back the restaurant so we don't leave an orphaned restaurant
    // with no way to log in if the owner account couldn't be created
    // (e.g. duplicate email).
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
    return { ok: false, error: `Could not create an account for "${input.ownerEmail}" — it may already be in use.` };
  }

  await prisma.user.update({ where: { id: owner.id }, data: { role: "OWNER", restaurantId: restaurant.id } });

  revalidatePath("/admin/restaurants");
  return { ok: true };
}

export async function updateRestaurantAction(
  restaurantId: string,
  input: { name: string; slug: string }
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  try {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { name: input.name, slug: input.slug } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `A restaurant with slug "${input.slug}" already exists.` };
    }
    throw e;
  }
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function setRestaurantStatusAction(
  restaurantId: string,
  status: RestaurantStatus
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { status } });
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function updateGhlCredentialsAction(
  restaurantId: string,
  input: { ghlLocationId: string | null; ghlApiKey: string | null }
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { ghlLocationId: input.ghlLocationId, ghlApiKey: input.ghlApiKey },
  });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function addStaffMemberAction(
  restaurantId: string,
  input: { name: string; email: string; password: string; role: Role }
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  let user;
  try {
    user = await createUserAccount({ name: input.name, email: input.email, password: input.password });
  } catch {
    return { ok: false, error: `Could not create an account for "${input.email}" — it may already be in use.` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: input.role, restaurantId } });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function updateStaffMemberAction(
  restaurantId: string,
  userId: string,
  input: { name: string; email: string; role: Role; newPassword?: string }
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  if (input.newPassword && input.newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  try {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, restaurantId },
      data: { name: input.name, email: input.email, role: input.role },
    });
    if (count === 0) return { ok: false, error: "Staff member not found." };
  } catch {
    return { ok: false, error: `Could not update — "${input.email}" may already be in use.` };
  }
  if (input.newPassword) {
    await setUserPassword(userId, input.newPassword);
  }
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function setStaffActiveAction(
  restaurantId: string,
  userId: string,
  active: boolean
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  const { count } = await prisma.user.updateMany({ where: { id: userId, restaurantId }, data: { active } });
  if (count === 0) return { ok: false, error: "Staff member not found." };
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function deleteStaffMemberAction(restaurantId: string, userId: string): Promise<AdminActionResult> {
  await assertSuperAdmin();
  const { count } = await prisma.user.deleteMany({ where: { id: userId, restaurantId } });
  if (count === 0) return { ok: false, error: "Staff member not found." };
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}
