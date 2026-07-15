# Phase 8: Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/r/[slug]/settings` stub with real, Owner-editable business hours (including per-day Closed), a default reservation duration, and full self-service team member management — and make business hours genuinely drive every feature that currently hardcodes a 7am-11pm window.

**Architecture:** A new `BusinessHours` model (one row per restaurant per day-of-week) plus `Restaurant.defaultReservationDurationMinutes` and `User.active`. A rewritten pure helper module (`src/lib/business-hours.ts`) replaces the static `DAY_START_HOUR`/`DAY_END_HOUR` constants with functions that read a restaurant's actual configured hours; every consumer (the embeddable widget, Timeline view, the Dashboard, Reports) switches from importing the constants to calling these functions. Team management reuses the existing Owner/Staff role model with a new Owner-only guard and a single enforcement point for deactivated accounts.

**Tech Stack:** Next.js 15 Server Actions/Server Components, Prisma 7, Better Auth (`additionalFields`), Vitest, Playwright.

## Global Constraints

- `Restaurant.defaultReservationDurationMinutes Int @default(90)`.
- `BusinessHours`: one row per `(restaurantId, dayOfWeek)`, `dayOfWeek` 0=Sunday..6=Saturday (matches `Date.getDay()`, the same convention `reservation-dates.ts` already documents). `openTime`/`closeTime` are `"HH:mm"` strings, but this phase only ever writes and reads the whole-hour part (`"07:00"`, never `"07:30"`) — the Settings UI offers an hour-only picker, since every existing hour-bucketing consumer (Timeline, Reports, Dashboard) already only renders whole-hour marks and finer precision would be discarded downstream anyway. This is a deliberate simplification, not an oversight.
- No migration backfill: when a restaurant has zero `BusinessHours` rows (every restaurant today, and any newly created one), the pure helper falls back to `isOpen: true, startHour: 7, endHour: 23` — behaviorally identical to a backfill migration, achieved without one. Nothing changes for any existing restaurant, e2e fixture, or test until an Owner actually saves the new form.
- `User.active Boolean @default(true)`. An inactive user is treated as fully unauthenticated at the single `getSessionUser()` choke point — every existing guard already routes through it, so no other guard needs to change.
- Business Hours & Reservation Rules and Team Members are both gated to `role === "OWNER"` via a new `assertRestaurantOwner(slug)` guard — Staff can view Settings (the embed snippet section already works for anyone) but not edit either of these two sections.
- An Owner can never deactivate their own account (checked server-side in the Server Action, not just hidden in the UI).
- Adding staff via Super Admin's existing `addStaffMemberAction` (`src/app/(admin)/admin/restaurants/actions.ts`) keeps working unchanged, alongside the new Owner-facing path.

---

### Task 1: Data model

**Files:**
- Modify: `prisma/schema.prisma` (`Restaurant` model, `User` model, new `BusinessHours` model)

**Interfaces:**
- Produces: `Restaurant.defaultReservationDurationMinutes: number`, `Restaurant.businessHours: BusinessHours[]`, `BusinessHours { id, restaurantId, dayOfWeek, isOpen, openTime, closeTime }`, `User.active: boolean` — read by every later task.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, update the `Restaurant` model:

```prisma
model Restaurant {
  id        String           @id @default(cuid())
  name      String
  slug      String           @unique
  status    RestaurantStatus @default(ACTIVE)
  createdAt DateTime         @default(now())
  ghlLocationId String?
  ghlApiKey     String?
  defaultReservationDurationMinutes Int @default(90)
  users        User[]
  tables       Table[]
  customers    Customer[]
  reservations Reservation[]
  waitlistEntries WaitlistEntry[]
  businessHours BusinessHours[]

  @@map("restaurant")
}

model BusinessHours {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  dayOfWeek    Int
  isOpen       Boolean    @default(true)
  openTime     String?
  closeTime    String?

  @@unique([restaurantId, dayOfWeek])
  @@map("business_hours")
}
```

Add this new model right after the `Restaurant` model in the file.

Update the `User` model:

```prisma
model User {
  id            String      @id
  name          String
  email         String      @unique
  emailVerified Boolean
  image         String?
  createdAt     DateTime
  updatedAt     DateTime
  role          Role        @default(STAFF)
  active        Boolean     @default(true)
  restaurantId  String?
  restaurant    Restaurant? @relation(fields: [restaurantId], references: [id])
  sessions      Session[]
  accounts      Account[]

  @@map("user")
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name business_hours_and_team_members`
Expected: a new folder under `prisma/migrations/` with an additive migration (new `business_hours` table, two new columns), applied with no errors.

- [ ] **Step 3: Regenerate the Prisma client explicitly**

Run: `npx prisma generate`

- [ ] **Step 4: Verify the type-check picks up the new fields**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add BusinessHours model, default reservation duration, and User.active"
```

---

### Task 2: business-hours.ts pure helpers

**Files:**
- Modify: `src/lib/business-hours.ts` (full rewrite)
- Test: `tests/business-hours.test.ts` (new)

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `type DayHours = { dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null }`
  - `getHoursForDay(hours: DayHours[], dayOfWeek: number): { isOpen: boolean; startHour: number; endHour: number }`
  - `getWidestOpenWindow(hours: DayHours[]): { startHour: number; endHour: number }`
  — consumed by Tasks 3, 4, 5, 8.

- [ ] **Step 1: Write the failing tests**

Create `tests/business-hours.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getHoursForDay, getWidestOpenWindow, type DayHours } from "@/lib/business-hours";

describe("getHoursForDay", () => {
  it("defaults to open 7am-11pm when no row exists for that day", () => {
    const result = getHoursForDay([], 1);
    expect(result).toEqual({ isOpen: true, startHour: 7, endHour: 23 });
  });

  it("returns closed when the day's row says isOpen: false", () => {
    const hours: DayHours[] = [{ dayOfWeek: 1, isOpen: false, openTime: null, closeTime: null }];
    const result = getHoursForDay(hours, 1);
    expect(result.isOpen).toBe(false);
  });

  it("returns a custom configured window for an open day", () => {
    const hours: DayHours[] = [{ dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "17:00" }];
    const result = getHoursForDay(hours, 1);
    expect(result).toEqual({ isOpen: true, startHour: 9, endHour: 17 });
  });

  it("only looks at the requested day, ignoring rows for other days", () => {
    const hours: DayHours[] = [
      { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "17:00" },
      { dayOfWeek: 2, isOpen: false, openTime: null, closeTime: null },
    ];
    expect(getHoursForDay(hours, 2).isOpen).toBe(false);
    expect(getHoursForDay(hours, 3)).toEqual({ isOpen: true, startHour: 7, endHour: 23 });
  });
});

