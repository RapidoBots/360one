import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toLocalDateInput } from "@/lib/reservation-dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  reservationsPerDay,
  busiestDayOfWeek,
  busiestHourOfDay,
  reservationsPerTable,
  calculateRates,
  classifyGuests,
  topRepeatGuests,
} from "@/lib/report-metrics";
import { ReportBarChart } from "./report-bar-chart";
import { ExportCsvButton } from "./export-csv-button";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startInput = sp.start || toLocalDateInput(defaultStart);
  const endInput = sp.end || toLocalDateInput(today);

  const start = new Date(`${startInput}T00:00:00`);
  const end = new Date(`${endInput}T00:00:00`);
  end.setDate(end.getDate() + 1);

  const [reservations, tables, businessHours] = await Promise.all([
    prisma.reservation.findMany({
      where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end } },
      select: {
        startsAt: true,
        status: true,
        tableId: true,
        customerId: true,
        customer: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, number: true } }),
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
  ]);

  const distinctCustomerIds = Array.from(new Set(reservations.map((r) => r.customerId)));
  const allTimeCounts =
    distinctCustomerIds.length > 0
      ? await prisma.reservation.groupBy({
          by: ["customerId"],
          where: { customerId: { in: distinctCustomerIds } },
          _count: { _all: true },
        })
      : [];
  const allTimeCountMap = Object.fromEntries(allTimeCounts.map((c) => [c.customerId, c._count._all]));

  const rates = calculateRates(reservations);
  const guestSummary = classifyGuests(
    reservations.map((r) => r.customerId),
    allTimeCountMap
  );
  const topGuests = topRepeatGuests(
    reservations.map((r) => ({ customerId: r.customerId, name: r.customer.name })),
    allTimeCountMap
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <ExportCsvButton slug={slug} start={startInput} end={endInput} />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[5px] border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="start">Start</Label>
          <Input id="start" name="start" type="date" defaultValue={startInput} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End</Label>
          <Input id="end" name="end" type="date" defaultValue={endInput} required />
        </div>
        <Button type="submit" className="h-11 px-5 text-base">
          Apply range
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">No-show rate</p>
          <p className="text-3xl font-semibold">{rates.noShowRate}%</p>
        </div>
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">Cancellation rate</p>
          <p className="text-3xl font-semibold">{rates.cancellationRate}%</p>
        </div>
      </div>

      <div className="rounded-[5px] border border-border p-5">
        <h2 className="mb-2 text-base font-semibold">Reservations per day</h2>
        <ReportBarChart data={reservationsPerDay(reservations, { start, end })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[5px] border border-border p-5">
          <h2 className="mb-2 text-base font-semibold">Busiest day of week</h2>
          <ReportBarChart data={busiestDayOfWeek(reservations)} />
        </div>
        <div className="rounded-[5px] border border-border p-5">
          <h2 className="mb-2 text-base font-semibold">Busiest hour of day</h2>
          <ReportBarChart data={busiestHourOfDay(reservations, businessHours)} />
        </div>
      </div>

      <div className="rounded-[5px] border border-border p-5">
        <h2 className="mb-2 text-base font-semibold">Reservations per table</h2>
        <ReportBarChart data={reservationsPerTable(reservations, tables)} />
      </div>

      <div className="rounded-[5px] border border-border p-5">
        <h2 className="mb-2 text-base font-semibold">Status breakdown</h2>
        <ReportBarChart data={rates.statusBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">Unique guests</p>
          <p className="text-3xl font-semibold">{guestSummary.totalUniqueGuests}</p>
        </div>
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">New guests</p>
          <p className="text-3xl font-semibold">{guestSummary.newCount}</p>
        </div>
        <div className="rounded-[5px] border border-border p-5">
          <p className="text-base text-muted-foreground">Repeat guests</p>
          <p className="text-3xl font-semibold">{guestSummary.repeatCount}</p>
        </div>
      </div>

      <div className="rounded-[5px] border border-border">
        <h2 className="border-b border-border p-4 text-base font-semibold">Top repeat guests</h2>
        {topGuests.length === 0 ? (
          <p className="p-6 text-center text-base text-muted-foreground">No repeat guests in this range.</p>
        ) : (
          <ul className="divide-y divide-border">
            {topGuests.map((g) => (
              <li key={g.customerId} className="flex items-center justify-between gap-4 p-4">
                <p className="font-medium">{g.name}</p>
                <p className="text-base text-muted-foreground">{g.visits} visits</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
