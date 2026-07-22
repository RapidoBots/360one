# Phase 5: Waitlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/r/[slug]/waitlist` from a stub page into a working walk-in waitlist — add a waiting party, see how long they've been waiting, seat them at a currently-available table with one click (creating a real reservation), or mark them cancelled/no-show.

**Architecture:** One new model (`WaitlistEntry`) — no repurposing of `Reservation`, since a waiting party has no assigned time. A new pure helper (`listAvailableTables`) mirrors the existing `recommendTable` pattern but returns every currently-free table instead of auto-picking one, since seating is a staff choice. Server Actions handle writes; the page fetches today's waiting/history entries plus tables and today's reservations, and a client component ticks elapsed-wait time the same way Floor Manager already ticks live table status.

**Tech Stack:** Next.js 15 Server Components + Server Actions, Prisma 7, shadcn/ui (Dialog, Button, Input, Label, Textarea, Badge — all already installed, no new primitives needed), Vitest, Playwright.

## Global Constraints

- A waitlist entry has no assigned time — only `joinedAt`. Seating one always uses `startsAt: now` and the app-wide 90-minute default duration, matching `quickSeatWalkInAction`'s convention.
- No SMS/email notifications when a table opens — Phase 6 Notifications doesn't exist yet. Staff notify guests manually.
- No remote/public waitlist-join via the embeddable widget this phase — staff-entered walk-ins only.
- Wait time is always a manual staff estimate (a plain number), never calculated.
- Queue order is strict FIFO by `joinedAt` — no manual reordering.
- `ponytail:` No dropdown/menu component for the Cancel/No-show actions — two plain outline buttons directly on each row. Avoids pulling in a new shadcn primitive (no `DropdownMenu` is installed anywhere in this app yet) for what's only ever two choices.
- `ponytail:` Every dialog's trigger button and its own submit button use visibly different text (e.g. "Add to waitlist" trigger vs. "Add" submit) — this project has hit repeated Playwright ambiguity bugs from reusing the same label for a trigger and the dialog it opens, since the background page stays in the DOM behind an open dialog.
- Every task must leave `pnpm dev` (or `pnpm build && pnpm start`) in a runnable state.

---

## File Structure

```
prisma/
  schema.prisma                                # modify: WaitlistStatus enum, WaitlistEntry model, Restaurant/Customer relations

src/lib/
  table-allocation.ts                          # modify: add listAvailableTables()

src/app/(dashboard)/r/[slug]/waitlist/
  actions.ts                                   # "use server" -- addToWaitlistAction, seatFromWaitlistAction, updateWaitlistStatusAction
  page.tsx                                     # replaces stub -- Server Component, fetches waiting/history/tables/reservations
  waitlist-view.tsx                            # Client Component -- list, elapsed-time tick, Cancel/No-show, dialog orchestration
  add-waitlist-dialog.tsx                      # Dialog -- name/phone/email/party/quoted wait/notes
  seat-dialog.tsx                              # Dialog -- pick an available table

tests/
  table-allocation.test.ts                     # modify: add listAvailableTables tests

e2e/
  phase5-waitlist.spec.ts
```

---

### Task 1: Data model — WaitlistEntry

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `WaitlistStatus` enum (`WAITING | SEATED | CANCELLED | NO_SHOW`), `prisma.waitlistEntry` — consumed by every later task in this plan.

- [ ] **Step 1: Add the enum and model**

In `prisma/schema.prisma`, add this enum and model right after the `Customer` model:

```prisma
enum WaitlistStatus {
  WAITING
  SEATED
  CANCELLED
  NO_SHOW
}

model WaitlistEntry {
  id                String         @id @default(cuid())
  restaurantId      String
  restaurant        Restaurant     @relation(fields: [restaurantId], references: [id])
  customerId        String
  customer          Customer       @relation(fields: [customerId], references: [id])
  partySize         Int
  quotedWaitMinutes Int?
  status            WaitlistStatus @default(WAITING)
  notes             String?
  joinedAt          DateTime       @default(now())

  @@map("waitlist_entry")
}
```

Add the inverse relation field to `Restaurant` (alongside its existing `reservations Reservation[]` line):

```prisma
  waitlistEntries WaitlistEntry[]
```

Add the same inverse relation field to `Customer` (alongside its existing `reservations Reservation[]` line):

