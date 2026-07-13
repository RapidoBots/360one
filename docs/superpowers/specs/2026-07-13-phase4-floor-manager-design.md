# Phase 4: Floor Manager + Smart Allocation — Design Spec

Date: 2026-07-13
Status: Approved
Scope: Fourth of 8 phases for the Restaurant Reservation SaaS platform. Built directly after Phase 2 (Super Admin) and Phase 3 (Reservations Core).

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin (done) → 3) Reservations core (done) → **4) Floor Manager + Smart Allocation (this spec)** → 5) Waitlist → 6) Notifications → 7) Reports → 8) Settings. Embeddable widget is v2, out of scope everywhere.

This phase makes `/r/[slug]/floor-manager` (currently a stub page) real. Phase 3's spec deliberately introduced `Table` as a minimal model (number, capacity, area — no position/shape) specifically so this phase could add visual layout fields to that same model rather than introducing a second one. This phase does exactly that, and adds two new capabilities on top: a live-status floor plan with one-click walk-in seating, and a smart best-fit table recommendation reused from the existing Phase 3 reservation modal.

## 1. Data Model

Only `Table` changes — two nullable position fields plus a shape enum:

```prisma
enum TableShape {
  SQUARE
  ROUND
}

model Table {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  number       String
  capacity     Int
  area         String?
  posX         Float?
  posY         Float?
  shape        TableShape @default(SQUARE)
  reservations Reservation[]
  createdAt    DateTime   @default(now())

  @@unique([restaurantId, number])
  @@map("table")
}
```

No width/height fields — a table's visual size on the canvas is derived from its existing `capacity` field (small/medium/large tiers), not stored separately. Tables with `posX`/`posY` both null are "unplaced" — they don't render on the floor plan canvas at all; they only appear in an "Unplaced tables" tray while in Edit Layout mode, until the owner drags them into position. No new models: walk-in guests are just a regular `Customer` (name `"Walk-in"`) with a regular `Reservation`, nothing floor-manager-specific persisted beyond the two new `Table` fields.

## 2. Auth Guard & Server Actions

Reuses `assertRestaurantMember(slug)` from Phase 3 — no new guard needed. New actions in `src/app/(dashboard)/r/[slug]/floor-manager/actions.ts`:

- `updateTableLayoutAction(slug, tableId, { posX, posY, shape })` — saves a table's position/shape after a drag in Edit Layout mode. Also used to *place* a previously-unplaced table (its first drag out of the tray sets its initial coordinates).
- `quickSeatWalkInAction(slug, tableId, partySize)` — creates a `Customer` named `"Walk-in"` and a `Reservation` with `status: "SEATED"`, `startsAt: now`, `durationMinutes: 90` (the existing app-wide default), assigned to `tableId`. Guards against seating an already-occupied table using the same conflict check reservations already use.
- Freeing a table reuses the existing `updateReservationAction` (set `status: "COMPLETED"`) — no new action needed for this.

## 3. Smart Allocation

A new pure helper, `src/lib/table-allocation.ts`:

```ts
export function recommendTable(
  tables: { id: string; capacity: number }[],
  reservations: { tableId: string | null; startsAt: Date; durationMinutes: number }[],
  input: { partySize: number; startsAt: Date; durationMinutes: number }
): string | null
```

Filters tables to `capacity >= partySize`, excludes any with a conflicting reservation (reusing the existing `doesOverlap` pure helper from `reservation-conflicts.ts` — the same one `hasTableConflict` already uses server-side), sorts the remainder by capacity ascending, and returns the smallest fitting available table's id (or `null` if none fit). This is a genuine time+capacity-aware suggestion, not just a capacity filter, and it reuses data the Reservations Calendar already fetches (the day's reservations) — the reservation modal needs one new prop (`reservations`) but no new data fetching.

Applied in one place: the reservation modal's "Assigned table" dropdown. When creating a new reservation (not editing an existing one), the recommended table is auto-selected by default and labeled "Recommended" in the list; staff can still override it. The Floor Manager's walk-in flow doesn't need this — clicking an Available table already means "this one," so recommendation only applies to the modal's picker.

