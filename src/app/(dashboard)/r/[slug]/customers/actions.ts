"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { Prisma } from "@/generated/prisma/client";

export type CustomerActionResult = { ok: true } | { ok: false; error: string };

export type CustomerInput = {
  name: string;
  email: string;
  phone: string;
};

export async function updateCustomerAction(
  slug: string,
  customerId: string,
  input: CustomerInput
): Promise<CustomerActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const { count } = await prisma.customer.updateMany({
    where: { id: customerId, restaurantId: restaurant.id },
    data: {
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
    },
  });
  if (count === 0) return { ok: false, error: "Customer not found." };

  revalidatePath(`/r/${slug}/customers`);
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}

export async function deleteCustomerAction(slug: string, customerId: string): Promise<CustomerActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  try {
    const { count } = await prisma.customer.deleteMany({
      where: { id: customerId, restaurantId: restaurant.id },
    });
    if (count === 0) return { ok: false, error: "Customer not found." };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return {
        ok: false,
        error: "Can't delete — this customer has reservations. Delete those first.",
      };
    }
    throw e;
  }

  revalidatePath(`/r/${slug}/customers`);
  return { ok: true };
}
