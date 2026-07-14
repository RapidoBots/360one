# Phase 7: Reports — Design Spec

Date: 2026-07-15
Status: Approved
Scope: Seventh of 8 phases for the Restaurant Reservation SaaS platform.

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin (done) → 3) Reservations core (done) → 4) Floor Manager + Smart Allocation (done) → *Embeddable widget (done, pulled forward)* → 5) Waitlist (done) → 6) GHL Reservation Sync (done, revised from "Notifications") → **7) Reports (this spec)** → 8) Settings.

`/r/[slug]/reports` is currently a stub page ("Coming in Phase 7"). The Dashboard (Phase 1) already shows a single-day snapshot — today's reservation count, today's occupancy, today's upcoming arrivals, and a reservations-by-hour chart for today only. Reports is the historical, date-range-driven complement: trends over time, no-show/cancellation rates, customer insights, and a CSV export — everything a restaurant needs to look back at a period rather than just today.

## 1. Date Range

Two native `<input type="date">` fields (Start, Start defaulting to 30 days ago; End defaulting to today), matching the plain date-input pattern already used in the reservation modal and elsewhere in this codebase — no new date-picker dependency. Submitting reloads the page via query params (`?start=YYYY-MM-DD&end=YYYY-MM-DD`), the same pattern Reservations' day/week views already use for `?view=&date=`.

## 2. Historical Trends

Three bar charts, all built on one new generic chart component, `src/app/(dashboard)/r/[slug]/reports/report-bar-chart.tsx`, taking `{ data: { label: string; value: number }[] }` and rendering with `recharts` in the same visual style as the Dashboard's existing `ReservationsByHourChart` (CSS-variable colors, no axis lines, rounded bar tops).

- **Reservations per day** — one bar per calendar day in the range.
- **Busiest day of week** — totals bucketed into Mon–Sun.
- **Busiest hour of day** — totals bucketed by hour, using the shared `DAY_START_HOUR`/`DAY_END_HOUR` constants from `src/lib/business-hours.ts` (the same constants the embeddable widget and Timeline view already share, avoiding a third hand-rolled copy).
- **Reservations per table** — one bar per table, sorted with the existing `sortTablesByNumber` helper. This stands in for "table utilization": a true occupied-hours percentage would require modeling exact business hours per restaurant, which nothing in the app does yet (that's Phase 8 Settings' job). Counting reservations per table is simple, accurate today, and answers the same practical question — which tables are busiest or sitting idle.

All four charts are computed from a single query of the range's reservations (`status`, `startsAt`, `tableId`), bucketed by pure helper functions.

## 3. No-show & Cancellation Rates

Two headline stat tiles — **No-show rate** and **Cancellation rate**, each `count / total reservations in range × 100`, rounded to the nearest whole percent (0% shown when the range has zero reservations) — plus a status-breakdown bar chart (one bar per `ReservationStatus`: PENDING, CONFIRMED, SEATED, COMPLETED, CANCELLED, NO_SHOW), reusing the same `ReportBarChart` component from Section 2.

## 4. Customer Insights

- **Total unique guests** in the range (distinct `customerId` across the range's reservations, regardless of status — a cancelled or no-show reservation still counts as that guest having a reservation in the range).
- **New vs. Repeat** split: for each distinct guest in the range, "repeat" means that guest has more than one reservation *all-time* (not just within the range, and regardless of status — every reservation a guest has ever made counts toward this, including past cancellations/no-shows); otherwise "new". Shown as two counts.
- **Top repeat guests** — the 5 guests (among those appearing in the range) with the highest all-time reservation count (same all-time, any-status count as above), listed as name + total visit count.

## 5. CSV Export

A Server Action, `exportReservationsCsvAction(slug, { start, end }): Promise<{ ok: true; csv: string } | { ok: false; error: string }>`, builds a CSV string (columns: Date, Time, Guest Name, Party Size, Table, Status) from every reservation in the range, sorted by `startsAt`. The client turns the returned string into a `Blob` and triggers a download via a temporary anchor element — no new API route handler needed, consistent with every other data-changing or data-fetching operation in this app going through Server Actions.

## 6. Access

Same as every other restaurant dashboard page: any authenticated member of the restaurant (Owner or Staff), via the existing `requireRestaurantAccess` (page-level) and `assertRestaurantMember` (Server Action-level) guards. No new role tier — the `Role` enum stays `SUPER_ADMIN | OWNER | STAFF`.

## 7. Testing & Definition of Done

- **Unit tests (Vitest)** for the pure bucketing/aggregation helpers: reservations-per-day, busiest-day-of-week, busiest-hour-of-day, reservations-per-table, no-show/cancellation rate calculation, new-vs-repeat classification, top-repeat-guests ranking, and CSV row formatting (including a guest name containing a comma, to confirm proper CSV quoting).
- **E2e (Playwright):** create a small set of fixture reservations spanning a known date range with a mix of statuses and table assignments, load Reports with that range selected, and assert the headline stats (no-show rate, cancellation rate, total guests, new vs. repeat counts) and the CSV export match what the fixtures should produce.

**Definition of Done:** Any restaurant staff member can open `/r/[slug]/reports`, pick a date range, and see accurate trend charts, no-show/cancellation rates, customer insights, and export a CSV of that range's reservations — all computed live from existing reservation data, with no new data model required.

## Explicitly Out of Scope

- Revenue/financial reporting — no pricing or payment data exists anywhere in the schema.
- True occupied-hours table utilization (percentage of business hours a table was seated) — deferred until Phase 8 models real business hours; this phase uses reservations-per-table as a simpler proxy.
- Saved/scheduled reports, emailed report digests, or PDF export.
- Cross-restaurant reporting for Super Admin (this phase is restaurant-scoped only).
- Custom preset buttons ("Last 7/30/90 days") — the date range is two plain date inputs only.
- Any changes to the Dashboard's existing today-only snapshot.
