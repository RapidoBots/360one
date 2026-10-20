import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, CalendarDays, Clock, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getFeatureAccess } from "@/lib/auth-guards";
import {
  getDayRange, getWeekRange, getZonedDayOfWeek, getZonedHour, toLocalDateInput, formatZonedDate, formatZonedTime,
} from "@/lib/reservation-dates";
import { getHoursForDay } from "@/lib/business-hours";
import { STATUS_COLORS, STATUS_LABELS } from "../reservations/reservation-badge";
import { ReservationsByHourChart, type HourBucket } from "./reservations-by-hour-chart";
import { UpcomingArrivals, type UpcomingArrival } from "./upcoming-arrivals";
import { ThisWeekSection, type WeekTile, type WeekDaySummary } from "./this-week-section";
import type { ReservationStatus } from "@/generated/prisma/client";

// The 4 statuses stacked in every segmented bar on this page -- cancelled is
// always excluded from counts, and no-show doesn't get a segment (it still
// counts toward the day/stat total, it just has no colored slice).
const SEGMENT_ORDER: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "PENDING"];

function segmentsFor(reservations: { status: ReservationStatus }[]): { pct: number; color: string }[] {
  const total = reservations.length;
  if (total === 0) return [];
  return SEGMENT_ORDER.map((status) => ({
    status,
    n: reservations.filter((r) => r.status === status).length,
  }))
    .filter((s) => s.n > 0)
    .map((s) => ({ pct: (s.n / total) * 100, color: STATUS_COLORS[s.status].bar }));
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  const sessionUser = await getSessionUser();
  const canSeat = !sessionUser
    ? false
    : (await getFeatureAccess(sessionUser, "reservations")) === "EDIT" ||
      (await getFeatureAccess(sessionUser, "floorManager")) === "EDIT";

  const now = new Date();
  const { start: dayStart, end: dayEnd } = getDayRange(now, restaurant.timezone);
  const { start: weekStart, end: weekEnd } = getWeekRange(now, restaurant.timezone);

  const [totalTables, todaysReservations, weekReservations, businessHours] = await Promise.all([
    prisma.table.count({ where: { restaurantId: restaurant.id } }),
    prisma.reservation.findMany({
      where: { restaurantId: restaurant.id, startsAt: { gte: dayStart, lt: dayEnd } },
      include: { customer: { select: { name: true } }, table: { select: { number: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: { restaurantId: restaurant.id, startsAt: { gte: weekStart, lt: weekEnd } },
      select: { startsAt: true, status: true, tableId: true },
    }),
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
  ]);

  const { startHour: dayStartHour, endHour: dayEndHour } = getHoursForDay(
    businessHours,
    getZonedDayOfWeek(now, restaurant.timezone)
  );

  const liveToday = todaysReservations.filter((r) => r.status !== "CANCELLED");
  const occupiedTableIds = new Set(
    liveToday.filter((r) => r.status === "SEATED" && r.tableId).map((r) => r.tableId)
  );
  const occupancyPercent = totalTables === 0 ? 0 : Math.round((occupiedTableIds.size / totalTables) * 100);

  const upcoming = liveToday
    .filter((r) => (r.status === "CONFIRMED" || r.status === "PENDING") && r.startsAt >= now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const arrivals: UpcomingArrival[] = upcoming.map((r) => ({
    id: r.id,
    time: formatZonedTime(r.startsAt, restaurant.timezone),
    name: r.customer.name,
    party: r.partySize,
    table: r.table ? `Table ${r.table.number}` : null,
    status: r.status,
  }));

  const nowHour = getZonedHour(now, restaurant.timezone);
  const buckets: HourBucket[] = Array.from({ length: Math.max(0, dayEndHour - dayStartHour) }, (_, i) => {
    const hour = dayStartHour + i;
    const inHour = liveToday.filter((r) => getZonedHour(r.startsAt, restaurant.timezone) === hour);
    return {
      hour,
      label: `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? "p" : "a"}`,
      longLabel: `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? "PM" : "AM"}`,
      count: inHour.length,
      names: inHour.map((r) => r.customer.name),
    };
  });

  const todaySegments = segmentsFor(liveToday);
  const todayLegend = SEGMENT_ORDER.map((status) => ({
    status, n: liveToday.filter((r) => r.status === status).length,
  })).filter((s) => s.n > 0);

  // This week
  const liveWeek = weekReservations.filter((r) => r.status !== "CANCELLED");
  const todayStr = toLocalDateInput(now, restaurant.timezone);
  const weekLink = (extra: string) => `/r/${slug}/reservations?view=week&date=${todayStr}${extra}`;
  const tiles: WeekTile[] = [
    {
      label: "All reservations", count: liveWeek.length, hint: "Open the full week",
      href: weekLink(""), dot: "var(--ink)", color: "#475569",
    },
    {
      label: "Confirmed", count: liveWeek.filter((r) => r.status === "CONFIRMED").length, hint: "Guests confirmed",
      href: weekLink("&status=confirmed"), dot: STATUS_COLORS.CONFIRMED.bar, color: STATUS_COLORS.CONFIRMED.text,
    },
    {
      label: "Unconfirmed", count: liveWeek.filter((r) => r.status === "PENDING").length, hint: "Pending, need a call or email",
      href: weekLink("&status=pending"), dot: STATUS_COLORS.PENDING.bar, color: STATUS_COLORS.PENDING.text,
    },
    {
      label: "Table assigned", count: liveWeek.filter((r) => r.tableId).length, hint: "Ready for service",
      href: weekLink("&table=assigned"), dot: STATUS_COLORS.SEATED.bar, color: STATUS_COLORS.SEATED.text,
    },
    {
      label: "No table assigned", count: liveWeek.filter((r) => !r.tableId).length, hint: "Needs a table",
      href: weekLink("&table=none"), dot: "#F59E0B", color: "var(--warning)", amber: true,
    },
  ];

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return toLocalDateInput(d, restaurant.timezone);
  });
  const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days: WeekDaySummary[] = weekDates.map((dateStr, i) => {
    const day = liveWeek.filter((r) => toLocalDateInput(r.startsAt, restaurant.timezone) === dateStr);
    const noTable = day.filter((r) => !r.tableId).length;
    const isToday = dateStr === todayStr;
    return {
      dow: DOWS[i]!,
      num: Number(dateStr.slice(8)),
      total: day.length,
      isToday,
      segments: segmentsFor(day),
      note: noTable > 0 ? `${noTable} no table` : day.length > 0 ? "All tables set" : "No bookings",
      noteIsWarning: noTable > 0,
      href: `/r/${slug}/reservations?view=day&date=${dateStr}`,
    };
  });

  const weekRangeStart = new Date(weekStart);
  const weekRangeEndDisplay = new Date(weekStart);
  weekRangeEndDisplay.setDate(weekRangeEndDisplay.getDate() + 6);
  const weekRangeLabel = `${formatZonedDate(weekRangeStart, restaurant.timezone, { month: "short", day: "numeric" })} – ${formatZonedDate(weekRangeEndDisplay, restaurant.timezone, { month: "short", day: "numeric" })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] font-extrabold tracking-tight text-ink">Welcome to {restaurant.name}</h1>
          <p className="text-[15px] text-ink-muted">
            {formatZonedDate(now, restaurant.timezone, { weekday: "long", month: "long", day: "numeric" })}
            {" · "}
            {upcoming.length > 0 ? `${upcoming.length} ${upcoming.length === 1 ? "arrival" : "arrivals"} still to come` : "All guests have arrived"}
          </p>
        </div>
        <Link
          href={`/r/${slug}/reservations`}
          className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)]"
        >
          <Plus className="size-4" strokeWidth={2.4} />
          New reservation
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        <div className="flex flex-col gap-4 rounded-[20px] border border-line-card bg-white p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold text-ink-muted">Today&apos;s reservations</span>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
              <Calendar className="size-[22px]" strokeWidth={1.8} />
            </span>
          </div>
          <div className="text-[36px] font-extrabold leading-none tracking-tight text-ink">{liveToday.length}</div>
          <div className="flex h-2 overflow-hidden rounded-full bg-neutral-soft">
            {todaySegments.map((s, i) => (
              <span key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {todayLegend.map((l) => (
              <span key={l.status} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#475569]">
                <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[l.status].bar }} />
                {STATUS_LABELS[l.status]} <b className="text-ink">{l.n}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[20px] border border-line-card bg-white p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold text-ink-muted">Occupancy</span>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-success-soft text-success">
              <CalendarDays className="size-[22px]" strokeWidth={1.8} />
            </span>
          </div>
          <div className="text-[36px] font-extrabold leading-none tracking-tight text-ink">{occupancyPercent}%</div>
          <div
            className="h-2 overflow-hidden rounded-full bg-neutral-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={occupancyPercent}
            aria-label="Tables seated"
          >
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${Math.max(occupancyPercent, 0)}%`, minWidth: occupiedTableIds.size > 0 ? 8 : 0 }}
            />
          </div>
          <div className="text-[13.5px] text-ink-muted">
            {occupiedTableIds.size} of {totalTables} tables seated
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[20px] border border-line-card bg-white p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold text-ink-muted">Upcoming arrivals</span>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-warning-soft text-warning">
              <Clock className="size-[22px]" strokeWidth={1.8} />
            </span>
          </div>
          <div className="text-[36px] font-extrabold leading-none tracking-tight text-ink">{upcoming.length}</div>
          <div className="text-[13.5px] leading-relaxed text-ink-muted">
            {upcoming[0] ? `Next: ${arrivals[0]!.name} at ${arrivals[0]!.time}` : "No more arrivals today"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card">
          <div className="p-7">
            <ReservationsByHourChart buckets={buckets} nowHour={nowHour} />
          </div>
        </section>
        <div className="min-w-0 flex-[1_1_380px] max-w-full">
          <UpcomingArrivals slug={slug} arrivals={arrivals} canSeat={canSeat} />
        </div>
      </div>

      <ThisWeekSection
        weekRangeLabel={weekRangeLabel}
        weekTotal={liveWeek.length}
        weekLink={weekLink("")}
        tiles={tiles}
        days={days}
      />
    </div>
  );
}
