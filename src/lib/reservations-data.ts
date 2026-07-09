import { prisma } from "@/lib/prisma";
import { doesOverlap } from "@/lib/reservation-conflicts";
import { customerMatchKey, normalizeEmail, normalizePhone } from "@/lib/customer-matching";
import { getDayRange } from "@/lib/reservation-dates";

export async function findOrCreateCustomer(
  restaurantId: string,
  input: { name: string; email?: string | null; phone?: string | null }
) {
  const key = customerMatchKey(input);
  if (key) {
    const existing = await prisma.customer.findFirst({
      where: { restaurantId, [key.field]: key.value },
    });
    if (existing) {
      if (existing.name !== input.name) {
        return prisma.customer.update({ where: { id: existing.id }, data: { name: input.name } });
      }
      return existing;
    }
  }

  return prisma.customer.create({
    data: {
      restaurantId,
      name: input.name,
      email: input.email ? normalizeEmail(input.email) : null,
      phone: input.phone ? normalizePhone(input.phone) : null,
    },
  });
}

// ponytail: bounds the conflict search to the reservation's own calendar day.
// A reservation starting near midnight with a long duration could miss a
// conflict just after midnight — acceptable until Phase 8 models real
// business hours.
export async function hasTableConflict(
  tableId: string,
  startsAt: Date,
  durationMinutes: number,
  excludeReservationId?: string
): Promise<boolean> {
  const { start, end } = getDayRange(startsAt);
  const candidates = await prisma.reservation.findMany({
    where: {
      tableId,
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { gte: start, lt: end },
    },
    select: { startsAt: true, durationMinutes: true },
  });
  return candidates.some((c) => doesOverlap({ startsAt, durationMinutes }, c));
}

export async function listTables(restaurantId: string) {
  return prisma.table.findMany({ where: { restaurantId }, orderBy: { number: "asc" } });
}
