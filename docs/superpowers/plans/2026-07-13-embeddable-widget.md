# Embeddable Reservation Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, unauthenticated, iframe-embeddable booking widget at `/book/[slug]` — pick party size/date/time from real availability, review and change the selection, submit contact info, and land on a success screen. The resulting reservation appears as `PENDING` on the existing Reservations page for staff to approve, with an iframe snippet copyable from Settings.

**Architecture:** Two data-model additions (`PENDING` status, `Customer.preferredContact`) — no new models. A new pure helper (`getAvailableSlots`) mirrors the existing `recommendTable`/`doesOverlap` pattern: capacity + conflict-aware, unit-tested in isolation. The widget itself is a single client-rendered page with local step state (no routing between steps), backed by two Server Actions — one for fetching slots (called on mount and on every date/party-size change), one for submission (which re-validates availability to close the race-condition window between page load and submit). The public route sits entirely outside the existing auth middleware's matcher, so no new guard type is needed — just an `ACTIVE`-restaurant check.

**Tech Stack:** Next.js 15 Server Components + Server Actions, Prisma 7, shadcn/ui (Select, Input, Textarea, Button, Label — all already installed), Framer Motion (already a dependency, used for the success animation), native `<input type="date">`, Vitest, Playwright.

## Global Constraints

- Reservation duration for widget bookings: fixed 90 minutes, matching the app-wide default — no duration picker in the widget.
- Slot granularity: 15 minutes (the widget's own reference design), distinct from the internal calendar's 30-minute increments — not unified, since they serve different audiences.
- Business hours: 7am–11pm, extracted into a new shared `src/lib/business-hours.ts` (previously duplicated only in `timeline-view.tsx`) so the widget and the internal calendar can't drift apart. Still hardcoded — real per-restaurant hours are Phase 8 Settings work.
- Party size: capped at 1–10 in the widget's dropdown, with static copy below it for anything larger: "If you are more than 10 people or if you cannot find availability, please call us."
- No "Closed" day state in the date strip — only Available/Full — since per-day business hours aren't configurable yet.
- Widget bookings are always created with `tableId: null` (staff assign a table later) and `status: "PENDING"` — never auto-confirmed, never auto-assigned.
- `ponytail:` The date strip's navigation is a single prev/next-week arrow pair plus a native date-jump input — no second "jump further" control beyond that, since it's not needed to satisfy the actual booking flow.
- `ponytail:` No CAPTCHA/rate-limiting on the public submission endpoint this phase — a known, deliberately-flagged gap (see the design spec), not silently skipped.
- Every task must leave `pnpm dev` (or `pnpm build && pnpm start`) in a runnable state.

---

## File Structure

```
prisma/
  schema.prisma                                # modify: PENDING status, ContactChannel enum, Customer.preferredContact

src/lib/
  business-hours.ts                            # NEW: shared DAY_START_HOUR/DAY_END_HOUR
  widget-availability.ts                       # pure: getAvailableSlots()

src/app/(public)/book/[slug]/
  page.tsx                                     # Server Component -- restaurant lookup, suspended/missing handling
  actions.ts                                   # "use server" -- getSlotsForDateAction, createWidgetReservationAction
  booking-widget.tsx                           # Client Component -- step state, review screen, footer, date/time label helpers
  party-date-time-picker.tsx                   # Step 1 UI (also reused for Step 2's "Change")
  contact-form.tsx                             # Step 3 UI
  success-screen.tsx                           # Success UI with Framer Motion animation

src/app/(dashboard)/r/[slug]/reservations/
  reservation-badge.tsx                        # modify: add PENDING to every status map
  reservations-calendar.tsx                    # modify: add PENDING to the filter chips
  reservation-modal.tsx                        # modify: add PENDING to the status dropdown

src/app/(dashboard)/r/[slug]/reservations/
  timeline-view.tsx                            # modify: import shared business-hours constants instead of local ones

src/app/(dashboard)/r/[slug]/settings/
  page.tsx                                     # replaces stub -- adds EmbedSnippet, rest stays ComingSoon
  embed-snippet.tsx                            # Client Component -- code box + copy button

tests/
  widget-availability.test.ts

e2e/
  embeddable-widget.spec.ts
```

---

### Task 1: Data model — PENDING status, ContactChannel, Customer.preferredContact

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `ReservationStatus` gains `PENDING`; new `ContactChannel` enum (`EMAIL | SMS | CALL`); `Customer.preferredContact` — consumed by every later task in this plan.

- [ ] **Step 1: Add PENDING and the new enum/field**

In `prisma/schema.prisma`, update the `ReservationStatus` enum:

```prisma
enum ReservationStatus {
  PENDING
  CONFIRMED
  SEATED
  COMPLETED
  CANCELLED
  NO_SHOW
}
```

Add a new enum right before the `Customer` model:

```prisma
enum ContactChannel {
  EMAIL
  SMS
  CALL
}
```

Update the `Customer` model to add `preferredContact`:

```prisma
model Customer {
  id               String         @id @default(cuid())
  restaurantId     String
  restaurant       Restaurant     @relation(fields: [restaurantId], references: [id])
  name             String
  email            String?
  phone            String?
  preferredContact ContactChannel @default(EMAIL)
  reservations     Reservation[]
  createdAt        DateTime       @default(now())

  @@map("customer")
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name embeddable_widget
```

Expected: `Your database is now in sync with your schema.` and a new `prisma/migrations/<timestamp>_embeddable_widget/` folder.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors (confirms the generated Prisma client picked up `PENDING`, `ContactChannel`, and `preferredContact`).

- [ ] **Step 4: Commit**

```bash
git add prisma
git commit -m "feat: add PENDING reservation status and customer preferred-contact field"
```

---

### Task 2: Extract shared business-hours constants

**Files:**
- Create: `src/lib/business-hours.ts`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx`

**Interfaces:**
- Produces: `DAY_START_HOUR`, `DAY_END_HOUR` (both `number`) — consumed by Task 3 (`widget-availability.ts`) and this task's own update to `timeline-view.tsx`.

- [ ] **Step 1: Create the shared constants file**

`src/lib/business-hours.ts`:

```typescript
// ponytail: hardcoded hours; per-restaurant hours are Phase 8 Settings work.
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 23;
```

- [ ] **Step 2: Point timeline-view.tsx at the shared constants**

In `src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx`, replace:

```typescript
// ponytail: hardcoded hours for now, per-restaurant hours are a
// Settings-phase feature (Phase 8).
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 23;
const SLOT_MINUTES = 30;
```

with:

```typescript
import { DAY_START_HOUR, DAY_END_HOUR } from "@/lib/business-hours";

const SLOT_MINUTES = 30;
```

(Add the import alongside this file's other imports at the top, and remove the two `const` lines it replaces from their original position.)

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

```bash
pnpm test
```

Expected: all existing tests still pass (this is a pure refactor, no behavior change).

- [ ] **Step 4: Commit**

```bash
git add src/lib/business-hours.ts "src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx"
git commit -m "refactor: extract shared business-hours constants"
```

---

### Task 3: Pure helper — slot availability (TDD)

**Files:**
- Create: `src/lib/widget-availability.ts`
- Test: `tests/widget-availability.test.ts`

**Interfaces:**
- Consumes: `doesOverlap` (`@/lib/reservation-conflicts`), `DAY_START_HOUR`/`DAY_END_HOUR` (`@/lib/business-hours`, Task 2).
- Produces: `getAvailableSlots(tables, reservations, input): string[]` — consumed by Task 5 (`getSlotsForDateAction`) and Task 6 (`createWidgetReservationAction`).

- [ ] **Step 1: Write the failing tests**

`tests/widget-availability.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getAvailableSlots } from "@/lib/widget-availability";