```prisma
  waitlistEntries WaitlistEntry[]
```

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name waitlist
```

Expected: `Your database is now in sync with your schema.` and a new `prisma/migrations/<timestamp>_waitlist/` folder.

- [ ] **Step 3: Regenerate the client and verify**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: no errors (confirms the generated Prisma client picked up `WaitlistStatus`/`waitlistEntry`).

- [ ] **Step 4: Commit**

```bash
git add prisma
git commit -m "feat: add WaitlistEntry model"
```

---

### Task 2: Pure helper — listAvailableTables (TDD)

**Files:**
- Modify: `src/lib/table-allocation.ts`
- Modify: `tests/table-allocation.test.ts`

**Interfaces:**
- Produces: `listAvailableTables<T extends AllocationTable>(tables, reservations, input): T[]` — consumed by Task 6 (`waitlist-view.tsx`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/table-allocation.test.ts`:

```typescript
import { listAvailableTables } from "@/lib/table-allocation";

describe("listAvailableTables", () => {
  const NOW = new Date("2026-07-14T19:00:00");

  it("returns every fitting table sorted smallest-first", () => {
    const result = listAvailableTables(TABLES, [], { partySize: 2, now: NOW });
    expect(result.map((t) => t.id)).toEqual(["small", "large"]);
  });

  it("returns an empty list when nothing fits", () => {
    expect(listAvailableTables(TABLES, [], { partySize: 20, now: NOW })).toEqual([]);
  });

  it("excludes a table with a conflicting reservation", () => {
    const reservations = [{ tableId: "small", startsAt: NOW, durationMinutes: 90 }];
    const result = listAvailableTables(TABLES, reservations, { partySize: 2, now: NOW });
    expect(result.map((t) => t.id)).toEqual(["large"]);
  });

  it("does not exclude a table whose conflicting reservation is on a different table", () => {
    const reservations = [{ tableId: "large", startsAt: NOW, durationMinutes: 90 }];
    const result = listAvailableTables(TABLES, reservations, { partySize: 2, now: NOW });
    expect(result.map((t) => t.id)).toEqual(["small"]);
  });
});
```