describe("getWidestOpenWindow", () => {
  it("defaults to 7am-11pm when no rows exist", () => {
    expect(getWidestOpenWindow([])).toEqual({ startHour: 7, endHour: 23 });
  });

  it("unions the widest start and end across every open day", () => {
    const hours: DayHours[] = [
      { dayOfWeek: 1, isOpen: true, openTime: "08:00", closeTime: "16:00" },
      { dayOfWeek: 6, isOpen: true, openTime: "10:00", closeTime: "23:00" },
    ];
    // Days without a row (Sun, Tue-Fri) default to open 7-23, which is wider
    // on the start side than Monday's 08:00 -- the widest window across all
    // 7 days, not just the two explicitly configured ones.
    expect(getWidestOpenWindow(hours)).toEqual({ startHour: 7, endHour: 23 });
  });

  it("ignores closed days when computing the window", () => {
    const hours: DayHours[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: dayOfWeek === 3,
      openTime: dayOfWeek === 3 ? "11:00" : null,
      closeTime: dayOfWeek === 3 ? "15:00" : null,
    }));
    expect(getWidestOpenWindow(hours)).toEqual({ startHour: 11, endHour: 15 });
  });

  it("falls back to the default window when every day is closed", () => {
    const hours: DayHours[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: false,
      openTime: null,
      closeTime: null,
    }));
    expect(getWidestOpenWindow(hours)).toEqual({ startHour: 7, endHour: 23 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/business-hours.test.ts`
Expected: FAIL — `getHoursForDay`/`getWidestOpenWindow` are not exported yet (the current file only exports `DAY_START_HOUR`/`DAY_END_HOUR`).

- [ ] **Step 3: Rewrite the module**

Replace the full contents of `src/lib/business-hours.ts`:

```ts
export type DayHours = { dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null };

// ponytail: whole-hour precision only -- the Settings UI offers an
// on-the-hour picker, since every hour-bucketing consumer (Timeline,
// Reports, Dashboard) already only renders whole-hour marks and finer
// precision would be discarded downstream anyway.
const DEFAULT_OPEN_HOUR = 7;
const DEFAULT_CLOSE_HOUR = 23;

function parseHour(time: string): number {
  return Number(time.split(":")[0]);
}

export function getHoursForDay(
  hours: DayHours[],
  dayOfWeek: number
): { isOpen: boolean; startHour: number; endHour: number } {
  const day = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!day) return { isOpen: true, startHour: DEFAULT_OPEN_HOUR, endHour: DEFAULT_CLOSE_HOUR };
  if (!day.isOpen || !day.openTime || !day.closeTime) return { isOpen: false, startHour: 0, endHour: 0 };
  return { isOpen: true, startHour: parseHour(day.openTime), endHour: parseHour(day.closeTime) };
}

export function getWidestOpenWindow(hours: DayHours[]): { startHour: number; endHour: number } {
  const openDays = Array.from({ length: 7 }, (_, dayOfWeek) => getHoursForDay(hours, dayOfWeek)).filter(
    (d) => d.isOpen
  );
  if (openDays.length === 0) return { startHour: DEFAULT_OPEN_HOUR, endHour: DEFAULT_CLOSE_HOUR };
  return {
    startHour: Math.min(...openDays.map((d) => d.startHour)),
    endHour: Math.max(...openDays.map((d) => d.endHour)),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/business-hours.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/business-hours.ts tests/business-hours.test.ts
git commit -m "feat: replace static business-hours constants with per-restaurant helpers"
```

---

### Task 3: Widget availability + Closed-day UI

**Files:**
- Modify: `src/lib/widget-availability.ts`
- Modify: `tests/widget-availability.test.ts`
- Modify: `src/app/(public)/book/[slug]/actions.ts`
- Modify: `src/app/(public)/book/[slug]/time-slot-step.tsx`

**Interfaces:**
- Consumes: `getHoursForDay`, `type DayHours` from `@/lib/business-hours` (Task 2).
- Produces: `getAvailableSlots(tables, reservations, { partySize, date, businessHours: DayHours[], durationMinutes: number }): string[]` — signature change consumed only within this task. `getSlotsForDateAction(slug, date, partySize): Promise<{ slots: string[]; isOpen: boolean }>` — return-shape change; the only consumer is `time-slot-step.tsx`, updated in this same task.

- [ ] **Step 1: Update `getAvailableSlots`**

Replace the full contents of `src/lib/widget-availability.ts`:

```ts
import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";
import { getHoursForDay, type DayHours } from "@/lib/business-hours";

const SLOT_MINUTES = 15;

export type AvailabilityTable = { id: string; capacity: number };
export type AvailabilityReservation = { tableId: string | null } & TimeRange;

export function getAvailableSlots(
  tables: AvailabilityTable[],
  reservations: AvailabilityReservation[],
  input: { partySize: number; date: string; businessHours: DayHours[]; durationMinutes: number } // date: YYYY-MM-DD
): string[] {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);
  if (fitting.length === 0) return [];

  const dayOfWeek = new Date(`${input.date}T00:00:00`).getDay();
  const { isOpen, startHour, endHour } = getHoursForDay(input.businessHours, dayOfWeek);
  if (!isOpen) return [];

  const slots: string[] = [];
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  for (let minutes = dayStart; minutes + input.durationMinutes <= dayEnd; minutes += SLOT_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const startsAt = new Date(`${input.date}T${time}`);

    const hasFreeTable = fitting.some((t) => {
      const conflict = reservations.some(
        (r) => r.tableId === t.id && doesOverlap(r, { startsAt, durationMinutes: input.durationMinutes })
      );
      return !conflict;
    });

    if (hasFreeTable) slots.push(time);
  }

  return slots;
}
```

- [ ] **Step 2: Update the existing tests and add new ones**

Replace the full contents of `tests/widget-availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getAvailableSlots } from "@/lib/widget-availability";

const TABLES = [
  { id: "small", capacity: 2 },
  { id: "large", capacity: 6 },
];

// Empty array falls back to the default 7am-11pm, every day open.
const NO_HOURS_CONFIGURED: never[] = [];

describe("getAvailableSlots", () => {
  it("returns every 15-minute slot within business hours when nothing is booked", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
    });
    expect(slots[0]).toBe("07:00");
    expect(slots).toContain("07:15");
    expect(slots[slots.length - 1]).toBe("21:30");
  });

  it("excludes a slot once every fitting table is booked", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots([TABLES[0]!], reservations, {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
    });
    expect(slots).not.toContain("19:00");
    expect(slots).not.toContain("19:30"); // still overlaps the 90-minute booking
    expect(slots).toContain("20:30"); // booking has ended by then
  });

  it("does not exclude a slot when the conflicting reservation is on a different table", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T19:00:00"), durationMinutes: 90 },
    ];
    const slots = getAvailableSlots(TABLES, reservations, {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
    });
    expect(slots).toContain("19:00"); // "large" table is still free
  });

  it("returns an empty list when the party is bigger than every table", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 20,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 90,
    });
    expect(slots).toEqual([]);
  });

  it("returns an empty list when the restaurant is closed that day", () => {
    // 2026-07-13 is a Monday (dayOfWeek 1).
    const businessHours = [{ dayOfWeek: 1, isOpen: false, openTime: null, closeTime: null }];
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours,
      durationMinutes: 90,
    });
    expect(slots).toEqual([]);
  });

  it("respects a custom, narrower business-hours window", () => {
    const businessHours = [{ dayOfWeek: 1, isOpen: true, openTime: "17:00", closeTime: "21:00" }];
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours,
      durationMinutes: 90,
    });
    expect(slots[0]).toBe("17:00");
    expect(slots[slots.length - 1]).toBe("19:30");
  });

  it("respects a custom reservation duration when checking whether a slot fits before closing", () => {
    const slots = getAvailableSlots(TABLES, [], {
      partySize: 2,
      date: "2026-07-13",
      businessHours: NO_HOURS_CONFIGURED,
      durationMinutes: 120,
    });
    expect(slots[slots.length - 1]).toBe("21:00");
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `npx vitest run tests/widget-availability.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 4: Wire business hours and default duration into the widget's Server Actions**

Replace the full contents of `src/app/(public)/book/[slug]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { getAvailableSlots } from "@/lib/widget-availability";
import { getHoursForDay } from "@/lib/business-hours";
import { findOrCreateCustomer } from "@/lib/reservations-data";
import { syncContactToGhl } from "@/lib/ghl-sync";
import type { ContactChannel } from "@/generated/prisma/client";

export type SlotsForDateResult = { slots: string[]; isOpen: boolean };

export async function getSlotsForDateAction(
  slug: string,
  date: string,
  partySize: number
): Promise<SlotsForDateResult> {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") return { slots: [], isOpen: true };

  const { start, end } = getDayRange(new Date(`${date}T00:00:00`));
  const [tables, reservations, businessHours] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
  ]);

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const isOpen = getHoursForDay(businessHours, dayOfWeek).isOpen;

  const slots = getAvailableSlots(tables, reservations, {
    partySize,
    date,
    businessHours,
    durationMinutes: restaurant.defaultReservationDurationMinutes,
  });

  return { slots, isOpen };
}

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
  const [tables, reservations, businessHours] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, capacity: true } }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
  ]);

  // Re-check right before writing -- another visitor may have taken this
  // slot between this visitor loading the page and submitting.
  const stillAvailable = getAvailableSlots(tables, reservations, {
    partySize: input.partySize,
    date: input.date,
    businessHours,
    durationMinutes: restaurant.defaultReservationDurationMinutes,
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
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      specialRequests: input.specialRequests || null,
      status: "PENDING",
    },
  });

  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: customer.name, email: customer.email, phone: customer.phone }
  );

  revalidatePath(`/r/${slug}/reservations`);

  return { ok: true, booking: { partySize: input.partySize, date: input.date, time: input.time } };
}
```

- [ ] **Step 5: Add the Closed-day UI to the widget**

In `src/app/(public)/book/[slug]/time-slot-step.tsx`, make these changes:

Replace the state declarations:

```tsx
const [slots, setSlots] = useState<string[]>([]);
const [selectedDayOpen, setSelectedDayOpen] = useState(true);
const [weekAvailability, setWeekAvailability] = useState<Record<string, "available" | "full" | "closed">>({});
const [loading, setLoading] = useState(true);
```

Replace the `useEffect`:

```tsx
useEffect(() => {
  let cancelled = false;
  setLoading(true);
  Promise.all(weekDates.map((d) => getSlotsForDateAction(slug, d, value.partySize))).then((results) => {
    if (cancelled) return;
    const availability: Record<string, "available" | "full" | "closed"> = {};
    weekDates.forEach((d, i) => {
      const result = results[i];
      if (!result?.isOpen) availability[d] = "closed";
      else availability[d] = result.slots.length > 0 ? "available" : "full";
    });
    setWeekAvailability(availability);
  });
  getSlotsForDateAction(slug, value.date, value.partySize).then((result) => {
    if (cancelled) return;
    setSlots(result.slots);
    setSelectedDayOpen(result.isOpen);
    setLoading(false);
  });
  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [value.date, value.partySize]);
```

Replace the date-strip button's `className` logic (inside the `weekDates.map(...)` block):

```tsx
{weekDates.map((d) => {
  const isSelected = d === value.date;
  const status = weekAvailability[d] ?? "available";
  const day = new Date(`${d}T00:00:00`);
  return (
    <button
      key={d}
      type="button"
      onClick={() => onDateChange(d)}
      className={cn(
        "flex shrink-0 flex-col items-center gap-1 rounded-[5px] px-2 py-1.5 text-sm",
        isSelected
          ? "bg-primary text-primary-foreground"
          : status === "available"
            ? "text-emerald-600 hover:bg-emerald-500/10"
            : status === "closed"
              ? "text-muted-foreground hover:bg-muted"
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
```

Replace the slot-groups block near the bottom of the component:

```tsx
<div className="space-y-4">
  {!loading && !selectedDayOpen ? (
    <p className="text-sm text-muted-foreground">We&apos;re closed on this day. Please pick another date.</p>
  ) : (
    <>
      {renderSlotGroup("AM", amSlots)}
      {renderSlotGroup("PM", pmSlots)}
    </>
  )}
</div>
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/widget-availability.ts tests/widget-availability.test.ts "src/app/(public)/book/[slug]/actions.ts" "src/app/(public)/book/[slug]/time-slot-step.tsx"
git commit -m "feat: drive widget availability from configured business hours and duration"
```

---

### Task 4: Reports busiest-hour wiring

**Files:**
- Modify: `src/lib/report-metrics.ts`
- Modify: `tests/report-metrics.test.ts`
- Modify: `src/app/(dashboard)/r/[slug]/reports/page.tsx`

**Interfaces:**
- Consumes: `getWidestOpenWindow`, `type DayHours` from `@/lib/business-hours` (Task 2).
- Produces: `busiestHourOfDay(reservations: { startsAt: Date }[], businessHours: DayHours[]): ChartBucket[]` — signature change, consumed by `reports/page.tsx` in this same task.

- [ ] **Step 1: Update the failing test first**

In `tests/report-metrics.test.ts`, replace the `describe("busiestHourOfDay", ...)` block:

```ts
describe("busiestHourOfDay", () => {
  it("buckets by hour within the widest configured business-hours window", () => {
    const reservations = [
      { startsAt: new Date(2026, 7, 1, 19, 0) },
      { startsAt: new Date(2026, 7, 1, 19, 30) },
      { startsAt: new Date(2026, 7, 2, 12, 0) },
    ];
    const buckets = busiestHourOfDay(reservations, []);
    const at19 = buckets.find((b) => b.label === "7p");
    const at12 = buckets.find((b) => b.label === "12p");
    expect(at19?.value).toBe(2);
    expect(at12?.value).toBe(1);
  });

  it("widens its bucket range to cover every open day's hours", () => {
    const businessHours = [
      { dayOfWeek: 1, isOpen: true, openTime: "08:00", closeTime: "16:00" },
      { dayOfWeek: 6, isOpen: true, openTime: "10:00", closeTime: "23:00" },
    ];
    const buckets = busiestHourOfDay([], businessHours);
    expect(buckets[0]?.label).toBe("8a");
    expect(buckets[buckets.length - 1]?.label).toBe("10p");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/report-metrics.test.ts`
Expected: FAIL — `busiestHourOfDay` is called with 2 arguments but only accepts 1 (type error) or the widening test fails against the old signature.

- [ ] **Step 3: Update `busiestHourOfDay`**

In `src/lib/report-metrics.ts`, replace the import line:

```ts
import { getWidestOpenWindow, type DayHours } from "./business-hours";
```

Replace the `busiestHourOfDay` function:

```ts
export function busiestHourOfDay(reservations: { startsAt: Date }[], businessHours: DayHours[]): ChartBucket[] {
  const { startHour, endHour } = getWidestOpenWindow(businessHours);
  return Array.from({ length: endHour - startHour }, (_, i) => {
    const hour = startHour + i;
    const value = reservations.filter((r) => r.startsAt.getHours() === hour).length;
    return { label: formatHourLabel(hour), value };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/report-metrics.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Wire it into the Reports page**

In `src/app/(dashboard)/r/[slug]/reports/page.tsx`, update the `Promise.all` that fetches `reservations`/`tables` to also fetch `businessHours`:

```ts
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
```

Update the call site that renders the "Busiest hour of day" chart:

```tsx
        <div className="rounded-[5px] border border-border p-5">
          <h2 className="mb-2 text-base font-semibold">Busiest hour of day</h2>
          <ReportBarChart data={busiestHourOfDay(reservations, businessHours)} />
        </div>
```

- [ ] **Step 6: Verify types and run the full unit test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/report-metrics.ts tests/report-metrics.test.ts "src/app/(dashboard)/r/[slug]/reports/page.tsx"
git commit -m "feat: widen Reports' busiest-hour chart to the restaurant's actual business hours"
```

---

### Task 5: Timeline view + Dashboard wiring

**Files:**
- Modify: `src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx` (full rewrite)
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/page.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getHoursForDay` from `@/lib/business-hours` (Task 2).
- Produces: `TimelineView` gains a `dayHours: { isOpen: boolean; startHour: number; endHour: number }` prop, replacing its internal use of the removed `DAY_START_HOUR`/`DAY_END_HOUR` constants. `ReservationsCalendar` gains a `dayHours` prop threaded straight through to `TimelineView` — consumed by Task 6, which adds a second new prop to the same component.

- [ ] **Step 1: Rewrite Timeline view to take hours as props**

Replace the full contents of `src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx`:

```tsx
"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_ACCENT } from "./reservation-badge";
import type { ReservationListItem } from "./day-view";

const SLOT_MINUTES = 30;
const LABEL_COLUMN = "6rem";

function formatHour(hour: number) {
  // hour can be 24 (the end-of-day boundary mark) -- wrap it back to
  // midnight for display rather than showing a bogus "24:00".
  const h24 = hour % 24;
  const period = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:00 ${period}`;
}

export function TimelineView({
  reservations,
  tables,
  date,
  dayHours,
  onReservationClick,
  onSlotClick,
}: {
  reservations: ReservationListItem[];
  tables: { id: string; number: string }[];
  date: Date;
  dayHours: { isOpen: boolean; startHour: number; endHour: number };
  onReservationClick: (id: string) => void;
  onSlotClick: (tableId: string, time: string) => void;
}) {
  if (tables.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">Add a table to see the timeline.</p>;
  }
  if (!dayHours.isOpen) {
    return <p className="py-16 text-center text-base text-muted-foreground">Closed on this day.</p>;
  }

  const { startHour, endHour } = dayHours;
  const totalMinutes = (endHour - startHour) * 60;

  function minutesToOffsetPercent(minutesSinceStart: number) {
    return Math.max(0, Math.min(100, (minutesSinceStart / totalMinutes) * 100));
  }

  const now = new Date();
  const nowMinutes = (now.getHours() - startHour) * 60 + now.getMinutes();
  // Only show the current-time line when "now" actually falls within the
  // visible hour range for today -- otherwise it has nothing meaningful to
  // point at.
  const showNowLine = date.toDateString() === now.toDateString() && nowMinutes >= 0 && nowMinutes <= totalMinutes;
  const nowPercent = minutesToOffsetPercent(nowMinutes);
  const nowLabel = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const hourMarks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  function offsetPercent(startsAt: Date) {
    const minutesSinceStart = (startsAt.getHours() - startHour) * 60 + startsAt.getMinutes();
    return minutesToOffsetPercent(minutesSinceStart);
  }
  function widthPercent(durationMinutes: number) {
    return Math.max(2, (durationMinutes / totalMinutes) * 100);
  }

  function handleTrackClick(tableId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawMinutes = startHour * 60 + percent * totalMinutes;
    const snapped = Math.round(rawMinutes / 30) * 30;
    const hour = Math.floor(snapped / 60);
    const minute = snapped % 60;
    onSlotClick(tableId, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  const slotCells = Array.from({ length: totalMinutes / SLOT_MINUTES }, (_, i) => i);
  // Widget bookings (and any reservation without a table yet) can't render
  // in a per-table row -- surface them in their own row instead of letting
  // them silently disappear from the default view.
  const unassignedReservations = reservations.filter((r) => r.tableId === null);

  return (
    <div className="relative overflow-x-auto rounded-[5px] border border-border">
      <div className="relative flex h-14 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
        <div style={{ width: LABEL_COLUMN }} className="flex shrink-0 items-center p-3">
          Tables
        </div>
        <div className="relative min-w-[1600px] flex-1 overflow-hidden">
          {hourMarks.map((hour) => (
            <span
              key={hour}
              className="absolute top-3 pl-1.5 whitespace-nowrap"
              style={{ left: `${minutesToOffsetPercent((hour - startHour) * 60)}%` }}
            >
              {formatHour(hour)}
            </span>
          ))}
          {showNowLine && (
            <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${nowPercent}%` }}>
              <div className="h-full w-px bg-destructive" />
              <span className="absolute top-8 -translate-x-1/2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-destructive-foreground">
                {nowLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {unassignedReservations.length > 0 && (
        <div className="flex border-b border-border bg-amber-500/5">
          <div
            style={{ width: LABEL_COLUMN }}
            className="shrink-0 border-r border-border p-3 text-base font-medium text-amber-700"
          >
            Unassigned
          </div>
          <div className="relative h-20 min-w-[1600px] flex-1">
            {unassignedReservations.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onReservationClick(r.id)}
                className={cn(
                  "absolute top-1/2 z-10 h-14 -translate-y-1/2 truncate rounded-[5px] border-l-4 bg-background px-3 py-1.5 text-left shadow-sm hover:shadow-md",
                  STATUS_ACCENT[r.status]
                )}
                style={{ left: `${offsetPercent(r.startsAt)}%`, width: `${widthPercent(r.durationMinutes)}%` }}
              >
                <p className="truncate text-sm font-semibold">{r.customer.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  {r.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {tables.map((table) => {
        const tableReservations = reservations.filter((r) => r.tableId === table.id);
        return (
          <div key={table.id} className="flex border-b border-border last:border-b-0">
            <div style={{ width: LABEL_COLUMN }} className="shrink-0 border-r border-border p-3 text-base font-medium">
              Table {table.number}
            </div>
            <div
              className="relative h-20 min-w-[1600px] flex-1 cursor-pointer"
              onClick={(e) => handleTrackClick(table.id, e)}
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,var(--muted)_0px,var(--muted)_1px,transparent_1px,transparent_9px)]"
              />
              <div className="absolute inset-0 flex">
                {slotCells.map((slot) => (
                  <div
                    key={slot}
                    className={cn(
                      "h-full flex-1 border-r last:border-r-0",
                      slot % 2 === 1 ? "border-border/60" : "border-border/25"
                    )}
                  />
                ))}
              </div>

              {showNowLine && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-px bg-destructive"
                  style={{ left: `${nowPercent}%` }}
                />
              )}

              {tableReservations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReservationClick(r.id);
                  }}
                  className={cn(
                    "absolute top-1/2 z-10 h-14 -translate-y-1/2 truncate rounded-[5px] border-l-4 bg-background px-3 py-1.5 text-left shadow-sm hover:shadow-md",
                    STATUS_ACCENT[r.status]
                  )}
                  style={{ left: `${offsetPercent(r.startsAt)}%`, width: `${widthPercent(r.durationMinutes)}%` }}
                >
                  <p className="truncate text-sm font-semibold">{r.customer.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {r.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Thread `dayHours` through the calendar wrapper**

In `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`, add `dayHours` to the props type and destructuring:

```tsx
export function ReservationsCalendar({
  slug,
  view,
  date,
  reservations,
  tables,
  dayHours,
}: {
  slug: string;
  view: CalendarView;
  date: Date;
  reservations: ReservationListItem[];
  tables: TableRow[];
  dayHours: { isOpen: boolean; startHour: number; endHour: number };
}) {
```

Update the `TimelineView` call site to pass it through:

```tsx
      {view === "timeline" && (
        <TimelineView
          reservations={reservations}
          tables={tables}
          date={date}
          dayHours={dayHours}
          onReservationClick={(id) => {
            setEditingId(id);
            setModalOpen(true);
          }}
          onSlotClick={(tableId, time) => {
            setEditingId(null);
            setPrefill({ tableId, date: toLocalDateInput(date), time });
            setModalOpen(true);
          }}
        />
      )}
```

- [ ] **Step 3: Fetch and pass business hours from the Reservations page**

In `src/app/(dashboard)/r/[slug]/reservations/page.tsx`, add the import:

```ts
import { getHoursForDay } from "@/lib/business-hours";
```

Add a `businessHours` query alongside the existing `reservations`/`tables` queries, and compute `dayHours` for the viewed date. The full function becomes:

```tsx
export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; date?: string; q?: string; status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const view: CalendarView = sp.view === "day" || sp.view === "week" ? sp.view : "timeline";
  const date = sp.date ? new Date(`${sp.date}T00:00:00`) : new Date();
  const statusFilter = sp.status ? (sp.status.split(",").filter(Boolean) as ReservationStatus[]) : [];

  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  const { start, end } = view === "week" ? getWeekRange(date) : getDayRange(date);

  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId: restaurant.id,
      startsAt: { gte: start, lt: end },
      ...(statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
      ...(sp.q
        ? {
            customer: {
              OR: [
                { name: { contains: sp.q, mode: "insensitive" } },
                { phone: { contains: sp.q } },
              ],
            },
          }
        : {}),
    },
    include: { customer: { select: { name: true, email: true, phone: true } }, table: { select: { number: true } } },
    orderBy: { startsAt: "asc" },
  });

  const tables = sortTablesByNumber(await prisma.table.findMany({ where: { restaurantId: restaurant.id } }));
  const businessHours = await prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } });
  const dayHours = getHoursForDay(businessHours, date.getDay());

  return (
    <ReservationsCalendar
      slug={slug}
      view={view}
      date={view === "week" ? start : date}
      reservations={reservations}
      tables={tables}
      dayHours={dayHours}
    />
  );
}
```

- [ ] **Step 4: Wire business hours into the Dashboard**

In `src/app/(dashboard)/r/[slug]/dashboard/page.tsx`, remove the local hardcoded constants (lines 10-11: `const DAY_START_HOUR = 8;` / `const DAY_END_HOUR = 23;`, along with the `// ponytail:` comment directly above them explaining the duplication — that comment's whole premise was "until Phase 8 models real business hours," which this task now does). Add this new import alongside the file's existing imports (`getDayRange` from `@/lib/reservation-dates`, etc. — leave those as they are):

```ts
import { getHoursForDay } from "@/lib/business-hours";
```

Add a `businessHours` fetch to the existing `Promise.all`, and compute today's hours before building `hourBuckets`. The relevant section becomes:

```tsx
  const { start, end } = getDayRange(new Date());
  const now = new Date();

  const [totalTables, todaysReservations, businessHours] = await Promise.all([
    prisma.table.count({ where: { restaurantId: restaurant.id } }),
    prisma.reservation.findMany({
      where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end } },
      include: { customer: { select: { name: true } }, table: { select: { number: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.businessHours.findMany({ where: { restaurantId: restaurant.id } }),
  ]);

  const { startHour: dayStartHour, endHour: dayEndHour } = getHoursForDay(businessHours, now.getDay());

  const occupiedTableIds = new Set(
    todaysReservations.filter((r) => r.status === "SEATED" && r.tableId).map((r) => r.tableId)
  );
  const occupancyPercent = totalTables === 0 ? 0 : Math.round((occupiedTableIds.size / totalTables) * 100);

  const upcomingArrivals = todaysReservations
    .filter((r) => r.status === "CONFIRMED" && r.startsAt >= now)
    .slice(0, 5);

  const hourBuckets: HourBucket[] = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => {
    const hour = dayStartHour + i;
    const label = `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? "p" : "a"}`;
    const count = todaysReservations.filter((r) => r.startsAt.getHours() === hour).length;
    return { hour: label, count };
  });
```

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx" "src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx" "src/app/(dashboard)/r/[slug]/reservations/page.tsx" "src/app/(dashboard)/r/[slug]/dashboard/page.tsx"
git commit -m "feat: drive Timeline view and Dashboard from configured business hours"
```

---

### Task 6: Remaining default-duration wiring

**Files:**
- Modify: `src/app/(dashboard)/r/[slug]/floor-manager/actions.ts`
- Modify: `src/app/(dashboard)/r/[slug]/waitlist/actions.ts`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/page.tsx`

**Interfaces:**
- Consumes: `restaurant.defaultReservationDurationMinutes` (Task 1), already present on every `restaurant` record these files already load.
- Produces: `ReservationModal` gains a `defaultDurationMinutes: number` prop. `ReservationsCalendar` gains a second new prop, `defaultDurationMinutes: number` — no other task consumes these.

- [ ] **Step 1: Wire `quickSeatWalkInAction`**

In `src/app/(dashboard)/r/[slug]/floor-manager/actions.ts`, replace both hardcoded `90`s in `quickSeatWalkInAction`:

```ts
export async function quickSeatWalkInAction(
  slug: string,
  tableId: string,
  input: { partySize: number; time: string }
): Promise<FloorActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const startsAt = new Date(`${toLocalDateInput(new Date())}T${input.time}`);

  const conflict = await hasTableConflict(tableId, startsAt, restaurant.defaultReservationDurationMinutes);
  if (conflict) return { ok: false, error: "That table is already booked for this time." };

  const customer = await findOrCreateCustomer(restaurant.id, { name: "Walk-in" });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId,
      partySize: input.partySize,
      startsAt,
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      // A slot later today books like a normal reservation; "now or already
      // past" seats immediately, matching what "walk-in" actually means.
      status: startsAt.getTime() <= Date.now() ? "SEATED" : "CONFIRMED",
    },
  });

  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: customer.name, email: customer.email, phone: customer.phone }
  );

  revalidatePath(`/r/${slug}/floor-manager`);
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}
```

- [ ] **Step 2: Wire `seatFromWaitlistAction`**

In `src/app/(dashboard)/r/[slug]/waitlist/actions.ts`, replace both hardcoded `90`s in `seatFromWaitlistAction`:

```ts
export async function seatFromWaitlistAction(
  slug: string,
  waitlistEntryId: string,
  tableId: string
): Promise<WaitlistActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: waitlistEntryId, restaurantId: restaurant.id },
    include: { customer: true },
  });
  if (!entry) return { ok: false, error: "Waitlist entry not found." };

  const startsAt = new Date();
  const conflict = await hasTableConflict(tableId, startsAt, restaurant.defaultReservationDurationMinutes);
  if (conflict) return { ok: false, error: "That table is already booked for this time." };

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: entry.customerId,
      tableId,
      partySize: entry.partySize,
      startsAt,
      durationMinutes: restaurant.defaultReservationDurationMinutes,
      status: "SEATED",
    },
  });

  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: entry.customer.name, email: entry.customer.email, phone: entry.customer.phone }
  );

  await prisma.waitlistEntry.update({
    where: { id: waitlistEntryId },
    data: { status: "SEATED" },
  });

  revalidatePath(`/r/${slug}/waitlist`);
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}
```

- [ ] **Step 3: Give the reservation modal a configurable default**

In `src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx`, add `defaultDurationMinutes` to the component's props:

```tsx
export function ReservationModal({
  open,
  onOpenChange,
  slug,
  tables,
  reservations,
  reservation,
  prefill,
  defaultDurationMinutes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tables: TableOption[];
  reservations: ReservationListItem[];
  reservation?: ReservationForEdit;
  prefill?: ReservationPrefill;
  defaultDurationMinutes: number;
  onSaved: () => void;
}) {
```

Replace the initial state declaration:

```tsx
  const [durationMinutes, setDurationMinutes] = useState(defaultDurationMinutes);
```

In the `useEffect`'s `else` branch (the "new reservation" reset path), replace `setDurationMinutes(90);` with:

```tsx
      setDurationMinutes(defaultDurationMinutes);
```

- [ ] **Step 4: Thread `defaultDurationMinutes` through the calendar wrapper**

In `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`, add `defaultDurationMinutes` to the props type and destructuring (alongside the `dayHours` prop added in Task 5):

```tsx
export function ReservationsCalendar({
  slug,
  view,
  date,
  reservations,
  tables,
  dayHours,
  defaultDurationMinutes,
}: {
  slug: string;
  view: CalendarView;
  date: Date;
  reservations: ReservationListItem[];
  tables: TableRow[];
  dayHours: { isOpen: boolean; startHour: number; endHour: number };
  defaultDurationMinutes: number;
}) {
```

Update the `ReservationModal` call site:

```tsx
      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        slug={slug}
        tables={tableOptions}
        reservations={reservations}
        reservation={editingForModal}
        prefill={prefill}
        defaultDurationMinutes={defaultDurationMinutes}
        onSaved={() => router.refresh()}
      />
```

- [ ] **Step 5: Pass it from the Reservations page**

In `src/app/(dashboard)/r/[slug]/reservations/page.tsx`, add `defaultDurationMinutes={restaurant.defaultReservationDurationMinutes}` to the `<ReservationsCalendar>` call site:

```tsx
  return (
    <ReservationsCalendar
      slug={slug}
      view={view}
      date={view === "week" ? start : date}
      reservations={reservations}
      tables={tables}
      dayHours={dayHours}
      defaultDurationMinutes={restaurant.defaultReservationDurationMinutes}
    />
  );
```

- [ ] **Step 6: Verify types and run the full unit test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/floor-manager/actions.ts" "src/app/(dashboard)/r/[slug]/waitlist/actions.ts" "src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx" "src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx" "src/app/(dashboard)/r/[slug]/reservations/page.tsx"
git commit -m "feat: use the restaurant's configured default reservation duration everywhere"
```

---

### Task 7: assertRestaurantOwner guard + User.active enforcement

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth-routes.ts`
- Modify: `src/lib/auth-guards.ts`

**Interfaces:**
- Consumes: `User.active` (Task 1).
- Produces: `SessionUser` type gains `id: string`. `getSessionUser()` now returns `null` for a deactivated user's session (previously only checked whether a session existed at all). `assertRestaurantOwner(slug): Promise<{ user: SessionUser; restaurant: Restaurant }>` — consumed by Tasks 8 and 9.

- [ ] **Step 1: Expose `active` on the Better Auth session**

In `src/lib/auth.ts`, add a third field to `user.additionalFields`:

```ts
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,
      },
      restaurantId: {
        type: "string",
        required: false,
        input: false,
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
```

- [ ] **Step 2: Add `id` to `SessionUser`**

Replace the full contents of `src/lib/auth-routes.ts`:

```ts
export type SessionUser = {
  id: string;
  role: "SUPER_ADMIN" | "OWNER" | "STAFF";
  restaurantSlug: string | null;
};

export function resolveHomeRoute(user: SessionUser): string {
  if (user.role === "SUPER_ADMIN") return "/admin";
  if (!user.restaurantSlug) return "/sign-in";
  return `/r/${user.restaurantSlug}/dashboard`;
}

export function canAccessRestaurant(user: SessionUser, targetSlug: string): boolean {
  return user.role === "SUPER_ADMIN" || user.restaurantSlug === targetSlug;
}
```

- [ ] **Step 3: Enforce `active` in `getSessionUser`, and add `assertRestaurantOwner`**

In `src/lib/auth-guards.ts`, replace the `getSessionUser` function:

```ts
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { id, role, restaurantId, active } = session.user as typeof session.user & {
    role: SessionUser["role"];
    restaurantId: string | null;
    active: boolean;
  };
  if (!active) return null;

  if (!restaurantId) return { id, role, restaurantSlug: null };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  });
  return { id, role, restaurantSlug: restaurant?.slug ?? null };
}
```

Add `assertRestaurantOwner` after the existing `assertRestaurantMember` function:

```ts
// Same reasoning as assertRestaurantMember: for Server Actions, not Server Components.
export async function assertRestaurantOwner(slug: string) {
  const { user, restaurant } = await assertRestaurantMember(slug);
  if (user.role !== "OWNER") throw new Error("Not authorized — Owner access required");
  return { user, restaurant };
}
```

- [ ] **Step 4: Verify types and run the full unit test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests pass (this task adds no new unit tests — `getSessionUser` and the guards are exercised via e2e in Task 11, consistent with how every existing guard in this codebase is tested).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth-routes.ts src/lib/auth-guards.ts
git commit -m "feat: add assertRestaurantOwner guard and enforce User.active at sign-in"
```

---

### Task 8: Settings — Business Hours & Reservation Rules

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/settings/actions.ts`
- Create: `src/app/(dashboard)/r/[slug]/settings/business-hours-form.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/settings/page.tsx`

**Interfaces:**
- Consumes: `assertRestaurantOwner` from `@/lib/auth-guards` (Task 7); `getHoursForDay`, `type DayHours` from `@/lib/business-hours` (Task 2).
- Produces:
  - `type SettingsActionResult = { ok: true } | { ok: false; error: string }`
  - `type BusinessHoursInput = { dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null }`
  - `updateBusinessSettingsAction(slug: string, input: { hours: BusinessHoursInput[]; defaultReservationDurationMinutes: number }): Promise<SettingsActionResult>`
  — `SettingsActionResult` and the `settings/actions.ts` file are extended by Task 9, which adds two more actions to it.

- [ ] **Step 1: Add the Server Action**

Create `src/app/(dashboard)/r/[slug]/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantOwner } from "@/lib/auth-guards";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

export type BusinessHoursInput = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export async function updateBusinessSettingsAction(
  slug: string,
  input: { hours: BusinessHoursInput[]; defaultReservationDurationMinutes: number }
): Promise<SettingsActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);

  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { defaultReservationDurationMinutes: input.defaultReservationDurationMinutes },
    }),
    ...input.hours.map((day) =>
      prisma.businessHours.upsert({
        where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek: day.dayOfWeek } },
        update: { isOpen: day.isOpen, openTime: day.openTime, closeTime: day.closeTime },
        create: {
          restaurantId: restaurant.id,
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
        },
      })
    ),
  ]);

  revalidatePath(`/r/${slug}/settings`);
  return { ok: true };
}
```

- [ ] **Step 2: Build the form component**

Create `src/app/(dashboard)/r/[slug]/settings/business-hours-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHoursForDay, type DayHours } from "@/lib/business-hours";
import { updateBusinessSettingsAction, type BusinessHoursInput } from "./actions";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

function formatHourOption(value: string): string {
  const hour = Number(value.split(":")[0]);
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

function toRow(businessHours: DayHours[], dayOfWeek: number): BusinessHoursInput {
  const { isOpen, startHour, endHour } = getHoursForDay(businessHours, dayOfWeek);
  return {
    dayOfWeek,
    isOpen,
    openTime: isOpen ? `${String(startHour).padStart(2, "0")}:00` : null,
    closeTime: isOpen ? `${String(endHour).padStart(2, "0")}:00` : null,
  };
}

export function BusinessHoursForm({
  slug,
  businessHours,
  defaultReservationDurationMinutes,
}: {
  slug: string;
  businessHours: DayHours[];
  defaultReservationDurationMinutes: number;
}) {
  const [rows, setRows] = useState<BusinessHoursInput[]>(
    Array.from({ length: 7 }, (_, dayOfWeek) => toRow(businessHours, dayOfWeek))
  );
  const [duration, setDuration] = useState(defaultReservationDurationMinutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateRow(dayOfWeek: number, patch: Partial<BusinessHoursInput>) {
    setRows((prev) => prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateBusinessSettingsAction(slug, {
      hours: rows,
      defaultReservationDurationMinutes: duration,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[5px] border border-border p-5">
      <h2 className="text-base font-semibold">Business hours & reservation rules</h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.dayOfWeek} className="grid grid-cols-[7rem_7rem_1fr_1fr] items-center gap-3">
            <span className="text-base font-medium">{DAY_NAMES[row.dayOfWeek]}</span>
            <Select
              value={row.isOpen ? "open" : "closed"}
              onValueChange={(v) =>
                updateRow(row.dayOfWeek, {
                  isOpen: v === "open",
                  openTime: v === "open" ? (row.openTime ?? "07:00") : null,
                  closeTime: v === "open" ? (row.closeTime ?? "23:00") : null,
                })
              }
            >
              <SelectTrigger className="h-10 w-full text-base" aria-label={`${DAY_NAMES[row.dayOfWeek]} status`}>
                <SelectValue>{(value: string) => (value === "open" ? "Open" : "Closed")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={row.openTime ?? "07:00"}
              onValueChange={(v) => updateRow(row.dayOfWeek, { openTime: v })}
              disabled={!row.isOpen}
            >
              <SelectTrigger className="h-10 w-full text-base" aria-label={`${DAY_NAMES[row.dayOfWeek]} opens`}>
                <SelectValue>{(value: string) => formatHourOption(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {formatHourOption(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={row.closeTime ?? "23:00"}
              onValueChange={(v) => updateRow(row.dayOfWeek, { closeTime: v })}
              disabled={!row.isOpen}
            >
              <SelectTrigger className="h-10 w-full text-base" aria-label={`${DAY_NAMES[row.dayOfWeek]} closes`}>
                <SelectValue>{(value: string) => formatHourOption(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {formatHourOption(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="defaultDuration">Default reservation duration (minutes)</Label>
        <Input
          id="defaultDuration"
          type="number"
          min={15}
          step={15}
          className="h-11 text-base"
          value={duration}
          onChange={(e) => {
            setDuration(Number(e.target.value));
            setSaved(false);
          }}
          required
        />
      </div>
      {error && <p className="text-base text-destructive">{error}</p>}
      <Button type="submit" className="h-11 px-5 text-base" disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved" : "Save business settings"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Wire it into the Settings page**

Replace the full contents of `src/app/(dashboard)/r/[slug]/settings/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmbedSnippet } from "./embed-snippet";
import { BusinessHoursForm } from "./business-hours-form";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: { businessHours: true },
  });
  if (!restaurant) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <EmbedSnippet slug={slug} />
      <BusinessHoursForm
        slug={slug}
        businessHours={restaurant.businessHours}
        defaultReservationDurationMinutes={restaurant.defaultReservationDurationMinutes}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/settings/actions.ts" "src/app/(dashboard)/r/[slug]/settings/business-hours-form.tsx" "src/app/(dashboard)/r/[slug]/settings/page.tsx"
git commit -m "feat: add Business Hours & Reservation Rules to Settings"
```

---

### Task 9: Team Members Server Actions

**Files:**
- Create: `src/lib/user-accounts.ts`
- Modify: `src/app/(admin)/admin/restaurants/actions.ts`
- Modify: `src/app/(dashboard)/r/[slug]/settings/actions.ts`

**Interfaces:**
- Consumes: `assertRestaurantOwner` from `@/lib/auth-guards` (Task 7); `SettingsActionResult` from `./actions` (Task 8, same file).
- Produces:
  - `createUserAccount(input: { name: string; email: string; password: string }): Promise<User>` (Better Auth's user shape) — consumed by both `admin/restaurants/actions.ts` and this task's new action.
  - `addTeamMemberAction(slug: string, input: { name: string; email: string; password: string; role: Role }): Promise<SettingsActionResult>` — consumed by Task 10.
  - `setTeamMemberActiveAction(slug: string, userId: string, active: boolean): Promise<SettingsActionResult>` — consumed by Task 10.

- [ ] **Step 1: Extract the shared account-creation helper**

Create `src/lib/user-accounts.ts`:

```ts
import { auth } from "@/lib/auth";

export async function createUserAccount(input: { name: string; email: string; password: string }) {
  const { user } = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  return user;
}
```

- [ ] **Step 2: Point Super Admin's action at the shared helper**

In `src/app/(admin)/admin/restaurants/actions.ts`, replace the import block at the top of the file:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/auth-guards";
import { createUserAccount } from "@/lib/user-accounts";
import { Prisma, type Role, type RestaurantStatus } from "@/generated/prisma/client";

export type AdminActionResult = { ok: true } | { ok: false; error: string };
```

(This removes the `auth` import and the local `createUserAccount` function that used to sit here — every call site further down the file, e.g. inside `createRestaurantAction` and `addStaffMemberAction`, keeps calling `createUserAccount(...)` exactly as before, now resolving to the imported shared version instead.)

- [ ] **Step 3: Add the Team Members actions**

In `src/app/(dashboard)/r/[slug]/settings/actions.ts`, add the import:

```ts
import { createUserAccount } from "@/lib/user-accounts";
import type { Role } from "@/generated/prisma/client";
```

Append these two functions after `updateBusinessSettingsAction`:

```ts
export async function addTeamMemberAction(
  slug: string,
  input: { name: string; email: string; password: string; role: Role }
): Promise<SettingsActionResult> {
  const { restaurant } = await assertRestaurantOwner(slug);
  let user;
  try {
    user = await createUserAccount({ name: input.name, email: input.email, password: input.password });
  } catch {
    return { ok: false, error: `Could not create an account for "${input.email}" — it may already be in use.` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: input.role, restaurantId: restaurant.id } });
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true };
}

export async function setTeamMemberActiveAction(
  slug: string,
  userId: string,
  active: boolean
): Promise<SettingsActionResult> {
  const { user, restaurant } = await assertRestaurantOwner(slug);
  if (userId === user.id) {
    return { ok: false, error: "You can't deactivate your own account." };
  }
  const { count } = await prisma.user.updateMany({
    where: { id: userId, restaurantId: restaurant.id },
    data: { active },
  });
  if (count === 0) return { ok: false, error: "Team member not found." };
  revalidatePath(`/r/${slug}/settings`);
  return { ok: true };
}
```

- [ ] **Step 4: Verify types and run the full unit test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-accounts.ts "src/app/(admin)/admin/restaurants/actions.ts" "src/app/(dashboard)/r/[slug]/settings/actions.ts"
git commit -m "feat: add Owner-facing team member actions, sharing account creation with Super Admin"
```

---

### Task 10: Team Members UI

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/settings/team-members.tsx`
- Create: `src/app/(dashboard)/r/[slug]/settings/add-team-member-dialog.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/settings/page.tsx`

**Interfaces:**
- Consumes: `addTeamMemberAction`, `setTeamMemberActiveAction` from `./actions` (Task 9); `getSessionUser` from `@/lib/auth-guards` (Task 7).
- Produces: nothing consumed by later tasks — this is the leaf that assembles the Team Members section.

- [ ] **Step 1: Build the add-member dialog**

Create `src/app/(dashboard)/r/[slug]/settings/add-team-member-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTeamMemberAction } from "./actions";
import type { Role } from "@/generated/prisma/client";

const ROLE_OPTIONS: Role[] = ["OWNER", "STAFF"];

export function AddTeamMemberDialog({
  open,
  onOpenChange,
  slug,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await addTeamMemberAction(slug, { name, email, password, role });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teamMemberName">Staff name</Label>
            <Input id="teamMemberName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teamMemberEmail">Email</Label>
            <Input
              id="teamMemberEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teamMemberPassword">Password</Label>
            <Input
              id="teamMemberPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teamMemberRole">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="teamMemberRole">
                <SelectValue>{(value: string) => value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Adding..." : "Add staff"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Build the Team Members section**

Create `src/app/(dashboard)/r/[slug]/settings/team-members.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddTeamMemberDialog } from "./add-team-member-dialog";
import { setTeamMemberActiveAction } from "./actions";
import type { Role } from "@/generated/prisma/client";

export type TeamMember = { id: string; name: string; email: string; role: Role; active: boolean };

export function TeamMembers({
  slug,
  members,
  currentUserId,
}: {
  slug: string;
  members: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggle(member: TeamMember) {
    setTogglingId(member.id);
    await setTeamMemberActiveAction(slug, member.id, !member.active);
    setTogglingId(null);
    router.refresh();
  }

  return (
    <div className="rounded-[5px] border border-border">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-base font-semibold">Team members</h2>
        <Button className="h-11 px-5 text-base" onClick={() => setAddOpen(true)}>
          Add staff member
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{m.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{m.active ? "Active" : "Inactive"}</Badge>
              </TableCell>
              <TableCell>
                {m.id !== currentUserId && (
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() => handleToggle(m)}
                    disabled={togglingId === m.id}
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AddTeamMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        slug={slug}
        onAdded={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the Settings page**

Replace the full contents of `src/app/(dashboard)/r/[slug]/settings/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-guards";
import { EmbedSnippet } from "./embed-snippet";
import { BusinessHoursForm } from "./business-hours-form";
import { TeamMembers } from "./team-members";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      users: { select: { id: true, name: true, email: true, role: true, active: true }, orderBy: { role: "asc" } },
    },
  });
  if (!restaurant) notFound();

  const sessionUser = await getSessionUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <EmbedSnippet slug={slug} />
      <BusinessHoursForm
        slug={slug}
        businessHours={restaurant.businessHours}
        defaultReservationDurationMinutes={restaurant.defaultReservationDurationMinutes}
      />
      <TeamMembers slug={slug} members={restaurant.users} currentUserId={sessionUser?.id ?? ""} />
    </div>
  );
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/settings/team-members.tsx" "src/app/(dashboard)/r/[slug]/settings/add-team-member-dialog.tsx" "src/app/(dashboard)/r/[slug]/settings/page.tsx"
git commit -m "feat: add Team Members section to Settings"
```

---

### Task 11: Playwright e2e coverage

**Files:**
- Create: `e2e/phase8-settings.spec.ts`

**Interfaces:**
- Consumes: the day-status comboboxes (`aria-label="{Day} status"`) and "Save business settings"/"Saved" button from Task 8; "Add staff member"/"Add staff"/"Deactivate"/"Reactivate" from Task 10; the widget's "Next" button and closed-day message from Task 3; Super Admin's existing "Create restaurant" flow (see `e2e/phase2-super-admin.spec.ts` for the exact flow this reuses).
- Produces: nothing consumed elsewhere.

**Why this suite creates its own restaurant instead of reusing `blue-fork`:** both tests below mutate restaurant-wide configuration — business hours, default reservation duration, and the team roster. `blue-fork` is the shared fixture restaurant every other e2e spec in this codebase signs into, and Playwright runs different spec files concurrently across workers (confirmed by this project's own test runs, e.g. "Running 14 tests using 4 workers"). Changing `blue-fork`'s default duration or closing a day while another spec file is mid-run against the same restaurant is exactly the kind of shared-fixture risk this project has already been burned by once (see the GHL-credentials incident from the Phase 7 session). A dedicated, disposable restaurant — created and torn down by this spec alone, the same way `e2e/phase6-ghl-sync.spec.ts` already does for its own credential-persistence test — sidesteps the problem entirely.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/phase8-settings.spec.ts`:

```ts
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_SLUG = "e2e-settings-restaurant";
const FIXTURE_OWNER_EMAIL = "owner-p8-e2e@example.com";
const FIXTURE_STAFF_EMAIL = "staff-p8-e2e@example.com";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TODAY_DAY_NAME = DAY_NAMES[new Date().getDay()];

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "user" WHERE email = ANY($1)`, [[FIXTURE_OWNER_EMAIL, FIXTURE_STAFF_EMAIL]]);
    await client.query(`DELETE FROM restaurant WHERE slug = $1`, [FIXTURE_SLUG]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 8 Settings", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  // Runs first: creates the dedicated fixture restaurant and its Owner
  // account, which the second test (running after it, same worker, same
  // file -- Playwright runs tests within one file sequentially by default)
  // reuses rather than recreating.
  test("Owner closes today's hours and sets a new default duration, and both take effect", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/restaurants");
    await page.getByRole("button", { name: "Create restaurant" }).click();
    await page.getByLabel("Name").fill("E2E Settings Restaurant");
    await page.getByLabel("Slug").fill(FIXTURE_SLUG);
    await page.getByLabel("Email").fill(FIXTURE_OWNER_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel("Email").fill(FIXTURE_OWNER_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${FIXTURE_SLUG}/dashboard`));

    await page.goto(`/r/${FIXTURE_SLUG}/settings`);
    await page.getByRole("combobox", { name: `${TODAY_DAY_NAME} status` }).click();
    await page.getByRole("option", { name: "Closed" }).click();

    await page.getByLabel("Default reservation duration (minutes)").fill("60");
    await page.getByRole("button", { name: "Save business settings" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    // Widget: today should now show as closed (Step 1 defaults to today's date).
    await page.goto(`/book/${FIXTURE_SLUG}`);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("We're closed on this day")).toBeVisible();

    // Internal booking: the modal's default duration should reflect the new setting.
    await page.goto(`/r/${FIXTURE_SLUG}/reservations`);
    await page.getByRole("button", { name: "New reservation" }).click();
    await expect(page.getByText("60 min")).toBeVisible();
  });

  test("Owner adds a staff member who can sign in, then deactivates them so they no longer can", async ({
    page,
    context,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(FIXTURE_OWNER_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${FIXTURE_SLUG}/dashboard`));

    await page.goto(`/r/${FIXTURE_SLUG}/settings`);
    await page.getByRole("button", { name: "Add staff member" }).click();
    await page.getByLabel("Staff name").fill("Phase 8 E2E Staff");
    await page.getByLabel("Email").fill(FIXTURE_STAFF_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(FIXTURE_STAFF_EMAIL)).toBeVisible();

    // Owner's own row has no deactivate/reactivate control (no self-deactivation).
    const ownerRow = page.locator("tr", { hasText: FIXTURE_OWNER_EMAIL });
    await expect(ownerRow.getByRole("button")).toHaveCount(0);

    const staffPage = await context.newPage();
    await staffPage.goto("/sign-in");
    await staffPage.getByLabel("Email").fill(FIXTURE_STAFF_EMAIL);
    await staffPage.getByLabel("Password").fill("password1234");
    await staffPage.getByRole("button", { name: "Sign in" }).click();
    await expect(staffPage).toHaveURL(new RegExp(`/r/${FIXTURE_SLUG}/dashboard`));
    await staffPage.close();

    const staffRow = page.locator("tr", { hasText: FIXTURE_STAFF_EMAIL });
    await staffRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(staffRow.getByRole("button", { name: "Reactivate" })).toBeVisible();

    const deactivatedPage = await context.newPage();
    await deactivatedPage.goto("/sign-in");
    await deactivatedPage.getByLabel("Email").fill(FIXTURE_STAFF_EMAIL);
    await deactivatedPage.getByLabel("Password").fill("password1234");
    await deactivatedPage.getByRole("button", { name: "Sign in" }).click();
    await expect(deactivatedPage).toHaveURL(/\/sign-in/);
    await deactivatedPage.close();
  });
});
```

- [ ] **Step 2: Build production and run the e2e suite**

Check for and stop any stale server on port 3000 first (`netstat -ano | findstr :3000` then `taskkill //F //PID <pid>` if one is listed).

Run: `npx next build && npx next start`
(In a separate terminal, once the server is up) Run: `npx playwright test e2e/phase8-settings.spec.ts`
Expected: both tests PASS.

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npx playwright test`
Expected: all suites pass (the existing 16 tests plus this phase's 2 new ones).

- [ ] **Step 4: Stop the production server**

Find its PID (`netstat -ano | findstr :3000`) and stop it (`taskkill //F //PID <pid>`) so nothing is left running.

- [ ] **Step 5: Commit**

```bash
git add e2e/phase8-settings.spec.ts
git commit -m "test: add Phase 8 Settings e2e coverage"
```
