# Phase 3: Reservations Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/r/[slug]/reservations` and `/r/[slug]/customers` from stub pages into a working booking flow — create/edit reservations through a modal with guest-matching and table-conflict checking, view them in Day/Week/Timeline calendars, and browse customers with their reservation history.

**Architecture:** New `Table`/`Customer`/`Reservation` Prisma models. Pure, unit-tested logic (overlap detection, guest-matching keys, date-range math) is isolated from Prisma/Next.js so it's fast to test. A thin data-access layer wraps Prisma for the two integration-level operations (find-or-create customer, table-conflict check). Next.js Server Actions handle all writes (create/update reservation, create table); Server Components fetch and render; calendar search/filter/view state lives in the URL so it's shareable and the server re-fetches on change.

**Tech Stack:** Next.js 15 Server Components + Server Actions, Prisma 7 (driver adapter, per Phase 1's amendment), shadcn/ui (Dialog, Sheet, Select, Textarea, Table, Badge, Tabs), native `<input type="date">`/`<input type="time">` (see Global Constraints), Vitest, Playwright.

## Global Constraints

- Reservation duration: fixed 90-minute default, editable per booking (no restaurant-level setting yet — Phase 8).
- Reservation statuses: `CONFIRMED`, `SEATED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Customers are never created/edited directly — only via the reservation modal's guest-matching step.
- Table has no position/shape/status fields yet (Phase 4 adds those to this same model).
- `ponytail:` Date/time pickers use native `<input type="date">`/`<input type="time">` rather than a custom calendar-popover component — fewer moving parts, fully accessible, and the spec didn't call for anything fancier in this phase. Upgrade to a custom picker only if a real UX complaint shows up.
- `ponytail:` Table-conflict checking bounds its query to the reservation's own calendar day (local time) — a reservation starting near midnight with a long duration could theoretically miss a conflict just after midnight. Acceptable ceiling until Phase 8 models real business hours; note it, don't solve it now.
- Every task must leave `pnpm dev` (or `pnpm build && pnpm start`) in a runnable state.

---

## File Structure

```
prisma/
  schema.prisma                        # modify: add Table/Customer/Reservation + Restaurant relations

src/lib/
  reservation-conflicts.ts             # pure: doesOverlap()
  customer-matching.ts                 # pure: normalizePhone/normalizeEmail/customerMatchKey
  reservation-dates.ts                 # pure: getDayRange()/getWeekRange()
  reservations-data.ts                 # server-only data access: findOrCreateCustomer, hasTableConflict, listTables
  auth-guards.ts                       # modify: export getSessionUser, add assertRestaurantMember (for Server Actions)

src/app/(dashboard)/r/[slug]/reservations/
  page.tsx                             # replaces stub — Server Component, reads searchParams, fetches data
  actions.ts                           # "use server" — createReservationAction, updateReservationAction, createTableAction
  reservations-calendar.tsx            # Client Component — toolbar + view switch + modal orchestration
  day-view.tsx
  week-view.tsx
  timeline-view.tsx
  reservation-badge.tsx                # shared status-colored badge
  reservation-modal.tsx                # Dialog — create/edit form
  tables-manager-dialog.tsx            # Dialog — list + add tables

src/app/(dashboard)/r/[slug]/customers/
  page.tsx                             # replaces stub — Server Component, fetches customers + reservations
  customer-list.tsx                    # Client Component — table + Sheet detail view

tests/
  reservation-conflicts.test.ts
  customer-matching.test.ts
  reservation-dates.test.ts

e2e/
  phase3-reservations.spec.ts
```

---

### Task 1: Data model — Table, Customer, Reservation

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma.table`, `prisma.customer`, `prisma.reservation` (with `ReservationStatus` enum: `CONFIRMED | SEATED | COMPLETED | CANCELLED | NO_SHOW`) — consumed by every later task in this plan.

- [ ] **Step 1: Add the models**

Append to `prisma/schema.prisma` (after the existing `Restaurant` model), and add the three new relation lines to the existing `Restaurant` model:

```prisma
model Restaurant {
  id        String           @id @default(cuid())
  name      String
  slug      String           @unique
  status    RestaurantStatus @default(ACTIVE)
  createdAt DateTime         @default(now())
  users     User[]
  tables       Table[]
  customers    Customer[]
  reservations Reservation[]

  @@map("restaurant")
}
```

Then append these new models to the end of the file:

```prisma
model Table {
  id           String        @id @default(cuid())
  restaurantId String
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id])
  number       String
  capacity     Int
  area         String?
  reservations Reservation[]
  createdAt    DateTime      @default(now())

  @@unique([restaurantId, number])
  @@map("table")
}

model Customer {
  id           String        @id @default(cuid())
  restaurantId String
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id])
  name         String
  email        String?
  phone        String?
  reservations Reservation[]
  createdAt    DateTime      @default(now())

  @@map("customer")
}

enum ReservationStatus {
  CONFIRMED
  SEATED
  COMPLETED
  CANCELLED
  NO_SHOW
}

model Reservation {
  id              String            @id @default(cuid())
  restaurantId    String
  restaurant      Restaurant        @relation(fields: [restaurantId], references: [id])
  customerId      String
  customer        Customer          @relation(fields: [customerId], references: [id])
  tableId         String?
  table           Table?            @relation(fields: [tableId], references: [id])
  partySize       Int
  startsAt        DateTime
  durationMinutes Int               @default(90)
  status          ReservationStatus @default(CONFIRMED)
  specialRequests String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@map("reservation")
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name reservations_core
```

Expected: `Your database is now in sync with your schema.` and a new `prisma/migrations/<timestamp>_reservations_core/` folder.

- [ ] **Step 3: Verify**

```bash
npx prisma studio
```

Expected: `table`, `customer`, `reservation` tables visible, all empty. Close Prisma Studio.

- [ ] **Step 4: Commit**

```bash
git add prisma
git commit -m "feat: add Table, Customer, Reservation models"
```

---

### Task 2: Pure logic — conflicts, guest matching, date ranges (TDD)

**Files:**
- Create: `src/lib/reservation-conflicts.ts`, `src/lib/customer-matching.ts`, `src/lib/reservation-dates.ts`
- Test: `tests/reservation-conflicts.test.ts`, `tests/customer-matching.test.ts`, `tests/reservation-dates.test.ts`

**Interfaces:**
- Produces: `doesOverlap(a: TimeRange, b: TimeRange): boolean`, `TimeRange = { startsAt: Date; durationMinutes: number }`; `normalizePhone(phone: string): string`, `normalizeEmail(email: string): string`, `customerMatchKey(input: { phone?: string | null; email?: string | null }): { field: "phone" | "email"; value: string } | null`; `getDayRange(date: Date): { start: Date; end: Date }`, `getWeekRange(date: Date): { start: Date; end: Date }` — all consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

`tests/reservation-conflicts.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { doesOverlap } from "@/lib/reservation-conflicts";

describe("doesOverlap", () => {
  it("detects overlapping ranges", () => {
    const a = { startsAt: new Date("2026-01-01T19:00:00"), durationMinutes: 90 };
    const b = { startsAt: new Date("2026-01-01T19:30:00"), durationMinutes: 60 };
    expect(doesOverlap(a, b)).toBe(true);
  });

  it("does not flag ranges that don't touch", () => {
    const a = { startsAt: new Date("2026-01-01T19:00:00"), durationMinutes: 60 };
    const b = { startsAt: new Date("2026-01-01T21:00:00"), durationMinutes: 60 };
    expect(doesOverlap(a, b)).toBe(false);
  });

  it("treats back-to-back ranges (end === start) as non-overlapping", () => {
    const a = { startsAt: new Date("2026-01-01T19:00:00"), durationMinutes: 60 };
    const b = { startsAt: new Date("2026-01-01T20:00:00"), durationMinutes: 60 };
    expect(doesOverlap(a, b)).toBe(false);
  });
});
```

`tests/customer-matching.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { normalizePhone, normalizeEmail, customerMatchKey } from "@/lib/customer-matching";

describe("normalizePhone", () => {
  it("strips non-digit characters", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Max@Example.com  ")).toBe("max@example.com");
  });
});

describe("customerMatchKey", () => {
  it("prefers phone over email when both are present", () => {
    expect(customerMatchKey({ phone: "555-123-4567", email: "max@example.com" })).toEqual({
      field: "phone",
      value: "5551234567",
    });
  });

  it("falls back to email when phone is absent", () => {
    expect(customerMatchKey({ phone: null, email: "Max@Example.com" })).toEqual({
      field: "email",
      value: "max@example.com",
    });
  });

  it("returns null when neither is present", () => {
    expect(customerMatchKey({ phone: null, email: null })).toBeNull();
  });
});
```

`tests/reservation-dates.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getDayRange, getWeekRange } from "@/lib/reservation-dates";

describe("getDayRange", () => {
  it("returns midnight-to-midnight for the given date", () => {
    const { start, end } = getDayRange(new Date("2026-03-10T14:30:00"));
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("getWeekRange", () => {
  it("starts on Monday for a mid-week date", () => {
    const { start } = getWeekRange(new Date("2026-03-11T00:00:00")); // Wednesday
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getDate()).toBe(9);
  });

  it("starts on the preceding Monday for a Sunday date", () => {
    const { start } = getWeekRange(new Date("2026-03-15T00:00:00")); // Sunday
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(9);
  });

  it("spans exactly 7 days", () => {
    const { start, end } = getWeekRange(new Date("2026-03-11T00:00:00"));
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/reservation-conflicts'` (and similarly for the other two).

- [ ] **Step 3: Implement**

`src/lib/reservation-conflicts.ts`:

```typescript
export type TimeRange = { startsAt: Date; durationMinutes: number };

export function doesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = a.startsAt.getTime();
  const aEnd = aStart + a.durationMinutes * 60_000;
  const bStart = b.startsAt.getTime();
  const bEnd = bStart + b.durationMinutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
}
```

`src/lib/customer-matching.ts`:

```typescript
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function customerMatchKey(
  input: { phone?: string | null; email?: string | null }
): { field: "phone"; value: string } | { field: "email"; value: string } | null {
  const phone = input.phone ? normalizePhone(input.phone) : "";
  if (phone) return { field: "phone", value: phone };

  const email = input.email ? normalizeEmail(input.email) : "";
  if (email) return { field: "email", value: email };

  return null;
}
```

`src/lib/reservation-dates.ts`:

```typescript
export function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm test`
Expected: PASS — all tests across the three new files green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reservation-conflicts.ts src/lib/customer-matching.ts src/lib/reservation-dates.ts tests/reservation-conflicts.test.ts tests/customer-matching.test.ts tests/reservation-dates.test.ts
git commit -m "feat: add pure reservation conflict/matching/date-range helpers with tests"
```

---

### Task 3: Data-access layer — find-or-create customer, table-conflict check

**Files:**
- Create: `src/lib/reservations-data.ts`, `scripts/smoke-reservations-data.ts` (temporary, deleted at the end of this task)

**Interfaces:**
- Consumes: `doesOverlap` (Task 2), `normalizeEmail`/`normalizePhone`/`customerMatchKey` (Task 2), `getDayRange` (Task 2), `prisma` (Phase 1).
- Produces: `findOrCreateCustomer(restaurantId: string, input: { name: string; email?: string | null; phone?: string | null }): Promise<Customer>`, `hasTableConflict(tableId: string, startsAt: Date, durationMinutes: number, excludeReservationId?: string): Promise<boolean>`, `listTables(restaurantId: string): Promise<Table[]>` — consumed by Task 4.

- [ ] **Step 1: Implement**

`src/lib/reservations-data.ts`:

```typescript
import "server-only";
import { prisma } from "@/lib/prisma";
import { doesOverlap } from "@/lib/reservation-conflicts";
import { customerMatchKey, normalizeEmail, normalizePhone } from "@/lib/customer-matching";
import { getDayRange } from "@/lib/reservation-dates";

export async function findOrCreateCustomer(
  restaurantId: string,
  input: { name: string; email?: string | null; phone?: string | null }
) {
  const key = customerMatchKey(input);
  if (key) {
    const existing = await prisma.customer.findFirst({
      where: { restaurantId, [key.field]: key.value },
    });
    if (existing) {
      if (existing.name !== input.name) {
        return prisma.customer.update({ where: { id: existing.id }, data: { name: input.name } });
      }
      return existing;
    }
  }

  return prisma.customer.create({
    data: {
      restaurantId,
      name: input.name,
      email: input.email ? normalizeEmail(input.email) : null,
      phone: input.phone ? normalizePhone(input.phone) : null,
    },
  });
}

// ponytail: bounds the conflict search to the reservation's own calendar day.
// A reservation starting near midnight with a long duration could miss a
// conflict just after midnight — acceptable until Phase 8 models real
// business hours.
export async function hasTableConflict(
  tableId: string,
  startsAt: Date,
  durationMinutes: number,
  excludeReservationId?: string
): Promise<boolean> {
  const { start, end } = getDayRange(startsAt);
  const candidates = await prisma.reservation.findMany({
    where: {
      tableId,
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { gte: start, lt: end },
    },
    select: { startsAt: true, durationMinutes: true },
  });
  return candidates.some((c) => doesOverlap({ startsAt, durationMinutes }, c));
}

export async function listTables(restaurantId: string) {
  return prisma.table.findMany({ where: { restaurantId }, orderBy: { number: "asc" } });
}
```

- [ ] **Step 2: Verify against the seeded database**

`scripts/smoke-reservations-data.ts` (temporary):

```typescript
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { findOrCreateCustomer, hasTableConflict, listTables } from "@/lib/reservations-data";

async function main() {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug: "blue-fork" } });

  const a = await findOrCreateCustomer(restaurant.id, { name: "Jane Doe", phone: "(555) 111-2222" });
  const b = await findOrCreateCustomer(restaurant.id, { name: "Jane Doe", phone: "555.111.2222" });
  console.log("same customer reused:", a.id === b.id);

  const table = await prisma.table.create({
    data: { restaurantId: restaurant.id, number: "T-SMOKE", capacity: 4 },
  });
  const startsAt = new Date("2026-06-01T19:00:00");
  const reservation = await prisma.reservation.create({
    data: { restaurantId: restaurant.id, customerId: a.id, tableId: table.id, partySize: 2, startsAt, durationMinutes: 90 },
  });

  const conflicting = await hasTableConflict(table.id, new Date("2026-06-01T19:30:00"), 60);
  const nonConflicting = await hasTableConflict(table.id, new Date("2026-06-01T21:00:00"), 60);
  const excludedSelf = await hasTableConflict(table.id, startsAt, 90, reservation.id);
  console.log("conflict detected:", conflicting, "| no conflict:", !nonConflicting, "| self-excluded:", !excludedSelf);

  const tables = await listTables(restaurant.id);
  console.log("tables found:", tables.length > 0);

  await prisma.reservation.delete({ where: { id: reservation.id } });
  await prisma.table.delete({ where: { id: table.id } });
  await prisma.customer.delete({ where: { id: a.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Run: `npx tsx scripts/smoke-reservations-data.ts`
Expected: `same customer reused: true`, `conflict detected: true | no conflict: true | self-excluded: true`, `tables found: true`.

- [ ] **Step 3: Delete the smoke script**

```bash
rm scripts/smoke-reservations-data.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/reservations-data.ts
git commit -m "feat: add reservation data-access layer (guest matching, conflict check)"
```

---

### Task 4: Server Actions — create/update reservation, create table

**Files:**
- Modify: `src/lib/auth-guards.ts`
- Create: `src/app/(dashboard)/r/[slug]/reservations/actions.ts`, `scripts/smoke-reservation-actions.ts` (temporary)

**Interfaces:**
- Consumes: `findOrCreateCustomer`, `hasTableConflict` (Task 3), `prisma` (Phase 1).
- Produces: `assertRestaurantMember(slug: string): Promise<{ user: SessionUser; restaurant: Restaurant }>` (exported from `auth-guards.ts`); `ReservationInput` type, `ReservationActionResult = { ok: true } | { ok: false; error: string }`, `createReservationAction(slug: string, input: ReservationInput): Promise<ReservationActionResult>`, `updateReservationAction(slug: string, reservationId: string, input: ReservationInput): Promise<ReservationActionResult>`, `createTableAction(slug: string, input: { number: string; capacity: number; area: string }): Promise<ReservationActionResult>` — all consumed by Task 6 (modal) and Task 9 (tables manager).

- [ ] **Step 1: Add a Server-Action-safe auth guard**

In `src/lib/auth-guards.ts`, rename the existing private `getSessionUser` to be exported (so it can be reused), and add `assertRestaurantMember`. Find this block:

```typescript
async function getSessionUser(): Promise<SessionUser | null> {
```

Replace just that line with:

```typescript
export async function getSessionUser(): Promise<SessionUser | null> {
```

Then add this new function at the end of the file:

```typescript
// For Server Actions: throws a plain Error instead of calling redirect()/
// notFound(), since those Next.js functions assume a render context that
// Server Actions don't reliably provide.
export async function assertRestaurantMember(slug: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  if (!canAccessRestaurant(user, slug)) throw new Error("Not authorized for this restaurant");

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") throw new Error("Restaurant not found");

  return { user, restaurant };
}
```

- [ ] **Step 2: Write the Server Actions**

`src/app/(dashboard)/r/[slug]/reservations/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
import { assertRestaurantMember } from "@/lib/auth-guards";
import type { ReservationStatus } from "@/generated/prisma/client";

export type ReservationInput = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  specialRequests: string;
  tableId: string | null;
  status?: ReservationStatus;
};

export type ReservationActionResult = { ok: true } | { ok: false; error: string };

export async function createReservationAction(
  slug: string,
  input: ReservationInput
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const startsAt = new Date(`${input.date}T${input.time}`);

  if (input.tableId) {
    const conflict = await hasTableConflict(input.tableId, startsAt, input.durationMinutes);
    if (conflict) return { ok: false, error: "That table is already booked for an overlapping time." };
  }

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail || null,
    phone: input.guestPhone || null,
  });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId: input.tableId,
      partySize: input.partySize,
      startsAt,
      durationMinutes: input.durationMinutes,
      specialRequests: input.specialRequests || null,
    },
  });

  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/customers`);
  return { ok: true };
}

export async function updateReservationAction(
  slug: string,
  reservationId: string,
  input: ReservationInput
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const startsAt = new Date(`${input.date}T${input.time}`);

  if (input.tableId) {
    const conflict = await hasTableConflict(input.tableId, startsAt, input.durationMinutes, reservationId);
    if (conflict) return { ok: false, error: "That table is already booked for an overlapping time." };
  }

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail || null,
    phone: input.guestPhone || null,
  });

  const { count } = await prisma.reservation.updateMany({
    where: { id: reservationId, restaurantId: restaurant.id },
    data: {
      customerId: customer.id,
      tableId: input.tableId,
      partySize: input.partySize,
      startsAt,
      durationMinutes: input.durationMinutes,
      specialRequests: input.specialRequests || null,
      status: input.status,
    },
  });
  if (count === 0) return { ok: false, error: "Reservation not found." };

  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/customers`);
  return { ok: true };
}

export async function createTableAction(
  slug: string,
  input: { number: string; capacity: number; area: string }
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  await prisma.table.create({
    data: {
      restaurantId: restaurant.id,
      number: input.number,
      capacity: input.capacity,
      area: input.area || null,
    },
  });
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}
```

