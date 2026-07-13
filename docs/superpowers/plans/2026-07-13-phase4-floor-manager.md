# Phase 4: Floor Manager + Smart Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/r/[slug]/floor-manager` from a stub page into a live visual floor plan — arrange tables freely on a canvas (position + round/square shape), see each table's status (Available/Reserved soon/Seated) derived automatically from today's reservations, seat walk-ins with one click, free a table when a party leaves, and get a smart best-fit table suggestion in the existing reservation modal.

**Architecture:** Two new nullable fields plus a shape enum on the existing `Table` model (no new models). Two new pure, unit-tested helpers — one derives a table's live status from reservation data, the other recommends the best-fit table for a party — both isolated from Prisma/Next.js so they're fast to test, mirroring Phase 3's pure-logic pattern. New Server Actions handle table-layout writes and walk-in seating; freeing a table and the smart-recommend feature both reuse/extend Phase 3's existing reservation infrastructure. Dragging uses plain pointer events (no drag-and-drop library), matching how the rest of this app avoids adding UI dependencies beyond shadcn.

**Tech Stack:** Next.js 15 Server Components + Server Actions, Prisma 7, shadcn/ui (Dialog, Button — both already installed, no new primitives needed), native Pointer Events API, Vitest, Playwright.

## Global Constraints

- No new models — `Table` gains `posX: Float?`, `posY: Float?`, `shape: TableShape @default(SQUARE)`. No width/height fields; visual size on the canvas is derived from the existing `capacity` field (small/medium/large tiers).
- "Reserved soon" window is a hardcoded 30 minutes (no per-restaurant setting yet — Phase 8).
- Floor Manager always shows today, live — no date picker (unlike the Reservations calendar).
- No "needs cleaning" state — a table goes directly from Seated back to Available.
- The Phase 3 "Manage tables" dialog on the Reservations page is unchanged and keeps owning table creation (number/capacity/area). Floor Manager's Edit Layout mode only arranges position/shape for tables that already exist.
- `ponytail:` Freeing a table calls a new, narrowly-scoped `setReservationStatusAction` (status only) rather than reusing Phase 3's `updateReservationAction`, which requires a full `ReservationInput` (guest name/email/phone) and would silently overwrite/clear the seated guest's contact info with blanks since the floor plan only has their name cached. A dedicated status-only action avoids that data loss.
- `ponytail:` The spec describes dragging a table from the "Unplaced tables" tray onto the canvas to set its initial position. This plan implements that as: click an unplaced table to drop it at a default spot (20, 20) on the canvas, then drag it like any other table using the same pointer-event mechanism. Same end result (place, then position), without needing separate cross-container native drag-and-drop wiring.
- Every task must leave `pnpm dev` (or `pnpm build && pnpm start`) in a runnable state.

---

## File Structure

```
prisma/
  schema.prisma                          # modify: TableShape enum + posX/posY/shape on Table

src/lib/
  table-status.ts                        # pure: getTableStatus()
  table-allocation.ts                    # pure: recommendTable()

src/app/(dashboard)/r/[slug]/floor-manager/
  actions.ts                              # "use server" — updateTableLayoutAction, quickSeatWalkInAction
  page.tsx                                # replaces stub — Server Component, fetches today's tables + reservations
  floor-plan.tsx                          # Client Component — canvas, status derivation, view mode, then Edit Layout mode
  table-box.tsx                           # single table box — shape/size/status styling, click + drag handlers
  quick-seat-dialog.tsx                   # Dialog — party size only
  seated-info-dialog.tsx                  # Dialog — guest info + Free table button

src/app/(dashboard)/r/[slug]/reservations/
  actions.ts                              # modify: add setReservationStatusAction
  reservation-modal.tsx                   # modify: add reservations prop, smart-recommend the table field
  reservations-calendar.tsx               # modify: pass reservations down to ReservationModal

tests/
  table-status.test.ts
  table-allocation.test.ts

e2e/
  phase4-floor-manager.spec.ts
```

---

### Task 1: Data model — Table gains position/shape

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `TableShape` enum (`SQUARE | ROUND`), `Table.posX`, `Table.posY`, `Table.shape` — consumed by every later task in this plan.

- [ ] **Step 1: Add the enum and fields**

In `prisma/schema.prisma`, add this enum right before the `model Table` block:

```prisma
enum TableShape {
  SQUARE
  ROUND
}
```

Then update the `Table` model to add the three new fields (`posX`, `posY`, `shape`) after `area`:

```prisma
model Table {
  id           String        @id @default(cuid())
  restaurantId String
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id])
  number       String
  capacity     Int
  area         String?
  posX         Float?
  posY         Float?
  shape        TableShape    @default(SQUARE)
  reservations Reservation[]
  createdAt    DateTime      @default(now())

  @@unique([restaurantId, number])
  @@map("table")
}
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name floor_manager
```

Expected: `Your database is now in sync with your schema.` and a new `prisma/migrations/<timestamp>_floor_manager/` folder.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors (confirms the generated Prisma client picked up `TableShape`/`posX`/`posY`/`shape`).

- [ ] **Step 4: Commit**

```bash
git add prisma
git commit -m "feat: add table position and shape fields for floor plan"
```

