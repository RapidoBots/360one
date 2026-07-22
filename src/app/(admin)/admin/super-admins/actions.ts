"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth-guards";
import { createUserAccount } from "@/lib/user-accounts";

export type SuperAdminActionResult = { ok: true } | { ok: false; error: string };

export async function addSuperAdminAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SuperAdminActionResult> {
  await assertSuperAdmin();
  let user;
  try {
    user = await createUserAccount({ name: input.name, email: input.email, password: input.password });
  } catch {
    return { ok: false, error: `Could not create an account for "${input.email}" — it may already be in use.` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "SUPER_ADMIN", restaurantId: null } });
  revalidatePath("/admin/super-admins");
  return { ok: true };
}

export async function setSuperAdminActiveAction(
  userId: string,
  active: boolean
): Promise<SuperAdminActionResult> {
  const currentUser = await assertSuperAdmin();
  if (userId === currentUser.id) {
    return { ok: false, error: "You can't deactivate your own account." };
  }
  const { count } = await prisma.user.updateMany({
    where: { id: userId, role: "SUPER_ADMIN" },
    data: { active },
  });
  if (count === 0) return { ok: false, error: "Super Admin not found." };
  revalidatePath("/admin/super-admins");
  return { ok: true };
}