- [ ] **Step 3 (adjusted): Verify**

> **Amendment (2026-07-10):** The tsx-smoke-script pattern from Tasks 2/3 doesn't work here — `assertRestaurantMember` calls `getSessionUser`, which calls `next/headers`'s `headers()`. That function requires an active Next.js request context (AsyncLocalStorage-backed), which a standalone script can never provide — confirmed via `Error: \`headers\` was called outside a request scope`. This is a hard runtime constraint, not a bundler-config issue like Task 3's `server-only` problem, so there's no workaround short of a real HTTP request. Verify with a type-check only here; full behavioral verification (conflict rejection, guest matching, status updates) happens in Task 10's manual click-through and Task 12's Playwright e2e, both of which run against a real server.

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-guards.ts "src/app/(dashboard)/r/[slug]/reservations/actions.ts"
git commit -m "feat: add reservation/table Server Actions with conflict checking"
```

---

### Task 5: shadcn primitives + status badge

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reservations/reservation-badge.tsx`

**Interfaces:**
- Produces: `<ReservationBadge status={ReservationStatus} />` — consumed by Task 6, 7, 8, 9.

- [ ] **Step 1: Add the shadcn primitives this phase needs**

```bash
npx shadcn@latest add dialog sheet select textarea table badge tabs
```

