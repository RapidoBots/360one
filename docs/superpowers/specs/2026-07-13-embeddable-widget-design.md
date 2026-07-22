# Embeddable Reservation Widget — Design Spec

Date: 2026-07-13
Status: Approved
Scope: Pulled forward ahead of the remaining core roadmap (Waitlist, Notifications, Reports, Settings — Phases 5-8), the same way Phase 3 was pulled forward ahead of Phase 2 earlier. Every prior phase's spec explicitly deferred this as "v2, out of scope everywhere"; this spec is that v2 work.

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin (done) → 3) Reservations core (done) → 4) Floor Manager + Smart Allocation (done) → 5) Waitlist → 6) Notifications → 7) Reports → 8) Settings. This spec covers the embeddable booking widget, previously deferred past all of the above.

A restaurant embeds this widget on their own website via a plain `<iframe>` — no JS bundle, no cross-origin script injection, works regardless of the host site's own tech stack. An anonymous visitor picks a party size, date, and time from real availability, reviews their selection, submits contact info, and gets a booking request that lands as `PENDING` for staff to approve through the reservations page they already use — no new approval UI, just a new status value on the same infrastructure.

## 1. Data Model

Two additions — no new models:

```prisma
enum ReservationStatus {
  PENDING    // new — widget bookings start here, awaiting staff approval
  CONFIRMED
  SEATED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum ContactChannel {
  EMAIL
  SMS
  CALL
}

model Customer {
  // ...existing fields (id, restaurantId, name, email, phone, reservations, createdAt)...
  preferredContact ContactChannel @default(EMAIL)
}
```

`PENDING` reservations count toward table-conflict checks exactly like `CONFIRMED` ones (excluded from conflict checks: only `CANCELLED`/`NO_SHOW`), so two public visitors can't both be offered the same table/slot before staff reviews either request. Staff approve or decline a pending request the same way they already change any reservation's status — opening it in the existing reservation modal (Phase 3) and picking a new status from the dropdown that already lists every `ReservationStatus`. `PENDING` also becomes one more filter chip alongside the existing status filters on the Reservations page — no dedicated "approval inbox" page.

`preferredContact` lives on `Customer` (alongside email/phone) since it's a durable guest preference, not a one-off choice tied to a single booking. It has no effect yet — Phase 6 (Notifications) is what will eventually read it — but it needs to exist now so it isn't lost.

## 2. Public Route & Access

New route: `src/app/(public)/book/[slug]/page.tsx`, with its own minimal layout — no top nav, no sidebar, no dashboard chrome — since this page is meant to be iframed standalone on a restaurant's own website.

No auth guard: this is for anonymous visitors. Instead, the page checks the restaurant exists and is `ACTIVE`. An unknown slug or a `SUSPENDED` restaurant shows a friendly "This restaurant isn't currently accepting online reservations" message in place of the booking form, rather than a bare 404 — kinder to a restaurant's own site visitors landing in an iframe.

**Explicit known gap:** no CAPTCHA, rate-limiting, or other bot-protection this phase. This is a public, unauthenticated endpoint that writes `Customer` and `Reservation` rows, which is a real spam vector — flagged deliberately here (see Explicitly Out of Scope) rather than silently omitted, to revisit if abuse becomes an actual problem.

## 3. Slot Availability

A new pure helper, `src/lib/widget-availability.ts`:

```ts
export function getAvailableSlots(
  tables: { id: string; capacity: number }[],
  reservations: { tableId: string | null; startsAt: Date; durationMinutes: number }[],
  input: { partySize: number; date: string } // date: YYYY-MM-DD
): string[] // "HH:mm" slots with at least one table free
```