const TABLES = [
  { id: "small", capacity: 2 },
  { id: "large", capacity: 6 },
];

describe("getAvailableSlots", () => {
  it("returns every 15-minute slot within business hours when nothing is booked", () => {
    const slots = getAvailableSlots(TABLES, [], { partySize: 2, date: "2026-07-13" });
    expect(slots[0]).toBe("07:00");
    expect(slots).toContain("07:15");
    // Last slot must still fit a full 90-minute booking before 11pm closing.
    expect(slots[slots.length - 1]).toBe("21:30");
  });

  it("excludes a slot once every fitting table is booked", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots([TABLES[0]!], reservations, { partySize: 2, date: "2026-07-13" });
    expect(slots).not.toContain("19:00");
    expect(slots).not.toContain("19:30"); // still overlaps the 90-minute booking
    expect(slots).toContain("20:30"); // booking has ended by then
  });

  it("does not exclude a slot when the conflicting reservation is on a different table", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots(TABLES, reservations, { partySize: 2, date: "2026-07-13" });
    expect(slots).toContain("19:00"); // "large" table is still free
  });

  it("returns an empty list when the party is bigger than every table", () => {
    const slots = getAvailableSlots(TABLES, [], { partySize: 20, date: "2026-07-13" });
    expect(slots).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/widget-availability'`.

- [ ] **Step 3: Implement**

`src/lib/widget-availability.ts`:

```typescript
import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";
import { DAY_START_HOUR, DAY_END_HOUR } from "@/lib/business-hours";

const SLOT_MINUTES = 15;
const DURATION_MINUTES = 90;

export type AvailabilityTable = { id: string; capacity: number };
export type AvailabilityReservation = { tableId: string | null } & TimeRange;

export function getAvailableSlots(
  tables: AvailabilityTable[],
  reservations: AvailabilityReservation[],
  input: { partySize: number; date: string } // date: YYYY-MM-DD
): string[] {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);
  if (fitting.length === 0) return [];

  const slots: string[] = [];
  const dayStart = DAY_START_HOUR * 60;
  const dayEnd = DAY_END_HOUR * 60;

  for (let minutes = dayStart; minutes + DURATION_MINUTES <= dayEnd; minutes += SLOT_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const startsAt = new Date(`${input.date}T${time}`);

    const hasFreeTable = fitting.some((t) => {
      const conflict = reservations.some(
        (r) => r.tableId === t.id && doesOverlap(r, { startsAt, durationMinutes: DURATION_MINUTES })
      );
      return !conflict;
    });

    if (hasFreeTable) slots.push(time);
  }

  return slots;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — all 4 new tests green, plus all existing tests still passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/widget-availability.ts tests/widget-availability.test.ts
git commit -m "feat: add pure getAvailableSlots helper with tests"
```

---

### Task 4: Add PENDING to the existing status UI

**Files:**
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservation-badge.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx`

**Interfaces:**
- No new exports — every existing map/array in these files just gains a `PENDING` entry.

- [ ] **Step 1: Add PENDING to every status map in reservation-badge.tsx**

```typescript
export const STATUS_STYLES: Record<ReservationStatus, string> = {
  PENDING: "bg-violet-500/10 text-violet-600",
  CONFIRMED: "bg-primary/10 text-primary",
  SEATED: "bg-emerald-500/10 text-emerald-600",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  NO_SHOW: "bg-amber-500/10 text-amber-600",
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SEATED: "Seated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const STATUS_ACCENT: Record<ReservationStatus, string> = {
  PENDING: "border-l-violet-500",
  CONFIRMED: "border-l-primary",
  SEATED: "border-l-emerald-500",
  COMPLETED: "border-l-muted-foreground",
  CANCELLED: "border-l-destructive",
  NO_SHOW: "border-l-amber-500",
};

export const STATUS_SOLID: Record<ReservationStatus, string> = {
  PENDING: "bg-violet-500 text-white",
  CONFIRMED: "bg-primary text-primary-foreground",
  SEATED: "bg-emerald-500 text-white",
  COMPLETED: "bg-muted-foreground text-background",
  CANCELLED: "bg-destructive text-white",
  NO_SHOW: "bg-amber-500 text-white",
};
```

- [ ] **Step 2: Add PENDING to the calendar's filter chips**

In `reservations-calendar.tsx`, replace:

```typescript
const ALL_STATUSES: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];
```

with:

```typescript
const ALL_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];
```

- [ ] **Step 3: Add PENDING to the reservation modal's status dropdown**

In `reservation-modal.tsx`, replace:

```typescript
const STATUS_OPTIONS: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];
```

with:

```typescript
const STATUS_OPTIONS: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