---

### Task 2: Pure helper — table status derivation (TDD)

**Files:**
- Create: `src/lib/table-status.ts`
- Test: `tests/table-status.test.ts`

**Interfaces:**
- Produces: `TableFloorStatus = "AVAILABLE" | "RESERVED_SOON" | "SEATED"`, `TableStatusReservation` type, `getTableStatus(tableId, reservations, now): { status, reservation }` — consumed by Task 5 (table-box.tsx) and Task 7 (floor-plan.tsx).

- [ ] **Step 1: Write the failing tests**

`tests/table-status.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getTableStatus, type TableStatusReservation } from "@/lib/table-status";

function reservation(overrides: Partial<TableStatusReservation> = {}): TableStatusReservation {
  return {
    id: "r1",
    tableId: "t1",
    startsAt: new Date("2026-07-13T19:00:00"),
    durationMinutes: 90,
    status: "CONFIRMED",
    partySize: 2,
    customerName: "Taylor Guest",
    ...overrides,
  };
}

describe("getTableStatus", () => {
  const now = new Date("2026-07-13T19:00:00");

  it("returns AVAILABLE when the table has no reservations", () => {
    expect(getTableStatus("t1", [], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });

  it("returns SEATED when a SEATED reservation exists for the table", () => {
    const r = reservation({ status: "SEATED" });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "SEATED", reservation: r });
  });

  it("returns RESERVED_SOON when a CONFIRMED reservation starts within 30 minutes", () => {
    const r = reservation({ startsAt: new Date("2026-07-13T19:20:00") });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "RESERVED_SOON", reservation: r });
  });

  it("returns RESERVED_SOON when a CONFIRMED reservation is already underway", () => {
    // Started 20 minutes ago, 90-minute duration -- still within its window.
    const r = reservation({ startsAt: new Date("2026-07-13T18:40:00") });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "RESERVED_SOON", reservation: r });
  });

  it("returns AVAILABLE when a CONFIRMED reservation starts more than 30 minutes out", () => {
    const r = reservation({ startsAt: new Date("2026-07-13T20:00:00") });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });

  it("returns AVAILABLE once a CONFIRMED reservation's expected window has fully passed", () => {
    const r = reservation({ startsAt: new Date("2026-07-13T16:00:00"), durationMinutes: 90 });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });

  it("ignores reservations for other tables", () => {
    const r = reservation({ tableId: "other-table", status: "SEATED" });
    expect(getTableStatus("t1", [r], now)).toEqual({ status: "AVAILABLE", reservation: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/table-status'`.

- [ ] **Step 3: Implement**

`src/lib/table-status.ts`:

```typescript
import type { ReservationStatus } from "@/generated/prisma/client";

export type TableFloorStatus = "AVAILABLE" | "RESERVED_SOON" | "SEATED";

// ponytail: hardcoded window; a per-restaurant setting is Phase 8's job.
const RESERVED_SOON_WINDOW_MINUTES = 30;

export type TableStatusReservation = {
  id: string;
  tableId: string | null;
  startsAt: Date;
  durationMinutes: number;
  status: ReservationStatus;
  partySize: number;
  customerName: string;
};

export function getTableStatus(
  tableId: string,
  reservations: TableStatusReservation[],
  now: Date
): { status: TableFloorStatus; reservation: TableStatusReservation | null } {
  const tableReservations = reservations.filter((r) => r.tableId === tableId);

  const seated = tableReservations.find((r) => r.status === "SEATED");
  if (seated) return { status: "SEATED", reservation: seated };

  // A CONFIRMED reservation counts as "reserved soon" from 30 minutes before
  // its start through its full expected duration -- covers both an upcoming
  // booking and a late arrival that hasn't been marked SEATED yet, without
  // blocking the table forever once its window has fully passed.
  const soon = tableReservations.find((r) => {
    if (r.status !== "CONFIRMED") return false;
    const windowStart = r.startsAt.getTime() - RESERVED_SOON_WINDOW_MINUTES * 60_000;
    const windowEnd = r.startsAt.getTime() + r.durationMinutes * 60_000;
    return now.getTime() >= windowStart && now.getTime() <= windowEnd;
  });
  if (soon) return { status: "RESERVED_SOON", reservation: soon };

  return { status: "AVAILABLE", reservation: null };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — all 7 new tests green, plus all existing tests still passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/table-status.ts tests/table-status.test.ts
git commit -m "feat: add pure table-status helper with tests"
```

---

### Task 3: Pure helper — smart table recommendation (TDD)

**Files:**
- Create: `src/lib/table-allocation.ts`
- Test: `tests/table-allocation.test.ts`

**Interfaces:**
- Consumes: `doesOverlap` from `@/lib/reservation-conflicts` (Phase 3).
- Produces: `recommendTable(tables, reservations, input): string | null` — consumed by Task 9 (reservation-modal.tsx).

- [ ] **Step 1: Write the failing tests**

