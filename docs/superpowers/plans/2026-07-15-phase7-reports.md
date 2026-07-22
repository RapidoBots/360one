# Phase 7: Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/r/[slug]/reports` stub with a real, date-range-driven Reports page: historical trend charts, no-show/cancellation rates, customer insights, and a CSV export — all computed live from existing reservation data.

**Architecture:** A pure, fully-unit-tested aggregation module (`src/lib/report-metrics.ts`) takes raw reservation/table records and produces chart-ready buckets and stats. The page itself is a Server Component (matching every other dashboard page's pattern) that runs a handful of Prisma queries and hands the results to the pure functions and two small client components: a generic recharts bar chart, and a CSV export button.

**Tech Stack:** Next.js 15 Server Components + Server Actions, Prisma 7, `recharts` (already a dependency), Vitest, Playwright.

## Global Constraints

- Date range is two plain `<input type="date">` fields (Start, End), defaulting to the last 30 days — no date-picker dependency, no preset buttons.
- "Table utilization" is approximated as reservations-per-table, not true occupied-hours percentage (deferred to Phase 8, which will model real business hours).
- Busiest-hour bucketing uses the shared `DAY_START_HOUR`/`DAY_END_HOUR` constants from `src/lib/business-hours.ts`.
- "Repeat" guest classification and the top-guests ranking both use each guest's **all-time** reservation count, regardless of status (cancellations/no-shows count toward it) — not just reservations within the selected range.
- CSV export goes through a Server Action returning a CSV string, downloaded client-side via a `Blob` — no new API route handler.
- Access control: any authenticated restaurant member (Owner or Staff), via the existing `requireRestaurantAccess`/`assertRestaurantMember` guards — no new role tier.
- No revenue/financial data, no saved/scheduled reports, no cross-restaurant reporting — out of scope this phase.

---

### Task 1: Pure report-metrics helpers

**Files:**
- Create: `src/lib/report-metrics.ts`
- Test: `tests/report-metrics.test.ts`

**Interfaces:**
- Consumes: `toLocalDateInput` from `@/lib/reservation-dates`; `DAY_START_HOUR`/`DAY_END_HOUR` from `@/lib/business-hours`; `sortTablesByNumber` from `@/lib/sort-tables`; `ReservationStatus` type from `@/generated/prisma/client`.
- Produces (consumed by Task 4's page.tsx and Task 2's chart component):
  - `type ChartBucket = { label: string; value: number }`
  - `reservationsPerDay(reservations: { startsAt: Date }[], range: { start: Date; end: Date }): ChartBucket[]`
  - `busiestDayOfWeek(reservations: { startsAt: Date }[]): ChartBucket[]`
  - `busiestHourOfDay(reservations: { startsAt: Date }[]): ChartBucket[]`
  - `reservationsPerTable(reservations: { tableId: string | null }[], tables: { id: string; number: string }[]): ChartBucket[]`
  - `type RateSummary = { noShowRate: number; cancellationRate: number; statusBreakdown: ChartBucket[] }`
  - `calculateRates(reservations: { status: ReservationStatus }[]): RateSummary`
  - `type GuestSummary = { totalUniqueGuests: number; newCount: number; repeatCount: number }`
  - `classifyGuests(rangeCustomerIds: string[], allTimeCounts: Record<string, number>): GuestSummary`
  - `type TopGuest = { customerId: string; name: string; visits: number }`
  - `topRepeatGuests(guests: { customerId: string; name: string }[], allTimeCounts: Record<string, number>, limit?: number): TopGuest[]`
  - `type CsvRow = { date: string; time: string; guestName: string; partySize: number; table: string; status: string }`
  - `buildReservationsCsv(rows: CsvRow[]): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/report-metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  reservationsPerDay,
  busiestDayOfWeek,
  busiestHourOfDay,
  reservationsPerTable,
  calculateRates,
  classifyGuests,
  topRepeatGuests,
  buildReservationsCsv,
} from "@/lib/report-metrics";

describe("reservationsPerDay", () => {
  it("buckets reservations by local calendar day across the range", () => {
    const range = {
      start: new Date(2026, 7, 1, 0, 0),
      end: new Date(2026, 7, 4, 0, 0), // Aug 1, 2, 3 (3 days)
    };
    const reservations = [
      { startsAt: new Date(2026, 7, 1, 10, 0) },
      { startsAt: new Date(2026, 7, 1, 19, 0) },
      { startsAt: new Date(2026, 7, 3, 12, 0) },
    ];
    const buckets = reservationsPerDay(reservations, range);
    expect(buckets).toHaveLength(3);
    expect(buckets.map((b) => b.value)).toEqual([2, 0, 1]);
  });
});

describe("busiestDayOfWeek", () => {
  it("buckets into Mon..Sun order regardless of input order", () => {
    const reservations = [
      { startsAt: new Date(2026, 7, 3) }, // Monday
      { startsAt: new Date(2026, 7, 3) }, // Monday
      { startsAt: new Date(2026, 7, 9) }, // Sunday
    ];
    const buckets = busiestDayOfWeek(reservations);
    expect(buckets.map((b) => b.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(buckets[0]).toEqual({ label: "Mon", value: 2 });
    expect(buckets[6]).toEqual({ label: "Sun", value: 1 });
  });
});

describe("busiestHourOfDay", () => {
  it("buckets by hour within business hours", () => {
    const reservations = [
      { startsAt: new Date(2026, 7, 1, 19, 0) },
      { startsAt: new Date(2026, 7, 1, 19, 30) },
      { startsAt: new Date(2026, 7, 2, 12, 0) },
    ];
    const buckets = busiestHourOfDay(reservations);
    const at19 = buckets.find((b) => b.label === "7p");
    const at12 = buckets.find((b) => b.label === "12p");
    expect(at19?.value).toBe(2);
    expect(at12?.value).toBe(1);
  });
});

describe("reservationsPerTable", () => {
  it("counts reservations per table, sorted naturally by table number", () => {
    const tables = [
      { id: "t10", number: "10" },
      { id: "t1", number: "1" },
      { id: "t2", number: "2" },
    ];
    const reservations = [
      { tableId: "t1" },
      { tableId: "t1" },
      { tableId: "t10" },
      { tableId: null },
    ];
    const buckets = reservationsPerTable(reservations, tables);
    expect(buckets).toEqual([
      { label: "1", value: 2 },
      { label: "2", value: 0 },
      { label: "10", value: 1 },
    ]);
  });
});

describe("calculateRates", () => {
  it("computes no-show and cancellation rates as whole percentages", () => {
    const reservations = [
      { status: "COMPLETED" as const },
      { status: "COMPLETED" as const },
      { status: "NO_SHOW" as const },
      { status: "CANCELLED" as const },
    ];
    const rates = calculateRates(reservations);
    expect(rates.noShowRate).toBe(25);
    expect(rates.cancellationRate).toBe(25);
  });

  it("returns a full status breakdown in a fixed order", () => {
    const rates = calculateRates([{ status: "SEATED" as const }]);
    expect(rates.statusBreakdown.map((b) => b.label)).toEqual([
      "PENDING",
      "CONFIRMED",
      "SEATED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ]);
    expect(rates.statusBreakdown.find((b) => b.label === "SEATED")?.value).toBe(1);
  });

  it("returns 0% rates for an empty range instead of dividing by zero", () => {
    const rates = calculateRates([]);
    expect(rates.noShowRate).toBe(0);
    expect(rates.cancellationRate).toBe(0);
  });
});

describe("classifyGuests", () => {
  it("splits guests into new vs. repeat using all-time counts", () => {
    const summary = classifyGuests(
      ["cust-a", "cust-b", "cust-a"], // cust-a appears twice in range, still one unique guest
      { "cust-a": 3, "cust-b": 1 }
    );
    expect(summary.totalUniqueGuests).toBe(2);
    expect(summary.repeatCount).toBe(1);
    expect(summary.newCount).toBe(1);
  });
});

describe("topRepeatGuests", () => {
  it("ranks repeat guests by all-time visit count, excluding new guests", () => {
    const guests = [
      { customerId: "cust-a", name: "Alice" },
      { customerId: "cust-b", name: "Bob" },
      { customerId: "cust-c", name: "Carol" },
    ];
    const allTimeCounts = { "cust-a": 5, "cust-b": 1, "cust-c": 3 };
    const top = topRepeatGuests(guests, allTimeCounts);
    expect(top).toEqual([
      { customerId: "cust-a", name: "Alice", visits: 5 },
      { customerId: "cust-c", name: "Carol", visits: 3 },
    ]);
  });

  it("respects the limit", () => {
    const guests = [
      { customerId: "cust-a", name: "Alice" },
      { customerId: "cust-b", name: "Bob" },
    ];
    const allTimeCounts = { "cust-a": 5, "cust-b": 4 };
    expect(topRepeatGuests(guests, allTimeCounts, 1)).toHaveLength(1);
  });
});

describe("buildReservationsCsv", () => {
  it("builds a header row plus one row per reservation", () => {
    const csv = buildReservationsCsv([
      { date: "2026-08-01", time: "07:00 PM", guestName: "Taylor Guest", partySize: 3, table: "5", status: "SEATED" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Date,Time,Guest Name,Party Size,Table,Status");
    expect(lines[1]).toBe("2026-08-01,07:00 PM,Taylor Guest,3,5,SEATED");
  });

  it("quotes a guest name containing a comma", () => {
    const csv = buildReservationsCsv([
      { date: "2026-08-01", time: "07:00 PM", guestName: "Guest, Jr.", partySize: 2, table: "", status: "PENDING" },
    ]);
    expect(csv.split("\n")[1]).toBe('2026-08-01,07:00 PM,"Guest, Jr.",2,,PENDING');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/report-metrics.test.ts`
Expected: FAIL — `Cannot find module '@/lib/report-metrics'`.

- [ ] **Step 3: Implement the pure module**

Create `src/lib/report-metrics.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/report-metrics.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/report-metrics.ts tests/report-metrics.test.ts
git commit -m "feat: add pure report-metrics aggregation helpers"
```

---

### Task 2: Generic report bar chart component

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reports/report-bar-chart.tsx`

**Interfaces:**
- Consumes: `ChartBucket` type from `@/lib/report-metrics` (Task 1).
- Produces: `ReportBarChart({ data: ChartBucket[] })` — a client component, imported by Task 4's `page.tsx`.

- [ ] **Step 1: Create the component**

Create `src/app/(dashboard)/r/[slug]/reports/report-bar-chart.tsx`:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartBucket } from "@/lib/report-metrics";

export function ReportBarChart({ data }: { data: ChartBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={24} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }}
        />
        <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

(This mirrors the Dashboard's existing `ReservationsByHourChart` styling exactly, generalized to a `label`/`value` shape so all four Reports charts can share it.)

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors (the component isn't imported anywhere yet, but it must still type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reports/report-bar-chart.tsx"
git commit -m "feat: add generic report bar chart component"
```

---

### Task 3: CSV export Server Action + button

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reports/actions.ts`
- Create: `src/app/(dashboard)/r/[slug]/reports/export-csv-button.tsx`

**Interfaces:**
- Consumes: `assertRestaurantMember` from `@/lib/auth-guards`; `buildReservationsCsv` from `@/lib/report-metrics` (Task 1); `toLocalDateInput` from `@/lib/reservation-dates`.
- Produces:
  - `type ReportsActionResult = { ok: true; csv: string } | { ok: false; error: string }`
  - `exportReservationsCsvAction(slug: string, input: { start: string; end: string }): Promise<ReportsActionResult>` — consumed by `export-csv-button.tsx` in this task and referenced by Task 4's page (for the `start`/`end` props it passes down).
  - `ExportCsvButton({ slug, start, end }: { slug: string; start: string; end: string })` — consumed by Task 4's `page.tsx`.

- [ ] **Step 1: Add the Server Action**

Create `src/app/(dashboard)/r/[slug]/reports/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { buildReservationsCsv } from "@/lib/report-metrics";
import { toLocalDateInput } from "@/lib/reservation-dates";

export type ReportsActionResult = { ok: true; csv: string } | { ok: false; error: string };

export async function exportReservationsCsvAction(
  slug: string,
  input: { start: string; end: string }
): Promise<ReportsActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const start = new Date(`${input.start}T00:00:00`);
  const end = new Date(`${input.end}T00:00:00`);
  end.setDate(end.getDate() + 1); // end date is inclusive

  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end } },
    include: { customer: { select: { name: true } }, table: { select: { number: true } } },
    orderBy: { startsAt: "asc" },
  });

  const csv = buildReservationsCsv(
    reservations.map((r) => ({
      date: toLocalDateInput(r.startsAt),
      time: r.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      guestName: r.customer.name,
      partySize: r.partySize,
      table: r.table?.number ?? "",
      status: r.status,
    }))
  );

  return { ok: true, csv };
}
```

- [ ] **Step 2: Add the export button**

Create `src/app/(dashboard)/r/[slug]/reports/export-csv-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportReservationsCsvAction } from "./actions";