```bash
npx eslint "src/app/(dashboard)/r/[slug]/reservations/reservation-badge.tsx" "src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx" "src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/reservation-badge.tsx" "src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx" "src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx"
git commit -m "feat: surface PENDING reservation status across badges, filters, and the edit modal"
```

---

### Task 5: Public page + slot-fetching Server Action

**Files:**
- Create: `src/app/(public)/book/[slug]/page.tsx`
- Create: `src/app/(public)/book/[slug]/actions.ts`

**Interfaces:**
- Consumes: `getAvailableSlots` (Task 3).
- Produces: `getSlotsForDateAction(slug, date, partySize): Promise<string[]>` — consumed by Task 7 (`party-date-time-picker.tsx`). `BookingWidgetPage` — the route's entry point.

- [ ] **Step 1: Slot-fetching action**

`src/app/(public)/book/[slug]/actions.ts`:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { getAvailableSlots } from "@/lib/widget-availability";

export async function getSlotsForDateAction(
  slug: string,
  date: string,
  partySize: number
): Promise<string[]> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") return [];

  const { start, end } = getDayRange(new Date(`${date}T00:00:00`));
  const [tables, reservations] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
  ]);

  return getAvailableSlots(tables, reservations, { partySize, date });
}
```

- [ ] **Step 2: Public page**

`src/app/(public)/book/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingWidget } from "./booking-widget";