`tests/table-allocation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { recommendTable } from "@/lib/table-allocation";

const TABLES = [
  { id: "small", capacity: 2 },
  { id: "medium", capacity: 4 },
  { id: "large", capacity: 6 },
];

const START = new Date("2026-07-13T19:00:00");

describe("recommendTable", () => {
  it("recommends the smallest table that fits the party", () => {
    expect(recommendTable(TABLES, [], { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe("small");
  });

  it("skips tables that are too small for the party", () => {
    expect(recommendTable(TABLES, [], { partySize: 5, startsAt: START, durationMinutes: 90 })).toBe("large");
  });

  it("excludes a table with a conflicting reservation", () => {
    const reservations = [{ tableId: "small", startsAt: START, durationMinutes: 90 }];
    expect(recommendTable(TABLES, reservations, { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe("medium");
  });

  it("does not exclude a table whose reservation doesn't overlap", () => {
    const reservations = [
      { tableId: "small", startsAt: new Date("2026-07-13T12:00:00"), durationMinutes: 60 },
    ];
    expect(recommendTable(TABLES, reservations, { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe("small");
  });

  it("returns null when no table fits or all fitting tables are booked", () => {
    const reservations = [
      { tableId: "small", startsAt: START, durationMinutes: 90 },
      { tableId: "medium", startsAt: START, durationMinutes: 90 },
      { tableId: "large", startsAt: START, durationMinutes: 90 },
    ];
    expect(recommendTable(TABLES, reservations, { partySize: 2, startsAt: START, durationMinutes: 90 })).toBe(null);
  });

  it("returns null when the party is larger than every table", () => {
    expect(recommendTable(TABLES, [], { partySize: 20, startsAt: START, durationMinutes: 90 })).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/table-allocation'`.

- [ ] **Step 3: Implement**

`src/lib/table-allocation.ts`:

```typescript
import { doesOverlap, type TimeRange } from "@/lib/reservation-conflicts";

export type AllocationTable = { id: string; capacity: number };
export type AllocationReservation = { tableId: string | null } & TimeRange;

export function recommendTable(
  tables: AllocationTable[],
  reservations: AllocationReservation[],
  input: { partySize: number; startsAt: Date; durationMinutes: number }
): string | null {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);

  const available = fitting.filter((t) => {
    const conflict = reservations.some(
      (r) =>
        r.tableId === t.id &&
        doesOverlap(r, { startsAt: input.startsAt, durationMinutes: input.durationMinutes })
    );
    return !conflict;
  });

  if (available.length === 0) return null;
  return [...available].sort((a, b) => a.capacity - b.capacity)[0].id;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — all 6 new tests green, plus all existing tests still passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/table-allocation.ts tests/table-allocation.test.ts
git commit -m "feat: add pure recommendTable helper with tests"
```

---

### Task 4: Server Actions — table layout, walk-in seating, status-only update

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/floor-manager/actions.ts`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/actions.ts`

**Interfaces:**
- Consumes: `assertRestaurantMember` (Phase 3), `findOrCreateCustomer`/`hasTableConflict` (Phase 3, `@/lib/reservations-data`).
- Produces: `updateTableLayoutAction(slug, tableId, {posX, posY, shape})`, `quickSeatWalkInAction(slug, tableId, partySize)`, `setReservationStatusAction(slug, reservationId, status)` — consumed by Tasks 6, 7, 8.

- [ ] **Step 1: Floor manager actions**

`src/app/(dashboard)/r/[slug]/floor-manager/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
import type { TableShape } from "@/generated/prisma/client";

export type FloorActionResult = { ok: true } | { ok: false; error: string };

export async function updateTableLayoutAction(
  slug: string,
  tableId: string,
  input: { posX: number; posY: number; shape: TableShape }
): Promise<FloorActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.table.updateMany({
    where: { id: tableId, restaurantId: restaurant.id },
    data: input,
  });
  if (count === 0) return { ok: false, error: "Table not found." };
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}

export async function quickSeatWalkInAction(
  slug: string,
  tableId: string,
  partySize: number
): Promise<FloorActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const startsAt = new Date();

  const conflict = await hasTableConflict(tableId, startsAt, 90);
  if (conflict) return { ok: false, error: "That table is already booked for this time." };

  const customer = await findOrCreateCustomer(restaurant.id, { name: "Walk-in" });

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      tableId,
      partySize,
      startsAt,
      durationMinutes: 90,
      status: "SEATED",
    },
  });

  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}
```

- [ ] **Step 2: Add the status-only action to the existing reservations actions**

In `src/app/(dashboard)/r/[slug]/reservations/actions.ts`, add this new export after `updateReservationAction`:

```typescript
export async function setReservationStatusAction(
  slug: string,
  reservationId: string,
  status: ReservationStatus
): Promise<ReservationActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.reservation.updateMany({
    where: { id: reservationId, restaurantId: restaurant.id },
    data: { status },
  });
  if (count === 0) return { ok: false, error: "Reservation not found." };
  revalidatePath(`/r/${slug}/reservations`);
  revalidatePath(`/r/${slug}/customers`);
  revalidatePath(`/r/${slug}/floor-manager`);
  return { ok: true };
}
```