- [ ] **Step 2: Status badge component**

`src/app/(dashboard)/r/[slug]/reservations/reservation-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ReservationStatus, string> = {
  CONFIRMED: "bg-primary/10 text-primary",
  SEATED: "bg-emerald-500/10 text-emerald-600",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  NO_SHOW: "bg-amber-500/10 text-amber-600",
};

const STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  SEATED: "Seated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function ReservationBadge({ status }: { status: ReservationStatus }) {
  return (
    <Badge className={cn("font-medium", STATUS_STYLES[status])} variant="outline">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui src/app/"(dashboard)"/r/"[slug]"/reservations/reservation-badge.tsx components.json package.json pnpm-lock.yaml
git commit -m "feat: add shadcn dialog/sheet/select/textarea/table/badge/tabs and status badge"
```

---

### Task 6: Reservation modal (create/edit)

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx`

**Interfaces:**
- Consumes: `createReservationAction`, `updateReservationAction`, `ReservationInput` (Task 4); shadcn `Dialog`/`Select`/`Textarea`/`Input`/`Label`/`Button` (Task 5, Phase 1).
- Produces: `<ReservationModal open, onOpenChange, slug, tables, reservation?, onSaved />` — consumed by Task 10 (calendar page wiring). `reservation` prop present = edit mode; absent = create mode.

- [ ] **Step 1: Implement**

`src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createReservationAction, updateReservationAction, type ReservationInput } from "./actions";
import type { ReservationStatus } from "@/generated/prisma/client";