export default async function BookingWidgetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });

  if (!restaurant) notFound();

  if (restaurant.status !== "ACTIVE") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="max-w-sm text-base text-muted-foreground">
          This restaurant isn&apos;t currently accepting online reservations.
        </p>
      </div>
    );
  }

  return <BookingWidget slug={slug} restaurantName={restaurant.name} />;
}
```

This references `BookingWidget`, created in Task 8 — the page won't compile until then, which is fine since Tasks 5-8 land together before the next verify/commit checkpoint that requires a clean build. (Verify for this task is limited to the action's own type-check.)

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: an error only about the missing `./booking-widget` module (expected at this point — resolved by Task 8). No other errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/book/[slug]/page.tsx" "src/app/(public)/book/[slug]/actions.ts"
git commit -m "feat: add public booking widget route and slot-fetching action"
```

---

### Task 6: Submission Server Action

**Files:**
- Modify: `src/app/(public)/book/[slug]/actions.ts`

**Interfaces:**
- Consumes: `getAvailableSlots` (Task 3), `findOrCreateCustomer` (`@/lib/reservations-data`, Phase 3).
- Produces: `WidgetActionResult`, `createWidgetReservationAction(slug, input): Promise<WidgetActionResult>` — consumed by Task 9 (`contact-form.tsx`).

- [ ] **Step 1: Add the submission action**

Append to `src/app/(public)/book/[slug]/actions.ts`:

```typescript
import { revalidatePath } from "next/cache";
import { findOrCreateCustomer } from "@/lib/reservations-data";
import type { ContactChannel } from "@/generated/prisma/client";

export type WidgetActionResult =
  | { ok: true; booking: { partySize: number; date: string; time: string } }
  | { ok: false; error: string };

export async function createWidgetReservationAction(
  slug: string,
  input: {
    partySize: number;
    date: string;
    time: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    preferredContact: ContactChannel;
    specialRequests: string;
  }
): Promise<WidgetActionResult> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") {
    return { ok: false, error: "This restaurant isn't currently accepting online reservations." };
  }

  const startsAt = new Date(`${input.date}T${input.time}`);
  const { start, end } = getDayRange(startsAt);
  const [tables, reservations] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
  ]);

  // Re-check right before writing -- another visitor may have taken this
  // slot between this visitor loading the page and submitting.
  const stillAvailable = getAvailableSlots(tables, reservations, {
    partySize: input.partySize,
    date: input.date,
  }).includes(input.time);
  if (!stillAvailable) {
    return { ok: false, error: "That time was just booked by someone else -- please pick another." };
  }

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail,
    phone: input.guestPhone,
  });
  await prisma.customer.update({
    where: { id: customer.id },
    data: { preferredContact: input.preferredContact },
  });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId: null,
      partySize: input.partySize,
      startsAt,
      durationMinutes: 90,
      specialRequests: input.specialRequests || null,
      status: "PENDING",
    },
  });

  revalidatePath(`/r/${slug}/reservations`);

  return { ok: true, booking: { partySize: input.partySize, date: input.date, time: input.time } };
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: the same single expected error as Task 5 (missing `./booking-widget`), nothing new.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/book/[slug]/actions.ts"
git commit -m "feat: add widget reservation submission action with race-condition re-check"
```