`ReservationStatus` is already imported in this file (`import { Prisma, type ReservationStatus } from "@/generated/prisma/client";`) — no new import needed.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors. (Behavioral verification happens once the UI exists in Tasks 6-8 and Task 10's e2e test, same reasoning as prior phases' Server Action tasks.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/floor-manager/actions.ts" "src/app/(dashboard)/r/[slug]/reservations/actions.ts"
git commit -m "feat: add floor-manager Server Actions and status-only reservation update"
```

---

### Task 5: Table box component

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/floor-manager/table-box.tsx`

**Interfaces:**
- Consumes: `TableFloorStatus`, `TableStatusReservation` (Task 2).
- Produces: `<TableBox ... />` — consumed by Task 7 (floor-plan.tsx).

- [ ] **Step 1: Implement**

`src/app/(dashboard)/r/[slug]/floor-manager/table-box.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { TableShape } from "@/generated/prisma/client";
import type { TableFloorStatus, TableStatusReservation } from "@/lib/table-status";

const STATUS_STYLES: Record<TableFloorStatus, string> = {
  AVAILABLE: "border-border bg-muted text-muted-foreground",
  RESERVED_SOON: "border-amber-500/50 bg-amber-500/10 text-amber-700",
  SEATED: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700",
};

function sizeClass(capacity: number) {
  if (capacity <= 2) return "h-14 w-14";
  if (capacity <= 4) return "h-20 w-20";
  return "h-24 w-24";
}

export function TableBox({
  number,
  capacity,
  shape,
  posX,
  posY,
  status,
  reservation,
  editMode,
  onClick,
  onPointerDownDrag,
  onToggleShape,
}: {
  number: string;
  capacity: number;
  shape: TableShape;
  posX: number;
  posY: number;
  status: TableFloorStatus;
  reservation: TableStatusReservation | null;
  editMode: boolean;
  onClick?: () => void;
  onPointerDownDrag?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onToggleShape?: () => void;
}) {
  const clickable = !editMode && (status === "AVAILABLE" || status === "SEATED");

  return (
    <div
      className={cn(
        "absolute flex flex-col items-center justify-center gap-0.5 border-2 p-1 text-center text-xs font-medium shadow-sm select-none",
        sizeClass(capacity),
        shape === "ROUND" ? "rounded-full" : "rounded-[5px]",
        STATUS_STYLES[status],
        editMode ? "cursor-grab active:cursor-grabbing" : clickable ? "cursor-pointer hover:brightness-95" : ""
      )}
      style={{ left: posX, top: posY }}
      onPointerDown={editMode ? onPointerDownDrag : undefined}
      onClick={clickable ? onClick : undefined}
    >
      <span className="font-semibold">Table {number}</span>
      <span>{capacity} seats</span>
      {reservation && <span className="w-full truncate">{reservation.customerName}</span>}
      {editMode && (
        <button
          type="button"
          className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-border bg-background text-[10px]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleShape?.();
          }}
          aria-label="Toggle table shape"
        >
          {shape === "ROUND" ? "▢" : "○"}
        </button>
      )}
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
git add "src/app/(dashboard)/r/[slug]/floor-manager/table-box.tsx"
git commit -m "feat: add floor-manager table box component"
```

---

### Task 6: Quick-seat dialog + seated-info dialog

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/floor-manager/quick-seat-dialog.tsx`
- Create: `src/app/(dashboard)/r/[slug]/floor-manager/seated-info-dialog.tsx`

**Interfaces:**
- Consumes: `quickSeatWalkInAction` (Task 4), `setReservationStatusAction` (Task 4), `TableStatusReservation` (Task 2).
- Produces: `<QuickSeatDialog ... />`, `<SeatedInfoDialog ... />` — consumed by Task 7 (floor-plan.tsx).

- [ ] **Step 1: Quick-seat dialog**

`src/app/(dashboard)/r/[slug]/floor-manager/quick-seat-dialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickSeatWalkInAction } from "./actions";

