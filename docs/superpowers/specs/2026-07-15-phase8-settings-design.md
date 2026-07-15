# Phase 8: Settings — Design Spec

Date: 2026-07-15
Status: Approved
Scope: Eighth and final phase of the Restaurant Reservation SaaS platform.

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin (done) → 3) Reservations core (done) → 4) Floor Manager + Smart Allocation (done) → *Embeddable widget (done, pulled forward)* → 5) Waitlist (done) → 6) GHL Reservation Sync (done, revised from "Notifications") → 7) Reports (done) → **8) Settings (this spec)**.

`/r/[slug]/settings` currently has exactly one real section (the embed snippet, from the embeddable-widget phase) and one stub ("Other settings — Coming in Phase 8"). This phase makes that stub real. Three things were explicitly deferred to "Phase 8 Settings" across every earlier spec:

- Business hours and reservation rules — Phase 3 hardcoded a fixed 90-minute default duration; the embeddable widget's date strip explicitly has no "Closed" state because "business hours aren't per-day configurable yet"; Reports used reservations-per-table as a proxy for table utilization because true occupied-hours percentage "would require modeling exact business hours per restaurant, which nothing in the app does yet."
- Team member management — Phase 2 gave Super Admin the ability to *add* staff accounts but explicitly deferred "removing/deactivating individual staff accounts, or any other team-management beyond adding accounts" to this phase, and further deferred self-service (Owner managing their own team without Super Admin) here too.
- Nothing else — no other phase deferred anything further to "Phase 8."

This phase covers both, plus the following scope decisions made during brainstorming: business-hours configuration reaches into every feature that currently hardcodes the 7am–11pm window (the embeddable widget, Timeline view, the Dashboard's hour chart, and Reports' busiest-hour chart), not just the widget; and Team Members is a full self-service section — Owner can both add and deactivate/reactivate staff, not just deactivate accounts Super Admin already created.

## 1. Data Model

```prisma
model Restaurant {
  // ...existing fields...
  defaultReservationDurationMinutes Int @default(90)
  businessHours BusinessHours[]
}

model BusinessHours {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  dayOfWeek    Int        // 0 = Sunday ... 6 = Saturday, matching Date.getDay() convention already used in reservation-dates.ts
  isOpen       Boolean    @default(true)
  openTime     String?    // "HH:mm", null when isOpen is false
  closeTime    String?    // "HH:mm", null when isOpen is false

  @@unique([restaurantId, dayOfWeek])
  @@map("business_hours")
}

model User {
  // ...existing fields...
  active Boolean @default(true)
}
```

The migration backfills all 7 `BusinessHours` rows for every existing restaurant with `isOpen: true, openTime: "07:00", closeTime: "23:00"` — the same window every hardcoded constant in the app already uses. This is deliberate: nothing changes behaviorally for any existing restaurant, e2e fixture, or test until an Owner actually edits their hours through the new UI.

## 2. Business Hours & Reservation Rules

A new form section on `/r/[slug]/settings`, gated to Owner only via the same `assertRestaurantOwner(slug)` guard introduced in Section 3 — restaurant-wide configuration (hours, default duration) is treated the same as team management: an Owner-level decision, not a day-to-day Staff action. Seven rows, Sunday through Saturday, each with an Open/Closed `<select>` and two `<input type="time">` fields (disabled and cleared when Closed), plus one "Default reservation duration (minutes)" number input below the weekly grid. One Server Action, `updateBusinessSettingsAction(slug, { hours: { dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null }[]; defaultReservationDurationMinutes: number })`, upserts all 7 `BusinessHours` rows and the `Restaurant.defaultReservationDurationMinutes` field in one call.

`src/lib/business-hours.ts` is rewritten from static `DAY_START_HOUR`/`DAY_END_HOUR` constants to pure functions operating on a `BusinessHours[]` array:

```ts
export type DayHours = { dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null };

export function getHoursForDay(hours: DayHours[], dayOfWeek: number): { isOpen: boolean; startHour: number; endHour: number };
export function getWidestOpenWindow(hours: DayHours[]): { startHour: number; endHour: number };
```