(`TABLES` is already defined near the top of this file from the existing `recommendTable` tests -- no need to redefine it.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `listAvailableTables is not a function` (or similar, since it doesn't exist yet).

- [ ] **Step 3: Implement**

In `src/lib/table-allocation.ts`, append:

```typescript
const WAITLIST_SEAT_DURATION_MINUTES = 90;

export function listAvailableTables<T extends AllocationTable>(
  tables: T[],
  reservations: AllocationReservation[],
  input: { partySize: number; now: Date }
): T[] {
  const fitting = tables.filter((t) => t.capacity >= input.partySize);

  const available = fitting.filter((t) => {
    const conflict = reservations.some(
      (r) =>
        r.tableId === t.id &&
        doesOverlap(r, { startsAt: input.now, durationMinutes: WAITLIST_SEAT_DURATION_MINUTES })
    );
    return !conflict;
  });

  return [...available].sort((a, b) => a.capacity - b.capacity);
}
```

`doesOverlap` is already imported at the top of this file for `recommendTable` — no new import needed.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — all 4 new tests green, plus all existing tests still passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/table-allocation.ts tests/table-allocation.test.ts
git commit -m "feat: add pure listAvailableTables helper with tests"
```

---

### Task 3: Server Actions

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/waitlist/actions.ts`

**Interfaces:**
- Consumes: `assertRestaurantMember` (Phase 3), `findOrCreateCustomer`/`hasTableConflict` (Phase 3, `@/lib/reservations-data`).
- Produces: `WaitlistActionResult`, `addToWaitlistAction`, `seatFromWaitlistAction`, `updateWaitlistStatusAction` — consumed by Tasks 4, 5, 6.

- [ ] **Step 1: Implement**

`src/app/(dashboard)/r/[slug]/waitlist/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRestaurantMember } from "@/lib/auth-guards";
import { findOrCreateCustomer, hasTableConflict } from "@/lib/reservations-data";
import type { WaitlistStatus } from "@/generated/prisma/client";

export type WaitlistActionResult = { ok: true } | { ok: false; error: string };

export async function addToWaitlistAction(
  slug: string,
  input: {
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    partySize: number;
    quotedWaitMinutes: number | null;
    notes: string;
  }
): Promise<WaitlistActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const customer = await findOrCreateCustomer(restaurant.id, {
    name: input.guestName,
    email: input.guestEmail || null,
    phone: input.guestPhone || null,
  });

  await prisma.waitlistEntry.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      partySize: input.partySize,
      quotedWaitMinutes: input.quotedWaitMinutes,
      notes: input.notes || null,
    },
  });

  revalidatePath(`/r/${slug}/waitlist`);
  return { ok: true };
}

export async function seatFromWaitlistAction(
  slug: string,
  waitlistEntryId: string,
  tableId: string
): Promise<WaitlistActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);

  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: waitlistEntryId, restaurantId: restaurant.id },
  });
  if (!entry) return { ok: false, error: "Waitlist entry not found." };

  const startsAt = new Date();
  const conflict = await hasTableConflict(tableId, startsAt, 90);
  if (conflict) return { ok: false, error: "That table is already booked for this time." };

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      customerId: entry.customerId,
      tableId,
      partySize: entry.partySize,
      startsAt,
      durationMinutes: 90,
      status: "SEATED",
    },
  });

  await prisma.waitlistEntry.update({
    where: { id: waitlistEntryId },
    data: { status: "SEATED" },
  });

  revalidatePath(`/r/${slug}/waitlist`);
  revalidatePath(`/r/${slug}/reservations`);
  return { ok: true };
}

export async function updateWaitlistStatusAction(
  slug: string,
  waitlistEntryId: string,
  status: Extract<WaitlistStatus, "CANCELLED" | "NO_SHOW">
): Promise<WaitlistActionResult> {
  const { restaurant } = await assertRestaurantMember(slug);
  const { count } = await prisma.waitlistEntry.updateMany({
    where: { id: waitlistEntryId, restaurantId: restaurant.id },
    data: { status },
  });
  if (count === 0) return { ok: false, error: "Waitlist entry not found." };
  revalidatePath(`/r/${slug}/waitlist`);
  return { ok: true };
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors. (Behavioral verification happens once the UI exists in Tasks 4-6 and Task 7's e2e test, same reasoning as every prior phase's Server Action tasks.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/waitlist/actions.ts"
git commit -m "feat: add waitlist Server Actions"
```

---

### Task 4: Add-to-waitlist dialog

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/waitlist/add-waitlist-dialog.tsx`

**Interfaces:**
- Consumes: `addToWaitlistAction` (Task 3).
- Produces: `<AddWaitlistDialog open onOpenChange slug onAdded />` — consumed by Task 6 (`waitlist-view.tsx`).

- [ ] **Step 1: Implement**

`src/app/(dashboard)/r/[slug]/waitlist/add-waitlist-dialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addToWaitlistAction } from "./actions";

export function AddWaitlistDialog({
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
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [quotedWait, setQuotedWait] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setName("");
    setPhone("");
    setEmail("");
    setPartySize(2);
    setQuotedWait("");
    setNotes("");
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await addToWaitlistAction(slug, {
      guestName: name,
      guestPhone: phone,
      guestEmail: email,
      partySize,
      quotedWaitMinutes: quotedWait ? Number(quotedWait) : null,
      notes,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to waitlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="waitlistName">Name</Label>
            <Input
              id="waitlistName"
              className="h-11 text-base"
              placeholder="Guest name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="waitlistPhone">Phone</Label>
              <Input
                id="waitlistPhone"
                type="tel"
                className="h-11 text-base"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitlistEmail">Email</Label>
              <Input
                id="waitlistEmail"
                type="email"
                className="h-11 text-base"
                placeholder="guest@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="waitlistPartySize">Party size</Label>
              <Input
                id="waitlistPartySize"
                type="number"
                min={1}
                className="h-11 text-base"
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitlistQuotedWait">Quoted wait (min)</Label>
              <Input
                id="waitlistQuotedWait"
                type="number"
                min={0}
                className="h-11 text-base"
                placeholder="e.g. 20"
                value={quotedWait}
                onChange={(e) => setQuotedWait(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="waitlistNotes">Notes (optional)</Label>
            <Textarea
              id="waitlistNotes"
              className="text-base"
              placeholder="High chair needed, prefers booth, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          {/* Distinct from the page's "Add to waitlist" trigger button --
              see Global Constraints. */}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Adding..." : "Add"}
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

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/waitlist/add-waitlist-dialog.tsx"
git commit -m "feat: add add-to-waitlist dialog"
```

---

### Task 5: Seat dialog

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/waitlist/seat-dialog.tsx`

**Interfaces:**
- Consumes: `seatFromWaitlistAction` (Task 3).
- Produces: `SeatableTable` type, `<SeatDialog />` — consumed by Task 6 (`waitlist-view.tsx`).

- [ ] **Step 1: Implement**

`src/app/(dashboard)/r/[slug]/waitlist/seat-dialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { seatFromWaitlistAction } from "./actions";

export type SeatableTable = { id: string; number: string; capacity: number };

export function SeatDialog({
  open,
  onOpenChange,
  slug,
  waitlistEntryId,
  guestName,
  availableTables,
  onSeated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  waitlistEntryId: string | null;
  guestName: string;
  availableTables: SeatableTable[];
  onSeated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [savingTableId, setSavingTableId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSavingTableId(null);
  }, [open]);

  async function handlePick(tableId: string) {
    if (!waitlistEntryId) return;
    setSavingTableId(tableId);
    setError(null);
    const result = await seatFromWaitlistAction(slug, waitlistEntryId, tableId);
    setSavingTableId(null);
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
          <DialogTitle>Seat {guestName}</DialogTitle>
        </DialogHeader>
        {availableTables.length === 0 ? (
          <p className="text-base text-muted-foreground">No tables free right now.</p>
        ) : (
          <div className="space-y-2">
            {availableTables.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant="outline"
                className="h-11 w-full justify-between text-base"
                disabled={savingTableId !== null}
                onClick={() => handlePick(t.id)}
              >
                <span>Table {t.number}</span>
                <span className="text-muted-foreground">seats {t.capacity}</span>
              </Button>
            ))}
          </div>
        )}
        {error && <p className="text-base text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
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
git add "src/app/(dashboard)/r/[slug]/waitlist/seat-dialog.tsx"
git commit -m "feat: add seat-from-waitlist dialog"
```

---

### Task 6: Waitlist page wiring

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/waitlist/page.tsx` (replaces the Phase 1 stub)
- Create: `src/app/(dashboard)/r/[slug]/waitlist/waitlist-view.tsx`

**Interfaces:**
- Consumes: `listAvailableTables` (Task 2), `AddWaitlistDialog` (Task 4), `SeatDialog`/`SeatableTable` (Task 5), `updateWaitlistStatusAction` (Task 3), `sortTablesByNumber` (Phase 4, `@/lib/sort-tables`).
- Produces: the real `/r/[slug]/waitlist` page.

- [ ] **Step 1: Page**

`src/app/(dashboard)/r/[slug]/waitlist/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { getDayRange } from "@/lib/reservation-dates";
import { sortTablesByNumber } from "@/lib/sort-tables";
import { WaitlistView } from "./waitlist-view";

export default async function WaitlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { slug } });
  const { start, end } = getDayRange(new Date());

  const [waiting, todayHistory, rawTables, reservations] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { restaurantId: restaurant.id, status: "WAITING" },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        restaurantId: restaurant.id,
        status: { in: ["SEATED", "CANCELLED", "NO_SHOW"] },
        joinedAt: { gte: start, lt: end },
      },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.table.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, number: true, capacity: true },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { tableId: true, startsAt: true, durationMinutes: true },
    }),
  ]);

  return (
    <WaitlistView
      slug={slug}
      waiting={waiting}
      todayHistory={todayHistory}
      tables={sortTablesByNumber(rawTables)}
      reservations={reservations}
    />
  );
}
```

- [ ] **Step 2: Waitlist view**

`src/app/(dashboard)/r/[slug]/waitlist/waitlist-view.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddWaitlistDialog } from "./add-waitlist-dialog";
import { SeatDialog, type SeatableTable } from "./seat-dialog";
import { updateWaitlistStatusAction } from "./actions";
import { listAvailableTables } from "@/lib/table-allocation";
import type { WaitlistStatus } from "@/generated/prisma/client";