export function QuickSeatDialog({
  open,
  onOpenChange,
  slug,
  tableId,
  tableNumber,
  onSeated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tableId: string | null;
  tableNumber: string;
  onSeated: () => void;
}) {
  const [partySize, setPartySize] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPartySize(2);
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tableId) return;
    setSaving(true);
    setError(null);
    const result = await quickSeatWalkInAction(slug, tableId, partySize);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onSeated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seat walk-in at Table {tableNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="walkInPartySize">Party size</Label>
            <Input
              id="walkInPartySize"
              type="number"
              min={1}
              className="h-11 text-base"
              placeholder="Number of guests"
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              required
            />
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Seating..." : "Seat now"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Seated-info dialog**

`src/app/(dashboard)/r/[slug]/floor-manager/seated-info-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setReservationStatusAction } from "../reservations/actions";
import type { TableStatusReservation } from "@/lib/table-status";

export function SeatedInfoDialog({
  open,
  onOpenChange,
  slug,
  tableNumber,
  reservation,
  onFreed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tableNumber: string;
  reservation: TableStatusReservation | null;
  onFreed: () => void;
}) {
  const [freeing, setFreeing] = useState(false);

  async function handleFree() {
    if (!reservation) return;
    setFreeing(true);
    await setReservationStatusAction(slug, reservation.id, "COMPLETED");
    setFreeing(false);
    onOpenChange(false);
    onFreed();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Table {tableNumber}</DialogTitle>
        </DialogHeader>
        {reservation && (
          <div className="space-y-4">
            <div className="space-y-1 text-base">
              <p className="font-semibold">{reservation.customerName}</p>
              <p className="text-muted-foreground">Party of {reservation.partySize}</p>
              <p className="text-muted-foreground">
                Seated at {reservation.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <Button className="h-11 w-full text-base" onClick={handleFree} disabled={freeing}>
              {freeing ? "Freeing..." : "Free table"}
            </Button>
          </div>
        )}
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
git add "src/app/(dashboard)/r/[slug]/floor-manager/quick-seat-dialog.tsx" "src/app/(dashboard)/r/[slug]/floor-manager/seated-info-dialog.tsx"
git commit -m "feat: add quick-seat and seated-info dialogs"
```

---

### Task 7: Floor Manager page — view mode

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/floor-manager/page.tsx` (replaces the Phase 1 stub)
- Create: `src/app/(dashboard)/r/[slug]/floor-manager/floor-plan.tsx`

**Interfaces:**
- Consumes: `getTableStatus` (Task 2), `TableBox` (Task 5), `QuickSeatDialog`/`SeatedInfoDialog` (Task 6).
- Produces: `FloorTable` type, `<FloorPlan slug tables reservations />` — extended in place by Task 8 (Edit Layout mode).

- [ ] **Step 1: Page**

`src/app/(dashboard)/r/[slug]/floor-manager/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { FloorPlan } from "./floor-plan";

export default async function FloorManagerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  const { start, end } = getDayRange(new Date());

  const [tables, reservations] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId: restaurant.id }, orderBy: { number: "asc" } }),
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

  const floorReservations = reservations.map((r) => ({
    id: r.id,
    tableId: r.tableId,
    startsAt: r.startsAt,
    durationMinutes: r.durationMinutes,
    status: r.status,
    partySize: r.partySize,
    customerName: r.customer.name,
  }));

  return <FloorPlan slug={slug} tables={tables} reservations={floorReservations} />;
}
```

- [ ] **Step 2: Floor plan (view mode only — Edit Layout added in Task 8)**

`src/app/(dashboard)/r/[slug]/floor-manager/floor-plan.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TableBox } from "./table-box";
import { QuickSeatDialog } from "./quick-seat-dialog";
import { SeatedInfoDialog } from "./seated-info-dialog";
import { getTableStatus, type TableStatusReservation } from "@/lib/table-status";
import type { TableShape } from "@/generated/prisma/client";

export type FloorTable = {
  id: string;
  number: string;
  capacity: number;
  posX: number | null;
  posY: number | null;
  shape: TableShape;
};

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

const STATUS_LEGEND: { label: string; dot: string }[] = [
  { label: "Available", dot: "bg-muted-foreground/40" },
  { label: "Reserved soon", dot: "bg-amber-500" },
  { label: "Seated", dot: "bg-emerald-500" },
];

