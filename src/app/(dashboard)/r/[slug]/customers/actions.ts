"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";

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

// customerId is required (not optional) on both Reservation and
// WaitlistEntry, so deleting a customer who has ever booked always hit a
// foreign-key error -- deleting a customer means removing them from the
// system, so their reservation/waitlist history goes with them.
export async function deleteCustomerAction(slug: string, customerId: string): Promise<CustomerActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const count = await prisma.$transaction(async (tx) => {
    await tx.reservation.deleteMany({ where: { customerId, restaurantId: restaurant.id } });
    await tx.waitlistEntry.deleteMany({ where: { customerId, restaurantId: restaurant.id } });
    const { count } = await tx.customer.deleteMany({ where: { id: customerId, restaurantId: restaurant.id } });
    return count;
  });
  if (count === 0) return { ok: false, error: "Customer not found." };

  revalidatePath(`/r/${slug}/customers`);
  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/waitlist`);
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}
