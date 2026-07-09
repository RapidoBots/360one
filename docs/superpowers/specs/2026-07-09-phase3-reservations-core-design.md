# Phase 3: Reservations Core — Design Spec

Date: 2026-07-09
Status: Approved
Scope: Third of 8 phases for the Restaurant Reservation SaaS platform. Built directly after Phase 1 (Foundation) — Phase 2 (Super Admin onboarding) was deliberately deferred so client-visible progress (booking flow) could be demoed sooner. This doesn't create a dependency problem: Phase 1's seed script already provides a demo restaurant and Owner/Staff accounts, so Phase 2's onboarding UI isn't required for this phase to work.

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin → **3) Reservations core (this spec)** → 4) Floor Manager + Smart Allocation → 5) Waitlist → 6) Notifications → 7) Reports → 8) Settings. Embeddable widget is v2, out of scope everywhere.

This phase makes `/r/[slug]/reservations` and `/r/[slug]/customers` (currently stub pages) real, and lays the groundwork Phase 4 builds on:

- `Table` is introduced now as a minimal model (number, capacity, area — no position/shape) so reservations can reference a table. Phase 4 adds visual layout fields to this same model rather than introducing a second one.
- `Customer` and `Reservation` are new models this phase owns fully.

## 1. Data Model

```prisma
model Table {
  id           String   @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  number       String   // display label, e.g. "12" or "A3"
  capacity     Int
  area         String?  // freeform section label, e.g. "Patio" — no layout/position yet, that's Phase 4
  reservations Reservation[]
  createdAt    DateTime @default(now())

  @@unique([restaurantId, number])
}

model Customer {
  id           String   @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  name         String
  email        String?
  phone        String?
  reservations Reservation[]
  createdAt    DateTime @default(now())
}

enum ReservationStatus {
  CONFIRMED
  SEATED
  COMPLETED
  CANCELLED
  NO_SHOW
}

model Reservation {
  id              String   @id @default(cuid())
  restaurantId    String
  restaurant      Restaurant @relation(fields: [restaurantId], references: [id])
  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])
  tableId         String?
  table           Table? @relation(fields: [tableId], references: [id])
  partySize       Int
  startsAt        DateTime
  durationMinutes Int      @default(90)
  status          ReservationStatus @default(CONFIRMED)
  specialRequests String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

`Restaurant` gains `tables Table[]`, `customers Customer[]`, `reservations Reservation[]` relations. `Customer.phone`/`email` are both optional — a booking might only supply one; guest-matching logic (below) handles either.

## 2. Reservation Modal, Guest Matching & Table Conflicts

- One shadcn `Dialog`, used for both create and edit (edit pre-fills from an existing reservation). Sections in order: **Guest Information** (name, email, phone) → **Reservation Details** (date, time, party size, duration, special requests) → **Assigned Table** (dropdown filtered to tables with `capacity >= partySize`) → **Confirmation** (read-only summary + submit).
- **Guest matching:** on submit, look up an existing `Customer` in this restaurant by phone (if provided), falling back to email (if no phone) — reuse it and update the name if changed; otherwise create a new `Customer`. No separate "add customer" step exists; customers are a byproduct of booking.
- **Table conflict check:** if a table is assigned, reject submission (inline error) if that table has another reservation whose `[startsAt, startsAt + durationMinutes)` window overlaps the new one, excluding the reservation being edited (self-exclusion matters for edits). Leaving the table unassigned is allowed.
- This is a manual double-booking guard only — not the Phase 4 smart-allocation engine (which will auto-*suggest* the best table; this phase only *validates* a manually chosen one).
- One-click editing: clicking any reservation in any calendar view opens this same modal pre-filled; saving updates in place.

## 3. Calendar: Day / Week / Timeline + Search & Filters

- View switcher (tabs) atop the Reservations page: Day, Week, Timeline. All three read from one shared reservation query scoped to a date (Day/Timeline) or date range (Week) — no per-view data layer.
- **Day view:** vertical time-slot list for the selected date, reservations sorted by start time; each row shows guest name, party size, table, and a status-colored badge.
- **Week view:** 7-day grid; each day shows a compact stacked list of that day's reservations (guest name + time); clicking a day jumps to Day view for that date.
- **Timeline view:** table-rows × time-columns grid for the selected date; each reservation renders as a horizontal block spanning its duration — gives an at-a-glance view of table occupancy across the day.
- **Search:** text box above the calendar matching guest name or phone (server-side), filters whichever view is active.
- **Status filter:** multi-select dropdown (Confirmed/Seated/Completed/Cancelled/No-show), same filtering behavior as search.
- Date navigation: prev/next/today controls, day-stepping for Day and Timeline, week-stepping for Week.

## 4. Customers Page

- List: name, phone/email, reservation count, last visit date (aggregated from their `Reservation` rows).
- Click-through to a detail view (slide-over panel) showing full reservation history (past + upcoming), each entry linking back into the reservation modal for one-click editing.
- No standalone add/edit/delete customer forms. Editing a customer's name/email/phone happens by editing one of their reservations' Guest Information section, which updates the shared `Customer` row.

## 5. Testing & Definition of Done

- **Unit tests (Vitest):** pure logic in isolation — table-overlap conflict detection (`doesOverlap(a, b)` on `[start, start+duration)` ranges) and customer-matching key derivation (phone-first, email-fallback). Same pattern as Phase 1's `auth-routes.ts`.
- **E2e (Playwright):** create a reservation via the modal → appears correctly in Day view (guest/table/status) → edit it (change table/time) → update reflects → a `Customer` row was auto-created and appears in the Customers list with that reservation in their history → search by guest name filters the calendar → Day/Week/Timeline show the same reservation consistently → assigning an already-booked table at an overlapping time is rejected with an inline error.

**Definition of Done:** Logged in as Owner/Staff on `/r/blue-fork/reservations`, you can create a table (simple form), create a reservation through the modal (guest info auto-creates or matches a customer, table conflict is checked), see it across all three calendar views, edit it in place, search/filter it, and see the guest listed on `/r/blue-fork/customers` with their reservation history.

## Explicitly Out of Scope (this phase)

- Visual floor plan / SVG table layout, drag-and-drop positioning, table status colors tied to a live floor view (Phase 4).
- Smart/automatic table allocation — this phase only validates a manually assigned table, doesn't suggest one (Phase 4).
- Waitlist (Phase 5).
- Email/SMS confirmations and reminders (Phase 6).
- Reports/analytics beyond what's needed for this phase's own UI (Phase 7).
- Restaurant-level configurable default reservation duration, business hours, reservation rules (Phase 8 Settings) — duration is a fixed 90-minute default, editable per booking only.
- Standalone customer CRUD forms (customers are created only via the reservation modal's guest-matching step).
