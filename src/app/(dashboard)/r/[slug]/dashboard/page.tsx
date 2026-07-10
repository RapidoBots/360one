import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { ReservationBadge } from "../reservations/reservation-badge";
import { ReservationsByHourChart, type HourBucket } from "./reservations-by-hour-chart";

// ponytail: matches Timeline view's business-hours window (8am-11pm).
// Duplicated rather than shared since Phase 8 will make this a real,
// per-restaurant configurable setting -- not worth a shared constant yet.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  const { start, end } = getDayRange(new Date());
  const now = new Date();

  const [totalTables, todaysReservations] = await Promise.all([
    prisma.table.count({ where: { restaurantId: restaurant.id } }),
    prisma.reservation.findMany({
      where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end } },
      include: { customer: { select: { name: true } }, table: { select: { number: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const occupiedTableIds = new Set(
    todaysReservations.filter((r) => r.status === "SEATED" && r.tableId).map((r) => r.tableId)
  );
  const occupancyPercent = totalTables === 0 ? 0 : Math.round((occupiedTableIds.size / totalTables) * 100);

  const upcomingArrivals = todaysReservations
    .filter((r) => r.status === "CONFIRMED" && r.startsAt >= now)
    .slice(0, 5);

  const hourBuckets: HourBucket[] = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => {
    const hour = DAY_START_HOUR + i;
    const label = `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? "p" : "a"}`;
    const count = todaysReservations.filter((r) => r.startsAt.getHours() === hour).length;
    return { hour: label, count };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome to {restaurant.name}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">Today&apos;s Reservations</p>
          <p className="text-3xl font-semibold">{todaysReservations.length}</p>
        </div>
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">Occupancy</p>
          <p className="text-3xl font-semibold">{occupancyPercent}%</p>
          <p className="text-sm text-muted-foreground">
            {occupiedTableIds.size} of {totalTables} tables seated
          </p>
        </div>
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">Upcoming Arrivals</p>
          <p className="text-3xl font-semibold">{upcomingArrivals.length}</p>
        </div>
      </div>

      <div className="rounded-[5px] border border-border p-5">
        <h2 className="mb-2 text-base font-semibold">Reservations by hour</h2>
        <ReservationsByHourChart data={hourBuckets} />
      </div>

      <div className="rounded-[5px] border border-border">
        <h2 className="border-b border-border p-4 text-base font-semibold">Upcoming Arrivals</h2>
        {upcomingArrivals.length === 0 ? (
          <p className="p-6 text-center text-base text-muted-foreground">No upcoming arrivals today.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcomingArrivals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-4">
                  <span className="w-16 shrink-0 font-mono text-base">
                    {r.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div>
                    <p className="font-medium">{r.customer.name}</p>
                    <p className="text-base text-muted-foreground">
                      Party of {r.partySize}
                      {r.table ? ` · Table ${r.table.number}` : ""}
                    </p>
                  </div>
                </div>
                <ReservationBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