---

### Task 7: Party/date/time picker (Step 1 UI)

**Files:**
- Create: `src/app/(public)/book/[slug]/party-date-time-picker.tsx`

**Interfaces:**
- Consumes: `getSlotsForDateAction` (Task 5).
- Produces: `PartyDateTimeSelection` type, `<PartyDateTimePicker />` — consumed by Task 8 (`booking-widget.tsx`).

- [ ] **Step 1: Implement**

`src/app/(public)/book/[slug]/party-date-time-picker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getWeekRange, toLocalDateInput } from "@/lib/reservation-dates";
import { getSlotsForDateAction } from "./actions";

export type PartyDateTimeSelection = { partySize: number; date: string };

const PARTY_SIZES = Array.from({ length: 10 }, (_, i) => i + 1);
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalDateInput(d);
}

export function PartyDateTimePicker({
  slug,
  value,
  onChange,
  onSlotSelected,
}: {
  slug: string;
  value: PartyDateTimeSelection;
  onChange: (value: PartyDateTimeSelection) => void;
  onSlotSelected: (time: string) => void;
}) {
  const [slots, setSlots] = useState<string[]>([]);
  const [weekAvailability, setWeekAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const { start: weekStart } = getWeekRange(new Date(`${value.date}T00:00:00`));
  const weekDates = Array.from({ length: 7 }, (_, i) => toLocalDateInput(addDaysToDate(weekStart, i)));

  function addDaysToDate(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(weekDates.map((d) => getSlotsForDateAction(slug, d, value.partySize))).then((results) => {
      if (cancelled) return;
      const availability: Record<string, boolean> = {};
      weekDates.forEach((d, i) => {
        availability[d] = (results[i]?.length ?? 0) > 0;
      });
      setWeekAvailability(availability);
    });
    getSlotsForDateAction(slug, value.date, value.partySize).then((result) => {
      if (cancelled) return;
      setSlots(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.date, value.partySize]);

  const amSlots = slots.filter((s) => Number(s.split(":")[0]) < 12);
  const pmSlots = slots.filter((s) => Number(s.split(":")[0]) >= 12);

  function formatSlotLabel(time: string): string {
    const [h, m] = time.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Party</label>
          <Select value={String(value.partySize)} onValueChange={(v) => onChange({ ...value, partySize: Number(v) })}>
            <SelectTrigger className="h-11 w-full text-base">
              <SelectValue>{(v: string) => v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PARTY_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Date</label>
          <Input
            type="date"
            className="h-11 text-base"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        If you are more than 10 people or if you cannot find availability, please call us.
      </p>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-2"
          onClick={() => onChange({ ...value, date: addDays(value.date, -7) })}
        >
          &lt;
        </Button>
        <div className="flex flex-1 justify-between gap-1">
          {weekDates.map((d) => {
            const isSelected = d === value.date;
            const available = weekAvailability[d] ?? true;
            const day = new Date(`${d}T00:00:00`);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ ...value, date: d })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[5px] px-2 py-1.5 text-sm",
                  isSelected
                    ? "bg-emerald-500 text-white"
                    : available
                      ? "text-emerald-600 hover:bg-emerald-500/10"
                      : "text-destructive hover:bg-destructive/10"
                )}
              >
                <span className="text-xs">{DAY_LABELS[day.getDay()]}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-semibold",
                    isSelected && "bg-white/20"
                  )}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-2"
          onClick={() => onChange({ ...value, date: addDays(value.date, 7) })}
        >
          &gt;
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold">AM</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : amSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places available</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {amSlots.map((s) => (
                <Button
                  key={s}
                  type="button"
                  className="h-11 bg-emerald-500 text-sm text-white hover:bg-emerald-600"
                  onClick={() => onSlotSelected(s)}
                >
                  {formatSlotLabel(s)}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">PM</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : pmSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places available</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {pmSlots.map((s) => (
                <Button
                  key={s}
                  type="button"
                  className="h-11 bg-emerald-500 text-sm text-white hover:bg-emerald-600"
                  onClick={() => onSlotSelected(s)}
                >
                  {formatSlotLabel(s)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: the same single expected error (missing `./booking-widget`, resolved next task).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/book/[slug]/party-date-time-picker.tsx"
git commit -m "feat: add party/date/time picker for the booking widget"
```

