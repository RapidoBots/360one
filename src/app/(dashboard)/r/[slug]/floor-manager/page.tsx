import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { sortTablesByNumber } from "@/lib/sort-tables";
import { FloorPlan } from "./floor-plan";

export default async function FloorManagerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  const { start, end } = getDayRange(new Date());

  const [rawTables, reservations] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const tables = sortTablesByNumber(rawTables);

  const floorReservations = reservations.map((r) => ({
    id: r.id,
    tableId: r.tableId,
    startsAt: r.startsAt,
    durationMinutes: r.durationMinutes,
    status: r.status,
    partySize: r.partySize,
    customerName: r.customer.name,
  }));

  return <FloorPlan slug={slug} tables={tables} reservations={floorReservations} />;
}