export type TableOption = { id: string; number: string; capacity: number };

export type ReservationForEdit = {
  id: string;
  partySize: number;
  startsAt: Date;
  durationMinutes: number;
  status: ReservationStatus;
  specialRequests: string | null;
  tableId: string | null;
  customer: { name: string; email: string | null; phone: string | null };
};

const DURATION_OPTIONS = [30, 60, 90, 120, 150];
const STATUS_OPTIONS: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ReservationModal({
  open,
  onOpenChange,
  slug,
  tables,
  reservation,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tables: TableOption[];
  reservation?: ReservationForEdit;
  onSaved: () => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [specialRequests, setSpecialRequests] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [status, setStatus] = useState<ReservationStatus>("CONFIRMED");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (reservation) {
      setGuestName(reservation.customer.name);
      setGuestEmail(reservation.customer.email ?? "");
      setGuestPhone(reservation.customer.phone ?? "");
      setPartySize(reservation.partySize);
      setDate(toDateInput(reservation.startsAt));
      setTime(toTimeInput(reservation.startsAt));
      setDurationMinutes(reservation.durationMinutes);
      setSpecialRequests(reservation.specialRequests ?? "");
      setTableId(reservation.tableId);
      setStatus(reservation.status);
    } else {
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setPartySize(2);
      setDate(toDateInput(new Date()));
      setTime("19:00");
      setDurationMinutes(90);
      setSpecialRequests("");
      setTableId(null);
      setStatus("CONFIRMED");
    }
  }, [open, reservation]);

  const availableTables = tables.filter((t) => t.capacity >= partySize);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const input: ReservationInput = {
      guestName,
      guestEmail,
      guestPhone,
      partySize,
      date,
      time,
      durationMinutes,
      specialRequests,
      tableId,
      status: reservation ? status : undefined,
    };

    const result = reservation
      ? await updateReservationAction(slug, reservation.id, input)
      : await createReservationAction(slug, input);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reservation ? "Edit reservation" : "New reservation"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Guest information</h3>
            <div className="space-y-2">
              <Label htmlFor="guestName">Name</Label>
              <Input id="guestName" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="guestEmail">Email</Label>
                <Input id="guestEmail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestPhone">Phone</Label>
                <Input id="guestPhone" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Reservation details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="partySize">Party size</Label>
                <Input
                  id="partySize"
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={String(durationMinutes)} onValueChange={(v) => setDurationMinutes(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialRequests">Special requests</Label>
              <Textarea id="specialRequests" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableId">Assigned table</Label>
            <Select value={tableId ?? "none"} onValueChange={(v) => setTableId(v === "none" ? null : v)}>
              <SelectTrigger id="tableId">
                <SelectValue placeholder="No table assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No table assigned</SelectItem>
                {availableTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.number} (seats {t.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reservation && (
            <div className="space-y-2">
              <Label htmlFor="status">Reservation status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ReservationStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-base text-destructive">{error}</p>}

          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Saving..." : reservation ? "Save changes" : "Confirm reservation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors. (Rendered/functional verification happens once Task 10 wires this into the page.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx"
git commit -m "feat: add reservation create/edit modal"
```

---

### Task 7: Calendar Day view

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reservations/day-view.tsx`

**Interfaces:**
- Consumes: `ReservationBadge` (Task 5).
- Produces: `<DayView reservations, onReservationClick />` — consumed by Task 10.

- [ ] **Step 1: Implement**

`src/app/(dashboard)/r/[slug]/reservations/day-view.tsx`:

```tsx
"use client";

import { ReservationBadge } from "./reservation-badge";
import type { ReservationStatus } from "@/generated/prisma/client";

export type ReservationListItem = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  partySize: number;
  status: ReservationStatus;
  specialRequests: string | null;
  tableId: string | null;
  table: { number: string } | null;
  customer: { name: string; email: string | null; phone: string | null };
};

export function DayView({
  reservations,
  onReservationClick,
}: {
  reservations: ReservationListItem[];
  onReservationClick: (id: string) => void;
}) {
  const sorted = [...reservations].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (sorted.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">No reservations for this day.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {sorted.map((r) => (
        <li
          key={r.id}
          onClick={() => onReservationClick(r.id)}
          className="flex cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted"
        >
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
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/day-view.tsx"
git commit -m "feat: add reservations Day view"
```

---

### Task 8: Calendar Week view

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reservations/week-view.tsx`

**Interfaces:**
- Consumes: `ReservationListItem` (Task 7).
- Produces: `<WeekView reservations, weekStart, onDayClick, onReservationClick />` — consumed by Task 10.

- [ ] **Step 1: Implement**

`src/app/(dashboard)/r/[slug]/reservations/week-view.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { ReservationListItem } from "./day-view";

export function WeekView({
  reservations,
  weekStart,
  onDayClick,
  onReservationClick,
}: {
  reservations: ReservationListItem[];
  weekStart: Date;
  onDayClick: (date: Date) => void;
  onReservationClick: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayReservations = reservations
          .filter((r) => r.startsAt.toDateString() === day.toDateString())
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        const isToday = day.toDateString() === new Date().toDateString();

        return (
          <div key={day.toISOString()} className="min-h-40 rounded-xl border border-border p-2">
            <button
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                "mb-2 w-full rounded-lg px-2 py-1 text-left text-base font-medium hover:bg-muted",
                isToday && "bg-primary/10 text-primary"
              )}
            >
              {day.toLocaleDateString([], { weekday: "short", day: "numeric" })}
            </button>
            <div className="space-y-1">
              {dayReservations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onReservationClick(r.id)}
                  className="block w-full truncate rounded-md bg-primary/10 px-2 py-1 text-left text-xs text-primary hover:bg-primary/20"
                >
                  {r.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {r.customer.name}
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

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/week-view.tsx"
git commit -m "feat: add reservations Week view"
```

---

### Task 9: Calendar Timeline view + Tables manager dialog

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx`, `src/app/(dashboard)/r/[slug]/reservations/tables-manager-dialog.tsx`

**Interfaces:**
- Consumes: `ReservationListItem` (Task 7), `createTableAction` (Task 4).
- Produces: `<TimelineView reservations, tables, onReservationClick />`, `<TablesManagerDialog open, onOpenChange, slug, tables, onSaved />` — both consumed by Task 10.

- [ ] **Step 1: Timeline view**

`src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { ReservationListItem } from "./day-view";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

export function TimelineView({
  reservations,
  tables,
  onReservationClick,
}: {
  reservations: ReservationListItem[];
  tables: { id: string; number: string }[];
  onReservationClick: (id: string) => void;
}) {
  if (tables.length === 0) {
    return <p className="py-16 text-center text-base text-muted-foreground">Add a table to see the timeline.</p>;
  }

  function offsetPercent(startsAt: Date) {
    const minutesSinceStart = (startsAt.getHours() - DAY_START_HOUR) * 60 + startsAt.getMinutes();
    return Math.max(0, Math.min(100, (minutesSinceStart / TOTAL_MINUTES) * 100));
  }
  function widthPercent(durationMinutes: number) {
    return Math.max(2, (durationMinutes / TOTAL_MINUTES) * 100);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      {tables.map((table) => {
        const tableReservations = reservations.filter((r) => r.tableId === table.id);
        return (
          <div key={table.id} className="flex border-b border-border last:border-b-0">
            <div className="w-24 shrink-0 border-r border-border p-3 text-base font-medium">
              Table {table.number}
            </div>
            <div className="relative h-14 min-w-[600px] flex-1">
              {tableReservations.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onReservationClick(r.id)}
                  className={cn(
                    "absolute top-1/2 h-10 -translate-y-1/2 truncate rounded-lg bg-primary/15 px-2 text-left text-xs font-medium text-primary hover:bg-primary/25"
                  )}
                  style={{ left: `${offsetPercent(r.startsAt)}%`, width: `${widthPercent(r.durationMinutes)}%` }}
                >
                  {r.customer.name}
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

- [ ] **Step 2: Tables manager dialog**

`src/app/(dashboard)/r/[slug]/reservations/tables-manager-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTableAction } from "./actions";

export type TableRow = { id: string; number: string; capacity: number; area: string | null };

export function TablesManagerDialog({
  open,
  onOpenChange,
  slug,
  tables,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tables: TableRow[];
  onSaved: () => void;
}) {
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createTableAction(slug, { number, capacity, area });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNumber("");
    setCapacity(2);
    setArea("");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage tables</DialogTitle>
        </DialogHeader>

        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {tables.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-base">
              <span>Table {t.number}{t.area ? ` · ${t.area}` : ""}</span>
              <span className="text-muted-foreground">seats {t.capacity}</span>
            </li>
          ))}
          {tables.length === 0 && <p className="text-base text-muted-foreground">No tables yet.</p>}
        </ul>

        <form onSubmit={handleAdd} className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tableNumber">Number</Label>
            <Input id="tableNumber" value={number} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tableCapacity">Capacity</Label>
            <Input
              id="tableCapacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tableArea">Area</Label>
            <Input id="tableArea" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          {error && <p className="col-span-3 text-base text-destructive">{error}</p>}
          <Button type="submit" className="col-span-3" disabled={saving}>
            {saving ? "Adding..." : "Add table"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx" "src/app/(dashboard)/r/[slug]/reservations/tables-manager-dialog.tsx"
git commit -m "feat: add reservations Timeline view and tables manager dialog"
```

---

### Task 10: Reservations page — toolbar, view switching, wiring

> **Amendments (2026-07-10), found via manual click-through against a production build:**
> 1. `createTableAction` (Task 4) crashed uncaught on a duplicate table number (`P2002` unique constraint) instead of returning a friendly `{ok: false, error}` — the modal was left silently stuck open. Wrapped the create call in try/catch, returning `Table "X" already exists.` for that case and re-throwing anything else.
> 2. The reservation modal's edit-mode "Status" label collided with the toolbar's status-filter `<div role="group" aria-label="Filter by status">` — Playwright's `getByLabel("Status")` substring-matches both, so it errors with "resolved to 2 elements." Renamed the modal's field label to "Reservation status" (Task 6's code and Task 12's e2e test both updated).
> 3. `getByText("Seated")` (Task 12) is case-insensitive by default, so it also matched the toolbar's uppercase "SEATED" filter chip and the Select's lingering value/listbox markup ("resolved to 3 elements"). Added `{ exact: true }`, which Playwright also makes case-sensitive.

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/page.tsx` (replaces the Phase 1 stub)

**Interfaces:**
- Consumes: `DayView`/`WeekView`/`TimelineView`/`ReservationModal`/`TablesManagerDialog` (Tasks 6-9), `getDayRange`/`getWeekRange` (Task 2), `prisma` (Phase 1).
- Produces: the real `/r/[slug]/reservations` page — nothing later in this plan consumes it directly, but it's the integration point Task 12 (e2e) exercises.

- [ ] **Step 1: Client orchestrator**

`src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DayView, type ReservationListItem } from "./day-view";
import { WeekView } from "./week-view";
import { TimelineView } from "./timeline-view";
import { ReservationModal, type ReservationForEdit, type TableOption } from "./reservation-modal";
import { TablesManagerDialog, type TableRow } from "./tables-manager-dialog";
import type { ReservationStatus } from "@/generated/prisma/client";

export type CalendarView = "day" | "week" | "timeline";

const ALL_STATUSES: ReservationStatus[] = ["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export function ReservationsCalendar({
  slug,
  view,
  date,
  reservations,
  tables,
}: {
  slug: string;
  view: CalendarView;
  date: Date;
  reservations: ReservationListItem[];
  tables: TableRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tablesOpen, setTablesOpen] = useState(false);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    updateParams({ date: d.toISOString().slice(0, 10) });
  }

  const selectedStatuses = (searchParams.get("status") ?? "").split(",").filter(Boolean) as ReservationStatus[];

  function toggleStatus(s: ReservationStatus) {
    const next = selectedStatuses.includes(s)
      ? selectedStatuses.filter((x) => x !== s)
      : [...selectedStatuses, s];
    updateParams({ status: next.join(",") });
  }

  const editing = editingId ? reservations.find((r) => r.id === editingId) : undefined;
  const editingForModal: ReservationForEdit | undefined = editing
    ? {
        id: editing.id,
        partySize: editing.partySize,
        startsAt: editing.startsAt,
        durationMinutes: editing.durationMinutes,
        status: editing.status,
        specialRequests: editing.specialRequests,
        tableId: editing.tableId,
        customer: { name: editing.customer.name, email: editing.customer.email, phone: editing.customer.phone },
      }
    : undefined;

  const tableOptions: TableOption[] = tables.map((t) => ({ id: t.id, number: t.number, capacity: t.capacity }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => updateParams({ view: v })}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftDate(view === "week" ? -7 : -1)}>
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateParams({ date: new Date().toISOString().slice(0, 10) })}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftDate(view === "week" ? 7 : 1)}>
            Next
          </Button>
        </div>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                selectedStatuses.includes(s)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search guest name or phone"
            defaultValue={searchParams.get("q") ?? ""}
            className="h-9 w-56"
            onChange={(e) => updateParams({ q: e.target.value })}
          />
          <Button variant="outline" onClick={() => setTablesOpen(true)}>
            Manage tables
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setModalOpen(true);
            }}
          >
            New reservation
          </Button>
        </div>
      </div>

      {view === "day" && (
        <DayView
          reservations={reservations}
          onReservationClick={(id) => {
            setEditingId(id);
            setModalOpen(true);
          }}
        />
      )}
      {view === "week" && (
        <WeekView
          reservations={reservations}
          weekStart={date}
          onDayClick={(d) => updateParams({ view: "day", date: d.toISOString().slice(0, 10) })}
          onReservationClick={(id) => {
            setEditingId(id);
            setModalOpen(true);
          }}
        />
      )}
      {view === "timeline" && (
        <TimelineView
          reservations={reservations}
          tables={tables}
          onReservationClick={(id) => {
            setEditingId(id);
            setModalOpen(true);
          }}
        />
      )}

      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        slug={slug}
        tables={tableOptions}
        reservation={editingForModal}
        onSaved={() => router.refresh()}
      />
      <TablesManagerDialog
        open={tablesOpen}
        onOpenChange={setTablesOpen}
        slug={slug}
        tables={tables}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 2: Page (replaces the Phase 1 stub)**

`src/app/(dashboard)/r/[slug]/reservations/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getDayRange, getWeekRange } from "@/lib/reservation-dates";
import { ReservationsCalendar, type CalendarView } from "./reservations-calendar";
import type { ReservationStatus } from "@/generated/prisma/client";

export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; date?: string; q?: string; status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const view: CalendarView = sp.view === "week" || sp.view === "timeline" ? sp.view : "day";
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

  const tables = await prisma.table.findMany({ where: { restaurantId: restaurant.id }, orderBy: { number: "asc" } });

  return (
    <ReservationsCalendar
      slug={slug}
      view={view}
      date={view === "week" ? start : date}
      reservations={reservations}
      tables={tables}
    />
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Log in as `owner@blue-fork.example.com`, visit `/r/blue-fork/reservations`, use "Manage tables" to add one, create a reservation via "New reservation", confirm it appears in Day view, switch to Week and Timeline and confirm it's visible there too, click it to edit, change its status to Seated, confirm the badge updates, confirm the edit form still shows the special requests/email/phone you entered on create (not blanked out), then confirm the guest-name search box and the status filter chips both narrow the visible list correctly.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx" "src/app/(dashboard)/r/[slug]/reservations/page.tsx"
git commit -m "feat: wire reservations page with calendar toolbar and view switching"
```

---

### Task 11: Customers page

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/customers/customer-list.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/customers/page.tsx` (replaces the Phase 1 stub)

**Interfaces:**
- Consumes: `prisma` (Phase 1), shadcn `Sheet`/`Table` (Task 5).
- Produces: the real `/r/[slug]/customers` page — consumed by Task 12 (e2e).

- [ ] **Step 1: Client list + Sheet detail**

`src/app/(dashboard)/r/[slug]/customers/customer-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReservationBadge } from "../reservations/reservation-badge";
import type { ReservationStatus } from "@/generated/prisma/client";

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reservations: {
    id: string;
    startsAt: Date;
    partySize: number;
    status: ReservationStatus;
    table: { number: string } | null;
  }[];
};

export function CustomerList({ customers }: { customers: CustomerRow[] }) {
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Reservations</TableHead>
            <TableHead>Last visit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => {
            const sorted = [...c.reservations].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
            return (
              <TableRow key={c.id} onClick={() => setSelected(c)} className="cursor-pointer">
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone || c.email || "—"}</TableCell>
                <TableCell>{c.reservations.length}</TableCell>
                <TableCell>{sorted[0] ? sorted[0].startsAt.toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 px-4">
            {selected?.reservations
              .slice()
              .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{r.startsAt.toLocaleString()}</p>
                    <p className="text-base text-muted-foreground">
                      Party of {r.partySize}
                      {r.table ? ` · Table ${r.table.number}` : ""}
                    </p>
                  </div>
                  <ReservationBadge status={r.status} />
                </div>
              ))}
            {selected && selected.reservations.length === 0 && (
              <p className="text-base text-muted-foreground">No reservations yet.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: Page (replaces the Phase 1 stub)**

`src/app/(dashboard)/r/[slug]/customers/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { CustomerList } from "./customer-list";

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });

  const customers = await prisma.customer.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      reservations: {
        select: { id: true, startsAt: true, partySize: true, status: true, table: { select: { number: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <CustomerList customers={customers} />
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Visit `/r/blue-fork/customers` after creating a reservation in Task 10 — confirm the guest appears with correct reservation count, and clicking the row opens the Sheet with their reservation history.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/customers/customer-list.tsx" "src/app/(dashboard)/r/[slug]/customers/page.tsx"
git commit -m "feat: wire customers page with reservation-history detail panel"
```

---

### Task 12: Playwright e2e — Phase 3 Definition of Done

**Files:**
- Create: `e2e/phase3-reservations.spec.ts`

**Interfaces:**
- Consumes: the running production build (via `pnpm build && pnpm start`, per Phase 1's `playwright.config.ts`) and the seeded `owner@blue-fork.example.com` account.

- [ ] **Step 1: Write the test**

`e2e/phase3-reservations.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("owner@blue-fork.example.com");
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);
}

test.describe("Phase 3 reservations core", () => {
  test("create a table, book a reservation, see it across all calendar views, edit it, and find the guest in Customers", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");

    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill("E2E-1");
    await page.getByLabel("Capacity").fill("4");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByText("Table E2E-1")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("Taylor Guest");
    await page.getByLabel("Phone").fill("555-000-1111");
    await page.getByLabel("Party size").fill("3");
    await page.getByLabel("Date").fill("2026-08-01");
    await page.getByLabel("Time").fill("19:00");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: /Table E2E-1/ }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();

    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-01");
    await expect(page.getByText("Taylor Guest")).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=week&date=2026-08-01");
    await expect(page.getByText(/Taylor Guest/)).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=timeline&date=2026-08-01");
    await expect(page.getByText("Taylor Guest")).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-01");
    await page.getByText("Taylor Guest").click();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "SEATED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Seated", { exact: true })).toBeVisible();

    await page.goto("/r/blue-fork/customers");
    await expect(page.getByText("Taylor Guest")).toBeVisible();
    await page.getByText("Taylor Guest").click();
    await expect(page.getByText(/Party of 3/)).toBeVisible();
  });

  test("assigning an already-booked table at an overlapping time is rejected", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-02");

    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill("E2E-2");
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("First Guest");
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-02");
    await page.getByLabel("Time").fill("20:00");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: /Table E2E-2/ }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("Second Guest");
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-02");
    await page.getByLabel("Time").fill("20:30");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: /Table E2E-2/ }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();

    await expect(page.getByText("That table is already booked for an overlapping time.")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:e2e
```

Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/phase3-reservations.spec.ts
git commit -m "test: add Playwright coverage for Phase 3 definition of done"
```