export function FloorPlan({
  slug,
  tables,
  reservations,
}: {
  slug: string;
  tables: FloorTable[];
  reservations: TableStatusReservation[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [quickSeat, setQuickSeat] = useState<{ id: string; number: string } | null>(null);
  const [seatedInfo, setSeatedInfo] = useState<{ number: string; reservation: TableStatusReservation } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const placed = tables.filter((t) => t.posX != null && t.posY != null);
  const unplacedCount = tables.length - placed.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Floor Manager</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {STATUS_LEGEND.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {unplacedCount > 0 && (
        <div className="rounded-[5px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-base">
          {unplacedCount} table{unplacedCount === 1 ? "" : "s"} aren't on the floor plan yet.
        </div>
      )}

      <div
        className="relative overflow-auto rounded-[5px] border border-border bg-muted/20"
        style={{ width: "100%", maxWidth: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        {placed.map((table) => {
          const { status, reservation } = getTableStatus(table.id, reservations, now);
          return (
            <TableBox
              key={table.id}
              number={table.number}
              capacity={table.capacity}
              shape={table.shape}
              posX={table.posX!}
              posY={table.posY!}
              status={status}
              reservation={reservation}
              editMode={false}
              onClick={() => {
                if (status === "AVAILABLE") setQuickSeat({ id: table.id, number: table.number });
                if (status === "SEATED" && reservation) setSeatedInfo({ number: table.number, reservation });
              }}
            />
          );
        })}
      </div>

      <QuickSeatDialog
        open={quickSeat !== null}
        onOpenChange={(open) => !open && setQuickSeat(null)}
        slug={slug}
        tableId={quickSeat?.id ?? null}
        tableNumber={quickSeat?.number ?? ""}
        onSeated={() => router.refresh()}
      />
      <SeatedInfoDialog
        open={seatedInfo !== null}
        onOpenChange={(open) => !open && setSeatedInfo(null)}
        slug={slug}
        tableNumber={seatedInfo?.number ?? ""}
        reservation={seatedInfo?.reservation ?? null}
        onFreed={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Visit `/r/blue-fork/floor-manager` as Owner or Staff. No tables have a position yet at this point in the plan (Edit Layout, which places them, doesn't exist until Task 8), so expect: the page loads without errors, an empty canvas, and a banner reading "N tables aren't on the floor plan yet." Full click-through (seating/freeing a real positioned table) is verified once Task 8 lands.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/floor-manager/page.tsx" "src/app/(dashboard)/r/[slug]/floor-manager/floor-plan.tsx"
git commit -m "feat: wire floor manager view mode with live table status"
```

---

### Task 8: Edit Layout mode — drag positioning, unplaced tray, shape toggle

**Files:**
- Modify: `src/app/(dashboard)/r/[slug]/floor-manager/floor-plan.tsx`

**Interfaces:**
- Consumes: `updateTableLayoutAction` (Task 4).
- Produces: full Edit Layout behavior on the existing `<FloorPlan />` — no new exports beyond what Task 7 already produces.

- [ ] **Step 1: Replace the whole file with the Edit Layout-aware version**

Replace the entire contents of `src/app/(dashboard)/r/[slug]/floor-manager/floor-plan.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TableBox } from "./table-box";
import { QuickSeatDialog } from "./quick-seat-dialog";
import { SeatedInfoDialog } from "./seated-info-dialog";
import { updateTableLayoutAction } from "./actions";
import { getTableStatus, type TableStatusReservation } from "@/lib/table-status";
import type { TableShape } from "@/generated/prisma/client";

export type FloorTable = {
  id: string;
  number: string;
  capacity: number;
  posX: number | null;
  posY: number | null;
  shape: TableShape;
};

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;
const TABLE_BOX_SIZE = 96; // matches table-box.tsx's largest size tier (h-24/w-24)
const DEFAULT_DROP_POSITION = { x: 20, y: 20 };

const STATUS_LEGEND: { label: string; dot: string }[] = [
  { label: "Available", dot: "bg-muted-foreground/40" },
  { label: "Reserved soon", dot: "bg-amber-500" },
  { label: "Seated", dot: "bg-emerald-500" },
];

export function FloorPlan({
  slug,
  tables,
  reservations,
}: {
  slug: string;
  tables: FloorTable[];
  reservations: TableStatusReservation[];
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ tableId: string; offsetX: number; offsetY: number } | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(
      tables.filter((t) => t.posX != null && t.posY != null).map((t) => [t.id, { x: t.posX!, y: t.posY! }])
    )
  );
  const [shapes, setShapes] = useState<Record<string, TableShape>>(() =>
    Object.fromEntries(tables.map((t) => [t.id, t.shape]))
  );
  const [quickSeat, setQuickSeat] = useState<{ id: string; number: string } | null>(null);
  const [seatedInfo, setSeatedInfo] = useState<{ number: string; reservation: TableStatusReservation } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const placed = tables.filter((t) => positions[t.id]);
  const unplaced = tables.filter((t) => !positions[t.id]);

  function handlePointerDown(tableId: string, e: React.PointerEvent<HTMLDivElement>) {
    if (!editMode || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const pos = positions[tableId] ?? DEFAULT_DROP_POSITION;
    dragState.current = {
      tableId,
      offsetX: e.clientX - canvasRect.left - pos.x,
      offsetY: e.clientY - canvasRect.top - pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(CANVAS_WIDTH - TABLE_BOX_SIZE, e.clientX - canvasRect.left - drag.offsetX));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - TABLE_BOX_SIZE, e.clientY - canvasRect.top - drag.offsetY));
    setPositions((prev) => ({ ...prev, [drag.tableId]: { x, y } }));
  }

  async function handlePointerUp() {
    const drag = dragState.current;
    dragState.current = null;
    if (!drag) return;
    const pos = positions[drag.tableId];
    const shape = shapes[drag.tableId];
    if (!pos || !shape) return;
    await updateTableLayoutAction(slug, drag.tableId, { posX: pos.x, posY: pos.y, shape });
    router.refresh();
  }

  async function handlePlaceFromTray(tableId: string) {
    setPositions((prev) => ({ ...prev, [tableId]: DEFAULT_DROP_POSITION }));
    const shape = shapes[tableId];
    if (!shape) return;
    await updateTableLayoutAction(slug, tableId, { posX: DEFAULT_DROP_POSITION.x, posY: DEFAULT_DROP_POSITION.y, shape });
    router.refresh();
  }

  async function handleToggleShape(tableId: string) {
    const nextShape: TableShape = shapes[tableId] === "ROUND" ? "SQUARE" : "ROUND";
    setShapes((prev) => ({ ...prev, [tableId]: nextShape }));
    const pos = positions[tableId];
    if (!pos) return;
    await updateTableLayoutAction(slug, tableId, { posX: pos.x, posY: pos.y, shape: nextShape });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Floor Manager</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {STATUS_LEGEND.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            ))}
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            className="h-11 px-5 text-base"
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "Done" : "Edit Layout"}
          </Button>
        </div>
      </div>

      {unplaced.length > 0 && !editMode && (
        <div className="flex items-center justify-between rounded-[5px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-base">
          <span>{unplaced.length} table{unplaced.length === 1 ? "" : "s"} aren't on the floor plan yet.</span>
          <Button variant="outline" className="h-9" onClick={() => setEditMode(true)}>
            Arrange them
          </Button>
        </div>
      )}

      <div
        ref={canvasRef}
        className="relative overflow-auto rounded-[5px] border border-border bg-muted/20"
        style={{ width: "100%", maxWidth: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {placed.map((table) => {
          const pos = positions[table.id]!;
          const shape = shapes[table.id]!;
          const { status, reservation } = getTableStatus(table.id, reservations, now);
          return (
            <TableBox
              key={table.id}
              number={table.number}
              capacity={table.capacity}
              shape={shape}
              posX={pos.x}
              posY={pos.y}
              status={status}
              reservation={reservation}
              editMode={editMode}
              onPointerDownDrag={(e) => handlePointerDown(table.id, e)}
              onToggleShape={() => handleToggleShape(table.id)}
              onClick={() => {
                if (status === "AVAILABLE") setQuickSeat({ id: table.id, number: table.number });
                if (status === "SEATED" && reservation) setSeatedInfo({ number: table.number, reservation });
              }}
            />
          );
        })}
      </div>

      {editMode && unplaced.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Unplaced tables</h2>
          <p className="text-sm text-muted-foreground">
            Click a table to drop it onto the canvas, then drag it into place.
          </p>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((table) => (
              <button
                key={table.id}
                type="button"
                className="rounded-[5px] border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => handlePlaceFromTray(table.id)}
              >
                Table {table.number} ({table.capacity} seats)
              </button>
            ))}
          </div>
        </div>
      )}

      <QuickSeatDialog
        open={quickSeat !== null}
        onOpenChange={(open) => !open && setQuickSeat(null)}
        slug={slug}
        tableId={quickSeat?.id ?? null}
        tableNumber={quickSeat?.number ?? ""}
        onSeated={() => router.refresh()}
      />
      <SeatedInfoDialog
        open={seatedInfo !== null}
        onOpenChange={(open) => !open && setSeatedInfo(null)}
        slug={slug}
        tableNumber={seatedInfo?.number ?? ""}
        reservation={seatedInfo?.reservation ?? null}
        onFreed={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```

On `/r/blue-fork/floor-manager`, click "Edit Layout" (or "Arrange them" from the banner). Click an unplaced table chip — confirm it appears on the canvas. Drag it to a new spot — confirm it follows the pointer smoothly and stays within canvas bounds. Click the small shape toggle on its corner — confirm it switches between square and round. Click "Done", reload the page, and confirm the position and shape both persisted.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/floor-manager/floor-plan.tsx"
git commit -m "feat: add Edit Layout mode with drag positioning and shape toggle"
```

---

### Task 9: Smart-recommend integration in the reservation modal

**Files:**
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx`
- Modify: `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`

**Interfaces:**
- Consumes: `recommendTable` (Task 3).
- Produces: no new exports — `ReservationModal` gains a `reservations` prop.

- [ ] **Step 1: Pass `reservations` down from the calendar**

In `src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx`, find the `<ReservationModal>` element and add the `reservations` prop:

```tsx
      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        slug={slug}
        tables={tableOptions}
        reservation={editingForModal}
        prefill={prefill}
        reservations={reservations}
        onSaved={() => router.refresh()}
      />
```

(`reservations` is already a prop `ReservationsCalendar` receives from `page.tsx` — this just forwards it.)

- [ ] **Step 2: Accept the new prop and add the `tableTouched` flag**

In `src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx`, update the imports and props:

```tsx
import { createReservationAction, updateReservationAction, type ReservationInput } from "./actions";
import { recommendTable } from "@/lib/table-allocation";
import { toLocalDateInput } from "@/lib/reservation-dates";
import type { ReservationStatus } from "@/generated/prisma/client";
import type { ReservationListItem } from "./day-view";
```

```tsx
export function ReservationModal({
  open,
  onOpenChange,
  slug,
  tables,
  reservations,
  reservation,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tables: TableOption[];
  reservations: ReservationListItem[];
  reservation?: ReservationForEdit;
  prefill?: ReservationPrefill;
  onSaved: () => void;
}) {
```

Add one new piece of state alongside the existing ones:

```tsx
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableTouched, setTableTouched] = useState(false);
```

- [ ] **Step 3: Reset `tableTouched` on open, matching how every other field resets**

Update the existing reset `useEffect` — in the `if (reservation)` branch add `setTableTouched(true)` (editing never auto-recommends), and in the `else` branch replace the `setTableId` line:

```tsx
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
      setTableTouched(true);
      setStatus(reservation.status);
    } else {
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setPartySize(2);
      setDate(prefill?.date ?? toDateInput(new Date()));
      setTime(prefill?.time ?? "19:00");
      setDurationMinutes(90);
      setSpecialRequests("");
      setTableId(prefill?.tableId ?? null);
      setTableTouched(!!prefill?.tableId);
      setStatus("CONFIRMED");
    }
```

- [ ] **Step 4: Compute the recommendation and the effective table id**

Right after the `availableTables` line, add:

```tsx
  const availableTables = tables.filter((t) => t.capacity >= partySize);

  const recommendedId = !reservation && date
    ? recommendTable(
        tables.map((t) => ({ id: t.id, capacity: t.capacity })),
        reservations,
        { partySize, startsAt: new Date(`${date}T${time}`), durationMinutes }
      )
    : null;

  const effectiveTableId = tableTouched ? tableId : recommendedId;
```

- [ ] **Step 5: Use `effectiveTableId` in the submit payload**

```tsx
    const input: ReservationInput = {
      guestName,
      guestEmail,
      guestPhone,
      partySize,
      date,
      time,
      durationMinutes,
      specialRequests,
      tableId: effectiveTableId,
      status: reservation ? status : undefined,
    };
```

- [ ] **Step 6: Wire the Select to `effectiveTableId` and label the recommended option**

Replace the "Assigned table" `Select` block:

```tsx
          <div className="space-y-2">
            <Label htmlFor="tableId">Assigned table</Label>
            <Select
              value={effectiveTableId ?? "none"}
              onValueChange={(v) => {
                setTableTouched(true);
                setTableId(v === "none" ? null : v);
              }}
            >
              <SelectTrigger id="tableId" className="h-11 w-full text-base">
                <SelectValue placeholder="No table assigned">
                  {(value: string | null) => {
                    if (!value || value === "none") return "No table assigned";
                    const t = tables.find((table) => table.id === value);
                    if (!t) return "No table assigned";
                    const recommended = value === recommendedId && !tableTouched ? " — Recommended" : "";
                    return `Table ${t.number} (seats ${t.capacity})${recommended}`;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No table assigned</SelectItem>
                {availableTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.number} (seats {t.capacity})
                    {t.id === recommendedId ? " — Recommended" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

```bash
pnpm dev
```

Book a new reservation for a party size that only one table fits — confirm the "Assigned table" field shows that table pre-selected, labeled "— Recommended", without clicking the dropdown. Manually pick a different table — confirm it stays as picked even if you then change the party size. Edit an existing reservation — confirm its table is unaffected by any recommendation.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/reservations/reservation-modal.tsx" "src/app/(dashboard)/r/[slug]/reservations/reservations-calendar.tsx"
git commit -m "feat: auto-recommend best-fit table in the reservation modal"
```

---

### Task 10: Playwright e2e — Phase 4 Definition of Done

**Files:**
- Create: `e2e/phase4-floor-manager.spec.ts`

**Interfaces:**
- Consumes: the running production build, the seeded `owner@blue-fork.example.com` account.

- [ ] **Step 1: Write the test**

`e2e/phase4-floor-manager.spec.ts`:

```typescript
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_TABLE_NUMBERS = ["FM-1", "FM-2"];

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "tableId" IN (SELECT id FROM "table" WHERE number = ANY($1))`,
      [FIXTURE_TABLE_NUMBERS]
    );
    await client.query(`DELETE FROM customer WHERE name = 'Walk-in'`);
    await client.query(`DELETE FROM "table" WHERE number = ANY($1)`, [FIXTURE_TABLE_NUMBERS]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 4 Floor Manager", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("arrange a table, seat and free a walk-in, and get a smart table recommendation", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    // Create two tables of different capacities via the existing Manage Tables dialog.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill("FM-1");
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText("Table FM-1")).toBeVisible();
    await page.getByLabel("Number").fill("FM-2");
    await page.getByLabel("Capacity").fill("6");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText("Table FM-2")).toBeVisible();
    await page.keyboard.press("Escape");

    // Arrange FM-1 on the floor plan.
    await page.goto("/r/blue-fork/floor-manager");
    await expect(page.getByText("aren't on the floor plan yet")).toBeVisible();
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: "Table FM-1 (2 seats)" }).click();

    const fm1Box = page.getByText("Table FM-1");
    await expect(fm1Box).toBeVisible();
    const box = await fm1Box.locator("..").boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 150);
      await page.mouse.up();
    }
    await page.getByRole("button", { name: "Done" }).click();
    await page.reload();
    await expect(page.getByText("Table FM-1")).toBeVisible();

    // Seat a walk-in at FM-1, then free it.
    await page.getByText("Table FM-1").click();
    await page.getByLabel("Party size").fill("2");
    await page.getByRole("button", { name: "Seat now" }).click();
    await expect(page.getByText("Walk-in")).toBeVisible();

    await page.getByText("Table FM-1").click();
    await expect(page.getByRole("dialog").getByText("Party of 2")).toBeVisible();
    await page.getByRole("button", { name: "Free table" }).click();
    await expect(page.getByText("Walk-in")).toHaveCount(0);

    // Smart recommendation: booking for 2 guests should default to the 2-top, not the 6-top.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("Recommend Test");
    await page.getByLabel("Phone").fill("555-000-2222");
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-05");
    await page.getByLabel("Time").fill("18:00");
    await expect(page.getByLabel("Assigned table")).toContainText("FM-1");
    await expect(page.getByLabel("Assigned table")).toContainText("Recommended");
    await page.keyboard.press("Escape");
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:e2e
```

Expected: PASS. Run it a second time immediately after to confirm the `beforeAll`/`afterAll` hooks make it idempotent.

- [ ] **Step 3: Commit**

```bash
git add e2e/phase4-floor-manager.spec.ts
git commit -m "test: add Playwright coverage for Phase 4 definition of done"
```