Reuses the existing `doesOverlap` helper (from Phase 3's `reservation-conflicts.ts`): a slot is available if any table with `capacity >= partySize` has no overlapping reservation for a 90-minute block starting at that slot (the app-wide default duration — no duration picker in the widget).

- **Hours:** the same 7am–11pm window already hardcoded in Timeline/Floor Manager (`DAY_START_HOUR`/`DAY_END_HOUR` — a shared constant, not redefined per file), but at **15-minute** increments to match the reference design (the internal calendar views use 30-minute increments; the widget does not need to match that).
- **Party size:** a dropdown of 1–10. Below it, static copy: *"If you are more than 10 people or if you cannot find availability, please call us."*
- **Date strip:** 7 visible days with prev/next-week arrows and a jump-to-date control (native `<input type="date">`, consistent with the rest of the app's Global Constraint on date pickers). Today is highlighted. Each date shows **Available** (green) if `getAvailableSlots` returns anything for it, otherwise **Full** (red). There is no **Closed** state: business hours aren't per-day configurable yet (real Phase 8 Settings work), so a day is only ever Available or Full.

## 4. Widget Steps

Single page, all client-side state (`src/app/(public)/book/[slug]/booking-widget.tsx`), three steps:

**Step 1 — Party, date, time.** Party-size dropdown, the date strip, and the time-slot grid (separate "AM" and "PM" headed sections; a section renders "No places available" text when empty) all on one screen. Clicking an available slot stores `{ partySize, date, time }` and advances to Step 2.

**Step 2 — Review.** A summary line: *"Party of {partySize} on {formatted date} at {formatted time}."* A **Change** button re-renders the exact same Step 1 UI inline, pre-filled with the current selection; picking a new slot there updates the stored selection and returns to the review view. A **Continue** button advances to Step 3.

**Step 3 — Contact info.** Name, Email, and Phone (all required — staff need a way to reach the guest to approve or follow up), a "Preferred contact method" select (Email/SMS/Call, defaulting to Email), and an optional Special requests textarea (the same field `Reservation.specialRequests` already has — a widget booking with a note shows that note in the normal reservation modal too). Submitting calls the Server Action below.

## 5. Submission & Approval

`createWidgetReservationAction(slug, input)` in `src/app/(public)/book/[slug]/actions.ts`:

1. Loads the restaurant by slug; rejects if missing or not `ACTIVE`.
2. **Re-checks the chosen slot is still available** right before writing (via the same conflict logic `getAvailableSlots` uses) — another visitor may have taken it between this visitor loading the page and submitting. If it's gone, returns a friendly error asking them to pick a different time rather than double-booking.
3. Calls the existing `findOrCreateCustomer` (Phase 3, `reservations-data.ts`) with the submitted name/email/phone, then updates that customer's `preferredContact`.
4. Creates the `Reservation` with `status: "PENDING"` and `tableId: null` (left unassigned — staff place it on a table later, same as any manually-created reservation with no table picked).

Returns `{ ok: true, booking: { partySize, date, time } }` or `{ ok: false, error }`.

## 6. Success Screen & Branding

On success, a Framer Motion animation (a checkmark scaling and fading in — restrained, not confetti) with copy honest to the `PENDING` state: *"Thanks, {name}! We've received your request for {partySize} on {date} at {time} — we'll be in touch to confirm."* Never "You're confirmed," since it isn't yet. A **Book another reservation** button resets all widget state back to Step 1, so the same iframe stays usable without a page reload.

A small persistent footer — "Powered by 360One Inc." — appears on every step, including the success screen.

## 7. Settings Embed Snippet

The Settings page (`/r/[slug]/settings`, currently entirely a stub) gets exactly one real section: a read-only code box showing the ready-to-paste `<iframe src="{origin}/book/{slug}" ...>` tag, built client-side from `window.location.origin` (so it's correct in any environment without a hardcoded domain), plus a Copy button. Every other section of Settings stays "Coming in Phase 8."

## 8. Testing & Definition of Done

- **Unit tests (Vitest):** `getAvailableSlots()` — full 7am–11pm availability at 15-minute steps with no reservations; a booked table correctly excluded from its overlapping slots; a party size exceeding every table's capacity returns an empty list; a `PENDING` reservation blocks a slot the same as a `CONFIRMED` one.
- **E2e (Playwright):** visit `/book/blue-fork` with no session → pick a party size and an available slot → Step 2 review → Change → pick a different slot → Continue → fill contact info → submit → see the success screen with the correct party size/date/time → confirm (via direct DB check) the reservation was created with status `PENDING` and no table → sign in as Owner, find it on the Reservations page filtered to Pending, open it, change its status to Confirmed through the existing modal → confirm it now shows as Confirmed. Also confirm the Settings page's snippet box renders a `<iframe>` tag containing the correct restaurant slug.

**Definition of Done:** An anonymous visitor at `/book/[slug]` can pick a party size, date, and time from real availability; review and change their selection; submit their contact info; and land on a success screen honest about pending approval. The resulting reservation is immediately visible and actionable on the existing Reservations page with no new staff-facing UI beyond a new status value. The restaurant's Owner can copy a working iframe snippet from Settings.

## Explicitly Out of Scope

- CAPTCHA, rate-limiting, or other bot/spam protection on the public endpoint (a real, deliberately-flagged gap — see Section 2).
- Actually sending an email/SMS confirmation on submission — Phase 6 Notifications doesn't exist yet; `preferredContact` is stored only for that phase to use later.
- Per-day or closed-day business hours configuration — real Phase 8 Settings work; every day is Available or Full, never Closed.
- Automatic table assignment for widget bookings (left unassigned, per this spec's decision).
- A dedicated pending-requests approval inbox or notification badge — reuses the existing status dropdown and filter chips.
- The alternative JS-embed-script approach (iframe only).
- Multi-timezone handling beyond the restaurant's own local server time (matches the rest of the app's existing convention).
