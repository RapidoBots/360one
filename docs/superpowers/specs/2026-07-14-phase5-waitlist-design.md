# Phase 5: Waitlist — Design Spec

Date: 2026-07-14
Status: Approved
Scope: Fifth of 8 phases for the Restaurant Reservation SaaS platform. Built after Phase 4 (Floor Manager) and the embeddable widget (pulled forward ahead of the remaining core roadmap, the same way Phase 3 was pulled forward earlier).

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin (done) → 3) Reservations core (done) → 4) Floor Manager + Smart Allocation (done) → *Embeddable widget (done, pulled forward)* → **5) Waitlist (this spec)** → 6) Notifications → 7) Reports → 8) Settings.

This spec covers `/r/[slug]/waitlist` (currently a stub page): a staff-facing tool for tracking walk-in parties waiting for a table, and seating them once one opens up. It is deliberately scoped to walk-ins at the restaurant, not a remote/public waitlist — joining remotely via the embeddable widget is a separate, later consideration.

## 1. Data Model

One new model, no changes to existing ones beyond adding the inverse relation fields:

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

`Restaurant` gains a `waitlistEntries WaitlistEntry[]` relation field; `Customer` gains the same. A waitlist entry is a dedicated model rather than a repurposed `Reservation`, since it has no assigned time — it just tracks "this party has been waiting since X," which doesn't fit `Reservation.startsAt`'s meaning as an actual booked time. It links to `Customer` via the same `findOrCreateCustomer` matching (phone/email) that reservations already use, so a walk-in's history stays connected if they've been in before or book again later. There is no link back to the `Reservation` an entry eventually becomes — once seated, the entry's job is done, and staff don't need to trace it further from the waitlist side.

## 2. Auth Guard & Server Actions

Reuses `assertRestaurantMember(slug)` from Phase 3 — no new guard type. New file `src/app/(dashboard)/r/[slug]/waitlist/actions.ts`:

- `addToWaitlistAction(slug, { guestName, guestPhone, guestEmail, partySize, quotedWaitMinutes, notes })` — matches/creates the `Customer` via `findOrCreateCustomer`, creates a `WaitlistEntry` with `status: "WAITING"`.
- `seatFromWaitlistAction(slug, waitlistEntryId, tableId)` — reuses the existing table-conflict check (the same one `quickSeatWalkInAction` and `createReservationAction` already use), creates a `Reservation` (`status: "SEATED"`, `startsAt: now`, 90-minute duration, the picked table), and updates the waitlist entry to `status: "SEATED"`.
- `updateWaitlistStatusAction(slug, waitlistEntryId, status: "CANCELLED" | "NO_SHOW")` — for a party that leaves before being seated.

A new pure helper alongside the existing `recommendTable` in `src/lib/table-allocation.ts`:

```ts
export function listAvailableTables(
  tables: AllocationTable[],
  reservations: AllocationReservation[],
  input: { partySize: number; now: Date }
): AllocationTable[]
```

Same capacity/conflict logic as `recommendTable`, but returns every currently-free table sorted smallest-first, rather than auto-picking just one — seating from the waitlist needs to show a pickable list, since staff (not an algorithm) choose which table to use.

## 3. Waitlist Page (`/r/[slug]/waitlist`)

A simple list view — not a spatial canvas like Floor Manager. The active `WAITING` entries render in FIFO order (oldest first), each showing guest name, party size, phone, a quoted-wait badge (when set), and elapsed time since they joined. Below that, a compact "Today" section lists recently `SEATED`/`CANCELLED`/`NO_SHOW` entries from the same day, so staff can see who's already been handled without hunting through the full Reservations page.

- **"Add to waitlist"** button opens a dialog: Name, Phone, Email (optional), Party size, Quoted wait in minutes (optional), Notes (optional).
- **"Seat"** on an entry opens a dialog listing currently-available tables (via `listAvailableTables`) to pick from. If none fit right now, it shows "No tables free right now" instead of blocking the action — staff can close and check back once something opens up.
- A small menu on each waiting entry also offers **Cancel** or **No-show**, calling `updateWaitlistStatusAction`.

## 4. Elapsed Time

Each waiting row shows "waiting Xm" (or "Xh Ym" past 60 minutes), computed client-side from `joinedAt` vs. the current time, refreshed every 60 seconds via a plain `setInterval` tick — the same lightweight live-update mechanism Floor Manager already uses for its table statuses, not a new pattern.

## 5. Testing & Definition of Done

- **Unit tests (Vitest):** `listAvailableTables()` — returns every table with enough capacity and no conflicting reservation, sorted smallest-first; returns an empty list when nothing fits; excludes a table with an overlapping reservation; does not exclude a table whose conflicting reservation is on a different table.
- **E2e (Playwright):** sign in as Owner → Waitlist page → add a party (name, phone, party size) → confirm it appears in the waiting list with an elapsed-time indicator → click Seat → pick an available table → confirm the entry moves out of the active waiting list into Today's history as Seated → confirm a new `SEATED` reservation for that guest now shows on the Reservations page for today.

**Definition of Done:** Logged in as Owner/Staff on `/r/[slug]/waitlist`, you can add a walk-in party to the list, see how long each party has been waiting, seat a party at a currently-available table with one click (creating a real reservation), or mark a party cancelled/no-show if they leave before being seated.

## Explicitly Out of Scope

- SMS/email "your table is ready" notifications — Phase 6 Notifications doesn't exist yet; staff notify guests manually (in person or by phone).
- Joining the waitlist remotely via the embeddable widget — this phase is staff-entered walk-ins only; a public waitlist-join flow is a separate, later consideration.
- Calculating wait time from real table turnover data — always a manual staff estimate, entered as a plain number.
- Manually reordering the queue — strict FIFO by join time, no drag-to-reorder.
- A waitlist count or badge surfaced on Floor Manager or the dashboard — a standalone page this phase.
