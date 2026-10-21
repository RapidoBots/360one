import { notFound } from "next/navigation";
import { Ban, Calendar, Plus, Repeat, Users, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireFeatureAccess } from "@/lib/auth-guards";
import { toLocalDateInput, getDayRange, zonedDateTimeToUtc, formatZonedDate } from "@/lib/reservation-dates";
import { getWidestOpenWindow } from "@/lib/business-hours";
import {
  reservationsPerDay,
  busiestDayOfWeek,
  busiestHourOfDay,
  reservationsPerTable,
  calculateRates,
  classifyGuests,
  topRepeatGuests,
} from "@/lib/report-metrics";
import { DateRangeControl } from "./date-range-control";
import { ReservationsPerDayChart, type DayPoint } from "./reservations-per-day-chart";
import { PeakBarChart } from "./peak-bar-chart";
import { StatusBreakdownSection } from "./status-breakdown-section";
import { PerTableSection } from "./per-table-section";
import { TopGuestsSection } from "./top-guests-section";
import { ExportCsvButton } from "./export-csv-button";
import type { ReservationStatus } from "@/generated/prisma/client";

const HOUR_LONG_LABELS: Record<number, string> = {};
for (let h = 0; h < 24; h++) HOUR_LONG_LABELS[h] = `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Swap reversed dates and cap the span at 365 days, regardless of whether the
// bad input came from a hand-edited URL or a stale bookmark.
function clampRange(startInput: string, endInput: string): { start: string; end: string } {
  let s = startInput, e = endInput;
  if (s > e) [s, e] = [e, s];
  const days = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1;
  if (days > 365) s = addDays(e, -364);
  return { start: s, end: e };
}

function dayKeysInRange(start: Date, end: Date, timeZone: string): string[] {
  const keys: string[] = [];
  let cursor = start;
  while (cursor < end) {
    keys.push(toLocalDateInput(cursor, timeZone));
    cursor = getDayRange(cursor, timeZone).end;
  }
  return keys;
}

const KPI_ICON = { total: Calendar, noshow: X, cancel: Ban, unique: Users, fresh: Plus, repeat: Repeat };

function KpiCard({
  label, value, icon: Icon, chipBg, chipColor, delta, deltaUp, hint,
}: {
  label: string;
  value: string | number;
  icon: typeof Calendar;
  chipBg: string;
  chipColor: string;
  delta?: string;
  deltaUp?: boolean;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border border-line-card bg-white p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-ink-muted">{label}</span>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: chipBg, color: chipColor }}>
          <Icon className="size-[22px]" strokeWidth={1.8} />
        </span>
      </div>
      <div className="text-[36px] font-extrabold leading-none tracking-tight text-ink">{value}</div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
        {delta && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: deltaUp ? "var(--success-soft)" : "var(--danger-soft)", color: deltaUp ? "var(--success)" : "var(--danger)" }}
          >
            {delta}
          </span>
        )}
        <span>{hint}</span>
      </div>
    </div>
  );
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { access } = await requireFeatureAccess(slug, "reports", "VIEW");
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 29);

  const { start: startInput, end: endInput } = clampRange(
    sp.start || toLocalDateInput(defaultStart, restaurant.timezone),
    sp.end || toLocalDateInput(today, restaurant.timezone)
  );

  // Anchored at noon so it's unambiguously within the intended calendar day
  // once viewed in the restaurant's timezone.
  const { start } = getDayRange(zonedDateTimeToUtc(startInput, "12:00", restaurant.timezone), restaurant.timezone);
  const { end } = getDayRange(zonedDateTimeToUtc(endInput, "12:00", restaurant.timezone), restaurant.timezone); // end date is inclusive

  const dayKeys = dayKeysInRange(start, end, restaurant.timezone);
  const rangeDays = dayKeys.length;
  const prevStartInput = addDays(startInput, -rangeDays);
  const prevEndInput = addDays(startInput, -1);
  const { start: prevStart } = getDayRange(zonedDateTimeToUtc(prevStartInput, "12:00", restaurant.timezone), restaurant.timezone);
  const { end: prevEnd } = getDayRange(zonedDateTimeToUtc(prevEndInput, "12:00", restaurant.timezone), restaurant.timezone);

  const [reservations, tables, businessHours, prevTotal] = await Promise.all([
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
    prisma.reservation.count({ where: { restaurantId: restaurant.id, startsAt: { gte: prevStart, lt: prevEnd } } }),
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

  const total = reservations.length;
  const rates = calculateRates(reservations);
  const guestSummary = classifyGuests(
    reservations.map((r) => r.customerId),
    allTimeCountMap
  );
  const topGuests = topRepeatGuests(
    reservations.map((r) => ({ customerId: r.customerId, name: r.customer.name })),
    allTimeCountMap
  );
  const statusCounts = Object.fromEntries(rates.statusBreakdown.map((s) => [s.label, s.value])) as Record<ReservationStatus, number>;

  const deltaPct = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
  const deltaUp = deltaPct >= 0;

  const dayBuckets = reservationsPerDay(reservations, { start, end }, restaurant.timezone);
  const dayPoints: DayPoint[] = dayBuckets.map((b, i) => ({
    dateStr: dayKeys[i]!,
    shortLabel: b.label,
    longLabel: formatZonedDate(new Date(dayKeys[i] + "T12:00:00Z"), "UTC", { weekday: "long", month: "long", day: "numeric" }),
    count: b.value,
  }));
  const avgPerDay = (total / rangeDays).toFixed(1);

  const dowLongLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dowBuckets = busiestDayOfWeek(reservations, restaurant.timezone);
  const dowItems = dowBuckets.map((b, i) => ({ label: b.label, longLabel: dowLongLabels[i]!, count: b.value }));

  const { startHour } = getWidestOpenWindow(businessHours);
  const hourBuckets = busiestHourOfDay(reservations, businessHours, restaurant.timezone);
  const hourItems = hourBuckets.map((b, i) => ({
    label: b.label,
    longLabel: HOUR_LONG_LABELS[(startHour + i) % 24]!,
    count: b.value,
  }));

  const perTable = reservationsPerTable(reservations, tables).map((b) => ({ name: `Table ${b.label}`, count: b.value }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink">Reports</h1>
          <p className="text-[15px] text-ink-muted">
            {formatZonedDate(start, restaurant.timezone, { month: "short", day: "numeric", year: "numeric" })}
            {" – "}
            {formatZonedDate(end, restaurant.timezone, { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            {rangeDays} {rangeDays === 1 ? "day" : "days"}
          </p>
        </div>
        {access === "EDIT" && <ExportCsvButton slug={slug} start={startInput} end={endInput} />}
      </div>

      <DateRangeControl start={startInput} end={endInput} today={toLocalDateInput(today, restaurant.timezone)} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <KpiCard
          label="Total reservations" value={total} icon={KPI_ICON.total}
          chipBg="color-mix(in srgb, var(--primary) 10%, white)" chipColor="var(--primary)"
          delta={`${deltaUp ? "+" : ""}${deltaPct}%`} deltaUp={deltaUp} hint={`vs previous ${rangeDays} days`}
        />
        <KpiCard
          label="No-show rate" value={`${rates.noShowRate}%`} icon={KPI_ICON.noshow}
          chipBg="#FFEDD5" chipColor="#C2410C" hint={`${statusCounts.NO_SHOW ?? 0} of ${total} reservations`}
        />
        <KpiCard
          label="Cancellation rate" value={`${rates.cancellationRate}%`} icon={KPI_ICON.cancel}
          chipBg="#FEE2E2" chipColor="#B91C1C" hint={`${statusCounts.CANCELLED ?? 0} of ${total} reservations`}
        />
        <KpiCard
          label="Unique guests" value={guestSummary.totalUniqueGuests} icon={KPI_ICON.unique}
          chipBg="#F3E8FF" chipColor="#7E22CE" hint="Different guests in this range"
        />
        <KpiCard
          label="New guests" value={guestSummary.newCount} icon={KPI_ICON.fresh}
          chipBg="var(--success-soft)" chipColor="var(--success)"
          hint={`${guestSummary.totalUniqueGuests ? Math.round((guestSummary.newCount / guestSummary.totalUniqueGuests) * 100) : 0}% of unique guests`}
        />
        <KpiCard
          label="Repeat guests" value={guestSummary.repeatCount} icon={KPI_ICON.repeat}
          chipBg="#DBEAFE" chipColor="#1D4ED8"
          hint={`${guestSummary.totalUniqueGuests ? Math.round((guestSummary.repeatCount / guestSummary.totalUniqueGuests) * 100) : 0}% of unique guests`}
        />
      </div>

      <ReservationsPerDayChart points={dayPoints} avgPerDay={avgPerDay} />

      <div className="flex flex-wrap items-stretch gap-6">
        <PeakBarChart title="Busiest day of the week" items={dowItems} barWidth={48} gap={6} />
        <PeakBarChart title="Busiest hour of the day" items={hourItems} barWidth={32} gap={4} />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <StatusBreakdownSection slug={slug} counts={statusCounts} />
        <PerTableSection tables={perTable} />
      </div>

      <TopGuestsSection slug={slug} guests={topGuests} />
    </div>
  );
}