---

### Task 8: Booking widget orchestrator

**Files:**
- Create: `src/app/(public)/book/[slug]/booking-widget.tsx`

**Interfaces:**
- Consumes: `PartyDateTimePicker` (Task 7).
- Produces: `formatDateLabel`, `formatTimeLabel`, `<BookingWidget slug restaurantName />` — the date/time label helpers are consumed by Task 10 (`success-screen.tsx`).

- [ ] **Step 1: Implement**

`src/app/(public)/book/[slug]/booking-widget.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toLocalDateInput } from "@/lib/reservation-dates";
import { PartyDateTimePicker, type PartyDateTimeSelection } from "./party-date-time-picker";
import { ContactForm } from "./contact-form";
import { SuccessScreen } from "./success-screen";

export function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type Step = "PICK" | "REVIEW" | "CONTACT" | "SUCCESS";

export function BookingWidget({ slug, restaurantName }: { slug: string; restaurantName: string }) {
  const [step, setStep] = useState<Step>("PICK");
  const [selection, setSelection] = useState<PartyDateTimeSelection & { time: string | null }>({
    partySize: 2,
    date: toLocalDateInput(new Date()),
    time: null,
  });
  const [booking, setBooking] = useState<{ partySize: number; date: string; time: string } | null>(null);

  function handleSlotSelected(time: string) {
    setSelection((prev) => ({ ...prev, time }));
    setStep("REVIEW");
  }

  function resetToStart() {
    setBooking(null);
    setSelection({ partySize: 2, date: toLocalDateInput(new Date()), time: null });
    setStep("PICK");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col p-6">
      <h1 className="mb-6 text-xl font-semibold">Reserve a table at {restaurantName}</h1>

      <div className="flex-1">
        {step === "PICK" && (
          <PartyDateTimePicker
            slug={slug}
            value={selection}
            onChange={(v) => setSelection((prev) => ({ ...prev, ...v, time: null }))}
            onSlotSelected={handleSlotSelected}
          />
        )}

        {step === "REVIEW" && selection.time && (
          <div className="space-y-6">
            <p className="text-lg">
              Party of <strong>{selection.partySize}</strong> on <strong>{formatDateLabel(selection.date)}</strong> at{" "}
              <strong>{formatTimeLabel(selection.time)}</strong>.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setStep("PICK")}>
                Change
              </Button>
              <Button className="h-11 flex-1 text-base" onClick={() => setStep("CONTACT")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "CONTACT" && selection.time && (
          <ContactForm
            slug={slug}
            selection={{ partySize: selection.partySize, date: selection.date, time: selection.time }}
            onBack={() => setStep("REVIEW")}
            onSuccess={(b) => {
              setBooking(b);
              setStep("SUCCESS");
            }}
          />
        )}

        {step === "SUCCESS" && booking && <SuccessScreen booking={booking} onBookAnother={resetToStart} />}
      </div>

      <p className="pt-8 text-center text-xs text-muted-foreground">
        Powered by <span className="font-semibold">360One Inc.</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: errors only for the still-missing `./contact-form` and `./success-screen` modules (resolved in Tasks 9-10). Nothing else.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/book/[slug]/booking-widget.tsx"
git commit -m "feat: add booking widget orchestrator with review/change step"
```

---

### Task 9: Contact form (Step 3)

**Files:**
- Create: `src/app/(public)/book/[slug]/contact-form.tsx`

**Interfaces:**
- Consumes: `createWidgetReservationAction` (Task 6).
- Produces: `<ContactForm />` — consumed by Task 8's `booking-widget.tsx` (already imported there).

- [ ] **Step 1: Implement**