export type WaitlistEntryItem = {
  id: string;
  partySize: number;
  quotedWaitMinutes: number | null;
  status: WaitlistStatus;
  notes: string | null;
  joinedAt: Date;
  customer: { name: string; phone: string | null };
};

type ReservationForAvailability = { tableId: string | null; startsAt: Date; durationMinutes: number };

function formatElapsed(joinedAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - joinedAt.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const HISTORY_LABELS: Partial<Record<WaitlistStatus, string>> = {
  SEATED: "Seated",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function WaitlistView({
  slug,
  waiting,
  todayHistory,
  tables,
  reservations,
}: {
  slug: string;
  waiting: WaitlistEntryItem[];
  todayHistory: WaitlistEntryItem[];
  tables: SeatableTable[];
  reservations: ReservationForAvailability[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [seating, setSeating] = useState<{ id: string; name: string; partySize: number } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleStatusChange(id: string, status: "CANCELLED" | "NO_SHOW") {
    await updateWaitlistStatusAction(slug, id, status);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Waitlist</h1>
        <Button className="h-11 px-5 text-base" onClick={() => setAddOpen(true)}>
          Add to waitlist
        </Button>
      </div>

      {waiting.length === 0 ? (
        <p className="py-16 text-center text-base text-muted-foreground">No one is waiting right now.</p>
      ) : (
        <ul className="divide-y divide-border rounded-[5px] border border-border">
          {waiting.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{entry.customer.name}</p>
                <p className="text-base text-muted-foreground">
                  Party of {entry.partySize}
                  {entry.customer.phone ? ` · ${entry.customer.phone}` : ""}
                  {" · waiting "}
                  {formatElapsed(entry.joinedAt, now)}
                  {entry.quotedWaitMinutes != null ? ` (quoted ~${entry.quotedWaitMinutes}m)` : ""}
                </p>
                {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  className="h-9"
                  onClick={() => setSeating({ id: entry.id, name: entry.customer.name, partySize: entry.partySize })}
                >
                  Seat
                </Button>
                <Button variant="outline" className="h-9" onClick={() => handleStatusChange(entry.id, "NO_SHOW")}>
                  No-show
                </Button>
                <Button variant="outline" className="h-9" onClick={() => handleStatusChange(entry.id, "CANCELLED")}>
                  Cancel
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {todayHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Today</h2>
          <ul className="divide-y divide-border rounded-[5px] border border-border">
            {todayHistory.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{entry.customer.name}</p>
                  <p className="text-base text-muted-foreground">Party of {entry.partySize}</p>
                </div>
                <Badge variant="outline">{HISTORY_LABELS[entry.status]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AddWaitlistDialog open={addOpen} onOpenChange={setAddOpen} slug={slug} onAdded={() => router.refresh()} />
      <SeatDialog
        open={seating !== null}
        onOpenChange={(open) => !open && setSeating(null)}
        slug={slug}
        waitlistEntryId={seating?.id ?? null}
        guestName={seating?.name ?? ""}
        availableTables={
          seating ? listAvailableTables(tables, reservations, { partySize: seating.partySize, now }) : []
        }
        onSeated={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Visit `/r/blue-fork/waitlist` as Owner. Click "Add to waitlist", fill in a party, submit — confirm it appears in the waiting list with a "waiting 0m" indicator. Click "Seat", pick a table — confirm the entry moves into "Today" as Seated, and a new reservation shows up on the Reservations page. Add another party and click "Cancel" — confirm it moves to "Today" as Cancelled.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/r/[slug]/waitlist/page.tsx" "src/app/(dashboard)/r/[slug]/waitlist/waitlist-view.tsx"
git commit -m "feat: wire waitlist page with add/seat/cancel flows"
```

---

### Task 7: Playwright e2e — Definition of Done

**Files:**
- Create: `e2e/phase5-waitlist.spec.ts`

**Interfaces:**
- Consumes: the running production build, the seeded `owner@blue-fork.example.com` account.

- [ ] **Step 1: Write the test**

`e2e/phase5-waitlist.spec.ts`:

```typescript
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_TABLE_NUMBER = "WL-1";
const FIXTURE_GUEST_NAME = "E2E Waitlist Guest";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM waitlist_entry WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_GUEST_NAME]
    );
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_GUEST_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_GUEST_NAME]);
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 5 Waitlist", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("add a walk-in, seat them, and see the reservation on the calendar", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    // A table to seat into, via the existing Manage Tables dialog.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/r/blue-fork/waitlist");
    await page.getByRole("button", { name: "Add to waitlist" }).click();
    await page.getByLabel("Name").fill(FIXTURE_GUEST_NAME);
    await page.getByLabel("Phone").fill("555-000-4444");
    await page.getByLabel("Party size").fill("2");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(FIXTURE_GUEST_NAME)).toBeVisible();
    await expect(page.getByText(/waiting \d+m/)).toBeVisible();

    await page.getByRole("button", { name: "Seat" }).click();
    await page.getByRole("button", { name: new RegExp(`Table ${FIXTURE_TABLE_NUMBER}`) }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Moved into Today's history, no longer in the active waiting list.
    await expect(page.getByText("No one is waiting right now.")).toBeVisible();
    await expect(page.getByText("Today")).toBeVisible();
    await expect(page.getByText("Seated")).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=day");
    await expect(page.getByText(FIXTURE_GUEST_NAME)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:e2e -- e2e/phase5-waitlist.spec.ts
```

Expected: PASS. Run it a second time immediately after to confirm the `beforeAll`/`afterAll` hooks make it idempotent.

- [ ] **Step 3: Run the full suite**

```bash
pnpm test:e2e
```

Expected: all e2e specs across every phase still PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/phase5-waitlist.spec.ts
git commit -m "test: add Playwright coverage for Phase 5 definition of done"
```
