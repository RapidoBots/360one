import { toLocalDateInput } from "./reservation-dates";
import { DAY_START_HOUR, DAY_END_HOUR } from "./business-hours";
import { sortTablesByNumber } from "./sort-tables";
import type { ReservationStatus } from "@/generated/prisma/client";

export type ChartBucket = { label: string; value: number };

export function reservationsPerDay(
  reservations: { startsAt: Date }[],
  range: { start: Date; end: Date }
): ChartBucket[] {
  const buckets: ChartBucket[] = [];
  const cursor = new Date(range.start);
  while (cursor < range.end) {
    const dayKey = toLocalDateInput(cursor);
    const value = reservations.filter((r) => toLocalDateInput(r.startsAt) === dayKey).length;
    const label = cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    buckets.push({ label, value });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

export function busiestDayOfWeek(reservations: { startsAt: Date }[]): ChartBucket[] {
  const counts = new Array(7).fill(0);
  for (const r of reservations) counts[r.startsAt.getDay()]++;
  return WEEKDAY_ORDER.map((day) => ({ label: WEEKDAY_LABELS[day]!, value: counts[day] }));
}

function formatHourLabel(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? "p" : "a"}`;
}

export function busiestHourOfDay(reservations: { startsAt: Date }[]): ChartBucket[] {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => {
    const hour = DAY_START_HOUR + i;
    const value = reservations.filter((r) => r.startsAt.getHours() === hour).length;
    return { label: formatHourLabel(hour), value };
  });
}

export function reservationsPerTable(
  reservations: { tableId: string | null }[],
  tables: { id: string; number: string }[]
): ChartBucket[] {
  return sortTablesByNumber(tables).map((t) => ({
    label: t.number,
    value: reservations.filter((r) => r.tableId === t.id).length,
  }));
}

const STATUS_ORDER: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export type RateSummary = {
  noShowRate: number;
  cancellationRate: number;
  statusBreakdown: ChartBucket[];
};

export function calculateRates(reservations: { status: ReservationStatus }[]): RateSummary {
  const total = reservations.length;
  const countOf = (status: ReservationStatus) => reservations.filter((r) => r.status === status).length;
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));

  return {
    noShowRate: pct(countOf("NO_SHOW")),
    cancellationRate: pct(countOf("CANCELLED")),
    statusBreakdown: STATUS_ORDER.map((status) => ({ label: status, value: countOf(status) })),
  };
}

export type GuestSummary = {
  totalUniqueGuests: number;
  newCount: number;
  repeatCount: number;
};

export function classifyGuests(
  rangeCustomerIds: string[],
  allTimeCounts: Record<string, number>
): GuestSummary {
  const unique = Array.from(new Set(rangeCustomerIds));
  const repeatCount = unique.filter((id) => (allTimeCounts[id] ?? 0) > 1).length;
  return {
    totalUniqueGuests: unique.length,
    newCount: unique.length - repeatCount,
    repeatCount,
  };
}

export type TopGuest = { customerId: string; name: string; visits: number };

export function topRepeatGuests(
  guests: { customerId: string; name: string }[],
  allTimeCounts: Record<string, number>,
  limit = 5
): TopGuest[] {
  const seen = new Map<string, string>();
  for (const g of guests) if (!seen.has(g.customerId)) seen.set(g.customerId, g.name);

  return Array.from(seen.entries())
    .map(([customerId, name]) => ({ customerId, name, visits: allTimeCounts[customerId] ?? 0 }))
    .filter((g) => g.visits > 1)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit);
}

export type CsvRow = {
  date: string;
  time: string;
  guestName: string;
  partySize: number;
  table: string;
  status: string;
};

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildReservationsCsv(rows: CsvRow[]): string {
  const header = ["Date", "Time", "Guest Name", "Party Size", "Table", "Status"];
  const lines = rows.map((r) =>
    [r.date, r.time, escapeCsvField(r.guestName), String(r.partySize), r.table, r.status].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
