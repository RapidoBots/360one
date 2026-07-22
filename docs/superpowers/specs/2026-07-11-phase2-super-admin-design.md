# Phase 2: Super Admin — Design Spec

Date: 2026-07-11
Status: Approved
Scope: Second of 8 phases for the Restaurant Reservation SaaS platform, built after Phase 3 (Reservations Core was pulled forward for client-visible progress; see Phase 3's spec). Covers the core Super Admin onboarding loop only — a deliberately reduced slice of the original Super Admin scope.

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin (this spec) → 3) Reservations core (done) → 4) Floor Manager + Smart Allocation → 5) Waitlist → 6) Notifications → 7) Reports → 8) Settings. Embeddable widget is v2, out of scope everywhere.

The original spec's full Super Admin scope was: onboard restaurants, suspend/reactivate, subscription management, view all reservations across restaurants, impersonation, global SMS/email provider config, and platform health monitoring. This phase deliberately builds only **onboarding + suspend/reactivate + staff account management**. The rest is out of scope here because it depends on integrations that don't exist yet (a payment provider for subscriptions, Resend/Twilio for provider config — Phase 6) or is too vague to spec ("platform health"). Each can become its own later addition once the integration it needs actually exists.

## 1. Data Model — No Changes

`Restaurant` (`status: ACTIVE | SUSPENDED`) and `User` (`role: SUPER_ADMIN | OWNER | STAFF`, `restaurantId`) already exist from Phase 1 with everything this phase needs. Suspending a restaurant already takes effect immediately: `requireRestaurantAccess`/`assertRestaurantMember` (Phase 1/3) already block access once `status !== "ACTIVE"`. This phase is pure UI + Server Actions on top of existing models — no migration.

## 2. Auth Guard & Server Actions

- New `assertSuperAdmin()` in `src/lib/auth-guards.ts` — same pattern as Phase 3's `assertRestaurantMember`: throws a plain `Error` instead of calling `redirect()`/`notFound()`, since Server Actions can't reliably use those (established in Phase 3).
- Actions in `src/app/(admin)/admin/restaurants/actions.ts`, all requiring `assertSuperAdmin()` first:
  - `createRestaurantAction({ name, slug, ownerEmail, ownerPassword })` — creates the `Restaurant`, then creates the Owner account via `auth.api.signUpEmail(...)` (same pattern as `prisma/seed.ts`) followed by a Prisma update setting `role: "OWNER"` and `restaurantId`. Returns a friendly error on duplicate slug (`P2002` catch, same pattern as Phase 3's `createTableAction`) or duplicate email.
  - `updateRestaurantAction(restaurantId, { name, slug })` — edits name/slug; same duplicate-slug handling.
  - `setRestaurantStatusAction(restaurantId, status: "ACTIVE" | "SUSPENDED")` — one action for both suspend and reactivate.
  - `addStaffMemberAction(restaurantId, { name, email, password, role: "OWNER" | "STAFF" })` — same signUpEmail-then-update pattern, for adding any additional account to an existing restaurant.

## 3. Restaurants List Page (`/admin/restaurants`)

- Server Component fetches all restaurants (with a user count) via Prisma, filtered by an optional `?q=` search param matching name or slug (`contains`/`insensitive`, same pattern as Phase 3's guest search).
- Table columns: Name, Slug, Status (colored badge — `ACTIVE`/`SUSPENDED`, same badge pattern as reservation statuses), Staff count, Created date. Clicking a row navigates to the detail page.
- A search box and a "Create restaurant" button that opens the create modal.
- Empty state: "No restaurants yet."

## 4. Create Restaurant Modal

- Single shadcn `Dialog`. Sections: **Restaurant Details** (name, slug — auto-suggested from name as you type via a pure `slugify()` helper, editable) → **Owner Account** (email, password — plain text input, no generate-and-reveal flow).
- Calls `createRestaurantAction` on submit. Success closes the modal and refreshes the list. Failure (duplicate slug/email) shows the inline error the action returns, same pattern as the reservation modal's conflict error.
- No confirmation screen — one form, one submit.

## 5. Restaurant Detail Page (`/admin/restaurants/[id]`)

- Server Component fetches the restaurant plus its users (Owner + Staff); 404s if not found.
- Header: name, slug, status badge, and a Suspend/Reactivate button (calls `setRestaurantStatusAction` with the opposite of the current status — reversible either direction, no separate confirmation dialog).
- Edit form: name + slug, pre-filled, Save button calling `updateRestaurantAction`.
- Staff list: table of this restaurant's Users (name, email, role badge), with an "Add staff member" button opening a dialog (name, email, password, role select) calling `addStaffMemberAction`.
- No remove/deactivate-individual-staff-member action in this phase — deeper team management is Phase 8's "Team members" settings; this phase only needs Super Admin to *add* accounts.

## 6. Testing & Definition of Done

- **Unit tests (Vitest):** a pure `slugify(name): string` helper (lowercase, spaces→hyphens, strip non-alphanumerics), same pattern as Phase 3's pure-logic modules.
- **E2e (Playwright):** logged in as Super Admin — create a restaurant with an Owner account → appears in the list → search finds it by name → click into detail → edit name → suspend it → confirm a Staff login attempt for that restaurant is now blocked (reusing Phase 1's existing tenant-isolation behavior) → reactivate it → confirm access restored → add a Staff member → confirm that new Staff account can sign in and reach their restaurant's dashboard.

**Definition of Done:** Logged in as Super Admin on `/admin/restaurants`, you can create a restaurant with its Owner account, search the list, edit a restaurant's name/slug, suspend and reactivate it (with immediate effect on that restaurant's staff access), and add additional Staff/Owner accounts to an existing restaurant.

## Explicitly Out of Scope (this phase)

- Subscription/billing management (no payment provider integrated yet).
- Global SMS/email provider configuration (Resend/Twilio integration is Phase 6).
- Cross-restaurant reservation viewing.
- Impersonating a restaurant account for support.
- Platform health monitoring.
- Removing/deactivating individual staff accounts, or any other team-management beyond adding accounts (Phase 8 Settings).
- Restaurant deletion (only suspend/reactivate exist — deletion is destructive and wasn't asked for).
