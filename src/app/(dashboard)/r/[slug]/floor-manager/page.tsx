import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { sortTablesByNumber } from "@/lib/sort-tables";
import { FloorPlan } from "./floor-plan";

export default async function FloorManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ floor?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  const { start, end } = getDayRange(new Date(), restaurant.timezone);

  const [rawTables, floors, reservations] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id } }),
    prisma.floor.findMany({ where: { restaurantId: restaurant.id }, orderBy: { order: "asc" } }),
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

  // Every restaurant always has at least one floor (created alongside it),
  // so this only falls through to "no floor" if that invariant is somehow
  // broken -- shown as an empty state rather than crashing.
  const currentFloor = floors.find((f) => f.id === sp.floor) ?? floors[0];

  if (!currentFloor) {
    return <p className="py-16 text-center text-base text-muted-foreground">No floors set up yet.</p>;
  }

  const tables = sortTablesByNumber(rawTables.filter((t) => t.floorId === currentFloor.id));

  // Not floor-filtered: getTableStatus scopes per-table internally (it
  // filters by tableId), so reservations for tables on other floors are
  // naturally ignored -- no need to pre-filter here too.
  const floorReservations = reservations.map((r) => ({
    id: r.id,
    tableId: r.tableId,
    startsAt: r.startsAt,
    durationMinutes: r.durationMinutes,
    status: r.status,
    partySize: r.partySize,
    customerName: r.customer.name,
    internalNote: r.internalNote,
  }));

  return (
    <FloorPlan
      key={currentFloor.id}
      slug={slug}
      tables={tables}
      floors={floors}
      currentFloorId={currentFloor.id}
      reservations={floorReservations}
      timeZone={restaurant.timezone}
    />
  );
}