## 4. Floor Manager Page — View Mode (`/r/[slug]/floor-manager`)

Unlike the Reservations calendar, there's no date picker — Floor Manager always shows today, live, since "Available/Reserved soon/Seated" is only a meaningful concept relative to right now. Server Component fetches today's tables and today's non-cancelled reservations (the same data shape the Reservations page already fetches). Client Component renders a fixed-size canvas (a "room," roughly 1000×700px, scrollable on small screens) with each **placed** table (non-null `posX`/`posY`) as an absolutely-positioned box, shaped round/square, sized by a capacity tier (small/medium/large), labeled with its number and capacity.

Each table's status is derived live from "now" vs. its reservations, never stored:

- **Available** (gray) — no active or imminent reservation. Clicking it opens the quick-seat dialog (party size → `quickSeatWalkInAction`).
- **Reserved soon** (amber) — a CONFIRMED reservation on this table starts within the next 30 minutes. Shows the guest name and time on the box. Not clickable, to avoid accidentally walk-in-seating a table that's about to be claimed.
- **Seated** (green) — an active SEATED reservation right now. Clicking it opens a popover with guest name, party size, seated time, and a "Free table" button (`updateReservationAction(..., {status: "COMPLETED"})`).

A small legend explains the three colors. Because "reserved soon" depends on the clock, the page re-derives every table's status every 60 seconds client-side (a plain `setInterval` tick forcing a re-render — no polling or websocket, since the underlying data only changes through actions that already call `router.refresh()`).

Unplaced tables don't render on the canvas in view mode. When the count is greater than zero, a small banner reads "N tables aren't on the floor plan yet" linking into Edit Layout.

## 5. Edit Layout Mode

An "Edit Layout" toggle switches the same page into arrange mode:

- Placed tables become draggable using plain pointer events (`onPointerDown`/`onPointerMove`/`onPointerUp` updating local state, no drag-and-drop library) — dragging updates position optimistically and persists via `updateTableLayoutAction` on release, clamped to stay within the canvas bounds.
- An "Unplaced tables" tray (a bottom strip) lists tables with no position; dragging one onto the canvas sets its initial `posX`/`posY` from the drop point and removes it from the tray.
- Clicking a table box in edit mode opens a small popover to toggle its shape (round/square), also persisted via `updateTableLayoutAction`.
- A "Done" button returns to view mode. There's no separate save step — every drag or shape toggle persists immediately, matching how every other mutation in the app already works.

The existing Phase 3 "Manage tables" dialog on the Reservations page is unchanged and keeps owning table creation (number/capacity/area) — Edit Layout only arranges position/shape for tables that already exist.

## 6. Testing & Definition of Done

- **Unit tests (Vitest):** `recommendTable()` — capacity filtering, conflict exclusion (reusing `doesOverlap`), smallest-fit-first sorting, and returning `null` when nothing fits.
- **E2e (Playwright):** create a table via the existing Manage Tables dialog (so it starts unplaced) → confirm it appears in Edit Layout's Unplaced tray → drag it onto the canvas → reload and confirm the position persisted → switch to view mode, click the now-Available table → quick-seat a walk-in by party size → confirm it shows Seated → click it → Free table → confirm it's back to Available → book a reservation through the existing reservation modal for a party size only one table fits → confirm that table is pre-selected.

**Definition of Done:** Logged in as Owner/Staff on `/r/[slug]/floor-manager`, you can arrange tables freely on a visual floor plan (position and round/square shape), see each table's live status (Available/Reserved soon/Seated) with no manual state toggling required, seat a walk-in with one click plus a party size, free a table when a party leaves, and get a smart best-fit table suggestion when booking through the existing reservation modal.

## Explicitly Out of Scope (this phase)

- Multi-room/multi-floor plans — one canvas per restaurant.
- Table combining/splitting for large parties.
- A "needs cleaning" state between Seated and Available.
- Removing/deleting tables from the floor plan (only position/shape editing plus the existing Phase 3 create flow).
- Background floor-plan image upload for tracing over a real room photo.
- Viewing a past or future day's floor plan — this page is always "today, live."