`src/app/(public)/book/[slug]/contact-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createWidgetReservationAction } from "./actions";
import type { ContactChannel } from "@/generated/prisma/client";

const CHANNEL_OPTIONS: ContactChannel[] = ["EMAIL", "SMS", "CALL"];
const CHANNEL_LABELS: Record<ContactChannel, string> = {
  EMAIL: "Email",
  SMS: "Text message",
  CALL: "Phone call",
};

export function ContactForm({
  slug,
  selection,
  onBack,
  onSuccess,
}: {
  slug: string;
  selection: { partySize: number; date: string; time: string };
  onBack: () => void;
  onSuccess: (booking: { partySize: number; date: string; time: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<ContactChannel>("EMAIL");
  const [specialRequests, setSpecialRequests] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createWidgetReservationAction(slug, {
      ...selection,
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      preferredContact,
      specialRequests,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess(result.booking);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="widgetName">Name</Label>
        <Input
          id="widgetName"
          className="h-11 text-base"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="widgetEmail">Email</Label>
          <Input
            id="widgetEmail"
            type="email"
            className="h-11 text-base"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="widgetPhone">Phone</Label>
          <Input
            id="widgetPhone"
            type="tel"
            className="h-11 text-base"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="widgetPreferredContact">Preferred contact method</Label>
        <Select value={preferredContact} onValueChange={(v) => setPreferredContact(v as ContactChannel)}>
          <SelectTrigger id="widgetPreferredContact" className="h-11 w-full text-base">
            <SelectValue>{(value: string) => CHANNEL_LABELS[value as ContactChannel]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="widgetSpecialRequests">Special requests (optional)</Label>
        <Textarea
          id="widgetSpecialRequests"
          className="text-base"
          placeholder="Any allergies, seating preferences, or occasion..."
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
        />
      </div>
      {error && <p className="text-base text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-12 flex-1 text-base" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" className="h-12 flex-1 text-base" disabled={saving}>
          {saving ? "Submitting..." : "Request reservation"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: an error only for the still-missing `./success-screen` module (resolved next task).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/book/[slug]/contact-form.tsx"
git commit -m "feat: add widget contact-info form"
```

---

### Task 10: Success screen

**Files:**
- Create: `src/app/(public)/book/[slug]/success-screen.tsx`

**Interfaces:**
- Consumes: `formatDateLabel`, `formatTimeLabel` (Task 8, `booking-widget.tsx`).
- Produces: `<SuccessScreen />` — consumed by Task 8's `booking-widget.tsx` (already imported there).

- [ ] **Step 1: Implement**

`src/app/(public)/book/[slug]/success-screen.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateLabel, formatTimeLabel } from "./booking-widget";

export function SuccessScreen({
  booking,
  onBookAnother,
}: {
  booking: { partySize: number; date: string; time: string };
  onBookAnother: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        <CheckCircle2 className="size-16 text-emerald-500" />
      </motion.div>
      <h2 className="text-lg font-semibold">Request received!</h2>
      <p className="max-w-sm text-base text-muted-foreground">
        We&apos;ve received your request for {booking.partySize}{" "}
        {booking.partySize === 1 ? "guest" : "guests"} on {formatDateLabel(booking.date)} at{" "}
        {formatTimeLabel(booking.time)} -- we&apos;ll be in touch to confirm.
      </p>
      <Button variant="outline" className="h-11 px-5 text-base" onClick={onBookAnother}>
        Book another reservation
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors — this resolves the last of the placeholder import errors from Tasks 5-9.

```bash
npx eslint "src/app/(public)/book/[slug]"
```

Expected: no errors.

```bash
pnpm test
```

Expected: all tests still pass.

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Visit `/book/blue-fork` with no session. Confirm the restaurant name renders, pick a party size and date, click an available slot, confirm the review screen shows correct details, click Change and confirm the picker reopens pre-filled, pick a slot again, Continue, fill in contact info, submit, and confirm the success screen appears with correct details and a working "Book another reservation" button.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/book/[slug]/success-screen.tsx"
git commit -m "feat: add widget success screen with animation"
```

---