`getHoursForDay` is for single-day contexts (a specific date's slots or grid). `getWidestOpenWindow` unions every open day's hours into one range, for contexts that aggregate across many days at once and can't pick a single day-of-week. Every caller that currently imports the static constants switches to one of these two functions:

- `src/lib/widget-availability.ts`'s `getAvailableSlots` gains a `businessHours: DayHours[]` parameter, calls `getHoursForDay` for the requested date's day-of-week, and returns `[]` immediately when that day is closed — this is what finally implements the widget's long-deferred "Closed" day state.
- `src/app/(dashboard)/r/[slug]/reservations/timeline-view.tsx` receives that day's specific hours as a prop (fetched by its page.tsx) instead of importing the constant, via `getHoursForDay`.
- `src/app/(dashboard)/r/[slug]/dashboard/page.tsx` deletes its own locally-duplicated `DAY_START_HOUR`/`DAY_END_HOUR` copy (the one whose comment explicitly says "duplicated rather than shared... until Phase 8 models real business hours") and uses `getHoursForDay` for today.
- `src/lib/report-metrics.ts`'s `busiestHourOfDay` gains a `businessHours: DayHours[]` parameter and uses `getWidestOpenWindow`, since a report's date range can span multiple days with different hours.

`Restaurant.defaultReservationDurationMinutes` replaces the hardcoded `90` in `quickSeatWalkInAction`, `seatFromWaitlistAction`, `createWidgetReservationAction`, and the reservation modal's initial form value (all four currently hardcode `90` directly).

## 3. Team Members

A new "Team members" section on `/r/[slug]/settings`, gated to Owner only via a new guard, `assertRestaurantOwner(slug)` in `src/lib/auth-guards.ts` (same shape as `assertRestaurantMember`, with an added `role !== "OWNER"` check). Shows a table of the restaurant's staff (name, email, role badge, Active/Inactive badge), an "Add staff member" button opening a dialog (name, email, password, role), and a per-row Deactivate/Reactivate button.

Two Server Actions in `src/app/(dashboard)/r/[slug]/settings/actions.ts`:

- `addTeamMemberAction(slug, { name, email, password, role }): Promise<SettingsActionResult>` — guarded by `assertRestaurantOwner`, reuses the same account-creation logic Super Admin's `addStaffMemberAction` already has (that logic is extracted into a small shared helper, `createUserAccount`, so it isn't duplicated between the two call sites).
- `setTeamMemberActiveAction(slug, userId, active: boolean): Promise<SettingsActionResult>` — guarded by `assertRestaurantOwner`, rejects with an error if `userId` is the calling Owner's own id (no self-deactivation), otherwise updates `User.active`.

Enforcement of `active` happens at a single choke point: `getSessionUser()` (`src/lib/auth-guards.ts`) treats a session belonging to an inactive user as if there were no session at all (returns `null`). Every existing guard (`requireRestaurantAccess`, `requireSuperAdmin`, `assertRestaurantMember`, `assertSuperAdmin`, and the new `assertRestaurantOwner`) already calls `getSessionUser()` internally, so deactivation is enforced everywhere — sign-in redirects, page access, and every Server Action — without modifying any of them individually.

## 4. Testing & Definition of Done

- **Unit tests (Vitest):** `getHoursForDay` and `getWidestOpenWindow` (open day, closed day, all-closed week, overlapping/non-overlapping windows); `getAvailableSlots` returns `[]` for a day marked closed and otherwise behaves as before; `busiestHourOfDay` correctly widens its bucket range across days with different hours.
- **E2e (Playwright):** Owner marks a day Closed in Settings and confirms the embeddable widget shows no available slots for that date; Owner changes the default reservation duration and confirms a newly created reservation uses it; Owner adds a staff member and confirms that account can sign in and reach the restaurant dashboard; Owner deactivates a staff member and confirms that account can no longer sign in; Owner cannot deactivate their own account (the button/action is rejected).

**Definition of Done:** An Owner can configure their restaurant's weekly business hours (including marking days fully closed) and default reservation duration from Settings, and those values now genuinely drive the embeddable widget, Timeline view, the Dashboard, and Reports instead of a shared hardcoded constant. An Owner can also add new staff accounts and deactivate/reactivate existing ones from Settings, without needing Super Admin for either — with deactivation enforced at sign-in, not just hidden in the UI.

## Explicitly Out of Scope

- Holiday-specific or date-specific business-hours overrides — only a recurring weekly (day-of-week) schedule.
- Timezone configuration — the app continues to use the server's local timezone, same as every prior phase.
- Hard-deleting staff accounts — deactivation only, always reversible by the Owner.
- Any changes to Super Admin's existing ability to add staff (`addStaffMemberAction` in `src/app/(admin)/admin/restaurants/actions.ts`) — it continues to work exactly as it does today, alongside the new Owner-facing path.
- Per-party-size or per-table reservation-duration overrides — a single restaurant-wide default, still editable per-booking as it already is today.
- True occupied-hours table utilization in Reports — this phase makes business hours real, but Reports' "reservations per table" proxy (from Phase 7) is not revisited here; that would be a Reports change, not a Settings one.