export function ExportCsvButton({ slug, start, end }: { slug: string; start: string; end: string }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    const result = await exportReservationsCsvAction(slug, { start, end });
    setExporting(false);
    if (!result.ok) return;

    const blob = new Blob([result.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservations-${start}-to-${end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" className="h-11 px-5 text-base" onClick={handleExport} disabled={exporting}>
      {exporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reports/actions.ts" "src/app/(dashboard)/r/[slug]/reports/export-csv-button.tsx"
git commit -m "feat: add CSV export action and button for Reports"
```

---

### Task 4: Reports page wiring

**Files:**
- Modify: `src/app/(dashboard)/r/[slug]/reports/page.tsx` (replace the `ComingSoon` stub entirely)

**Interfaces:**
- Consumes: all of `src/lib/report-metrics.ts` (Task 1); `ReportBarChart` (Task 2); `ExportCsvButton` (Task 3); `toLocalDateInput` from `@/lib/reservation-dates`; `sortTablesByNumber`-equivalent handled inside `reservationsPerTable` already, so `page.tsx` passes tables unsorted.
- Produces: nothing new — this is the leaf that assembles everything.

- [ ] **Step 1: Replace the stub page**

Replace the full contents of `src/app/(dashboard)/r/[slug]/reports/page.tsx` with:

```tsx
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

  const [reservations, tables] = await Promise.all([
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
          <ReportBarChart data={busiestHourOfDay(reservations)} />
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
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full unit test suite**

Run: `npx vitest run`
Expected: all existing tests plus `report-metrics.test.ts` pass.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reports/page.tsx"
git commit -m "feat: build out the Reports page"
```

---

### Task 5: Playwright e2e coverage

**Files:**
- Create: `e2e/phase7-reports.spec.ts`

**Interfaces:**
- Consumes: the "Start"/"End" labeled date inputs and "Apply range" button from Task 4; the "Export CSV" button from Task 3; the seeded `owner@blue-fork.example.com` account and `/r/blue-fork/reservations` "New reservation"/"Manage tables" flow from prior phases' e2e conventions.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/phase7-reports.spec.ts`:

```ts
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_TABLE_NUMBER = "RPT-1";
const SHOWN_GUEST = "Reports Shown Guest";
const NO_SHOW_GUEST = "Reports No-Show Guest";
const START_DATE = "2026-09-01";
const END_DATE = "2026-09-02";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = ANY($1))`,
      [[SHOWN_GUEST, NO_SHOW_GUEST]]
    );
    await client.query(`DELETE FROM customer WHERE name = ANY($1)`, [[SHOWN_GUEST, NO_SHOW_GUEST]]);
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 7 Reports", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("shows accurate rates for a selected range and exports a matching CSV", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER}`)).toBeVisible();
    await page.keyboard.press("Escape");

    // One reservation that will be marked SEATED (shows up), one left PENDING
    // then marked NO_SHOW -- gives a known, non-zero no-show rate to assert on.
    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(SHOWN_GUEST);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill(START_DATE);
    await page.getByLabel("Time").fill("18:00");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: new RegExp(`Table ${FIXTURE_TABLE_NUMBER}`) }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(NO_SHOW_GUEST);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill(START_DATE);
    await page.getByLabel("Time").fill("20:00");
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto(`/r/blue-fork/reservations?view=day&date=${START_DATE}`);
    await page.getByText(NO_SHOW_GUEST).click();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "NO_SHOW" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto(`/r/blue-fork/reservations?view=day&date=${START_DATE}`);
    await page.getByText(SHOWN_GUEST).click();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "SEATED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto(`/r/blue-fork/reports?start=${START_DATE}&end=${END_DATE}`);
    await expect(page.getByLabel("Start")).toHaveValue(START_DATE);
    await expect(page.getByLabel("End")).toHaveValue(END_DATE);
    await expect(page.getByText("No-show rate")).toBeVisible();
    await expect(page.getByText("50%")).toBeVisible(); // no-show rate: 1 of 2
    await expect(page.getByText("0%")).toBeVisible(); // cancellation rate: 0 of 2

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    const csvPath = await download.path();
    const fs = await import("node:fs/promises");
    const csvContent = csvPath ? await fs.readFile(csvPath, "utf-8") : "";
    expect(csvContent).toContain(SHOWN_GUEST);
    expect(csvContent).toContain(NO_SHOW_GUEST);
    expect(csvContent).toContain("Date,Time,Guest Name,Party Size,Table,Status");
  });
});
```

- [ ] **Step 2: Build production and run the e2e suite**

Run: `npx next build && npx next start`
(In a separate terminal, once the server is up) Run: `npx playwright test e2e/phase7-reports.spec.ts`
Expected: the test PASSES. If port 3000 already has a stale server from a previous run, stop it first (`netstat -ano | findstr :3000` then `taskkill //F //PID <pid>`) before starting a fresh build.

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npx playwright test`
Expected: all suites pass (the existing 14 tests plus this phase's 1 new one).

- [ ] **Step 4: Commit**

```bash
git add e2e/phase7-reports.spec.ts
git commit -m "test: add Phase 7 Reports e2e coverage"
```