### Task 11: Settings embed snippet

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/settings/embed-snippet.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/settings/page.tsx`

**Interfaces:**
- Produces: `<EmbedSnippet slug />` — consumed by this task's own `page.tsx` update.

- [ ] **Step 1: Embed snippet component**

`src/app/(dashboard)/r/[slug]/settings/embed-snippet.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function EmbedSnippet({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const snippet = origin
    ? `<iframe src="${origin}/book/${slug}" width="100%" height="800" style="border:0"></iframe>`
    : "";

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3 rounded-[5px] border border-border p-5">
      <h2 className="text-base font-semibold">Embed on your website</h2>
      <p className="text-sm text-muted-foreground">
        Paste this snippet into your website&apos;s HTML to add a booking widget.
      </p>
      <pre className="overflow-x-auto rounded-[5px] border border-border bg-muted p-3 text-xs">
        <code>{snippet || "Loading..."}</code>
      </pre>
      <Button variant="outline" className="h-9" onClick={handleCopy} disabled={!origin}>
        {copied ? "Copied!" : "Copy snippet"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Settings page**

`src/app/(dashboard)/r/[slug]/settings/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";
import { EmbedSnippet } from "./embed-snippet";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <EmbedSnippet slug={slug} />
      <ComingSoon feature="Other settings" phase="Phase 8" />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

```bash
pnpm dev
```

Visit `/r/blue-fork/settings` as Owner. Confirm the snippet box shows a working `<iframe>` tag containing `/book/blue-fork` and that "Copy snippet" changes to "Copied!" briefly after clicking.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/settings/embed-snippet.tsx" "src/app/(dashboard)/r/[slug]/settings/page.tsx"
git commit -m "feat: add embed-snippet section to Settings"
```

---

### Task 12: Playwright e2e — Definition of Done

**Files:**
- Create: `e2e/embeddable-widget.spec.ts`

**Interfaces:**
- Consumes: the running production build, the seeded `owner@blue-fork.example.com` account.

- [ ] **Step 1: Write the test**

`e2e/embeddable-widget.spec.ts`:

```typescript
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_CUSTOMER_NAME = "E2E Widget Guest";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_CUSTOMER_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_CUSTOMER_NAME]);
  } finally {
    await client.end();
  }
}

test.describe("Embeddable reservation widget", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("books through all 3 steps, lands as Pending, and staff can confirm it", async ({ page }) => {
    await page.goto("/book/blue-fork");
    await expect(page.getByRole("heading", { name: /Reserve a table at/ })).toBeVisible();

    await page.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first().click();

    await expect(page.getByText(/Party of \d+ on/)).toBeVisible();
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page.getByLabel("Party")).toBeVisible();
    await page.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Name").fill(FIXTURE_CUSTOMER_NAME);
    await page.getByLabel("Email").fill("widget-e2e@example.com");
    await page.getByLabel("Phone").fill("555-000-3333");
    await page.getByRole("button", { name: "Request reservation" }).click();

    await expect(page.getByText("Request received!")).toBeVisible();
    await expect(page.getByText(FIXTURE_CUSTOMER_NAME)).toHaveCount(0); // name isn't echoed on this screen, sanity check for no leftover state
    await expect(page.getByRole("button", { name: "Book another reservation" })).toBeVisible();

    // Staff side: sign in, find it Pending, confirm it.
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.goto("/r/blue-fork/reservations?view=day");
    await page.getByRole("button", { name: "Pending" }).click();
    await page.getByText(FIXTURE_CUSTOMER_NAME).click();
    await expect(page.getByLabel("Reservation status")).toBeVisible();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "CONFIRMED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Settings page shows a working embed snippet", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/r/blue-fork/settings");
    await expect(page.getByText("/book/blue-fork")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:e2e -- e2e/embeddable-widget.spec.ts
```

Expected: PASS. Run it a second time immediately after to confirm the `beforeAll`/`afterAll` hooks make it idempotent.

- [ ] **Step 3: Run the full suite**

```bash
pnpm test:e2e
```

Expected: all e2e specs across every phase still PASS (this phase touched shared files: `timeline-view.tsx`, `reservation-badge.tsx`, `reservations-calendar.tsx`, `reservation-modal.tsx`).

- [ ] **Step 4: Commit**

```bash
git add e2e/embeddable-widget.spec.ts
git commit -m "test: add Playwright coverage for the embeddable widget"
```
