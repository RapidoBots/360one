# Phase 6: GHL Reservation Sync — Design Spec

Date: 2026-07-14
Status: Approved
Scope: Sixth of 8 phases for the Restaurant Reservation SaaS platform. Revises the original "Phase 6: Notifications (Resend/Twilio)" plan referenced in every earlier phase spec — the actual business plan is to give each onboarded restaurant its own GoHighLevel (GHL) sub-account for marketing/automation, so this phase's job is syncing reservation guests into that sub-account rather than sending email/SMS directly ourselves.

## Context

Full platform phase order (see Phase 1 spec): 1) Foundation (done) → 2) Super Admin (done) → 3) Reservations core (done) → 4) Floor Manager + Smart Allocation (done) → *Embeddable widget (done, pulled forward)* → 5) Waitlist (done) → **6) GHL Reservation Sync (this spec, revised from "Notifications")** → 7) Reports → 8) Settings.

The business plan: every restaurant onboarded onto 360One also gets its own GoHighLevel sub-account (set up by Super Admin, outside this app) for SMS/email marketing and automation. When a guest makes a reservation on any restaurant's calendar — through internal booking, Floor Manager's walk-in seating, the Waitlist, or the embeddable widget — that guest should be pushed into the restaurant's own GHL sub-account as a Contact. From there, the restaurant's own GHL automation (already configured via a snapshot template, outside this app's scope) sends the actual SMS/email confirmation, and staff can message or call the guest directly from GHL's unified inbox. This app never sends email or SMS itself — GHL owns that entirely.

## 1. Data Model

Two new nullable fields on the existing `Restaurant` model — no new model:

```prisma
model Restaurant {
  // ...existing fields...
  ghlLocationId String?
  ghlApiKey     String?
}
```

Both are nullable because most restaurants won't have GHL connected immediately — the sync simply does nothing until Super Admin fills these in for that restaurant. Stored as plain string columns; no encryption at rest this phase (no encryption infrastructure exists elsewhere in this app yet, and this is an acceptable starting point — revisit if it becomes a real compliance concern).

## 2. Credential Entry (Super Admin only)

A new "GoHighLevel" section is added to the existing Restaurant Detail page (`/admin/restaurants/[id]`, from Phase 2), alongside the existing restaurant-details edit form: two fields, Location ID and API Key, with a Save button. A new Server Action, `updateGhlCredentialsAction(restaurantId, { ghlLocationId, ghlApiKey })`, guarded by the existing `assertSuperAdmin()` from Phase 2. Restaurant Owners and Staff never see or edit this — it's Super Admin-only, since Super Admin is the one who sets up each restaurant's GHL sub-account in the first place.

## 3. Sync Helper

A new module, `src/lib/ghl-sync.ts`:

```ts
export type GhlCredentials = { ghlLocationId: string | null; ghlApiKey: string | null };
export type GhlGuest = { name: string; email: string | null; phone: string | null };

export function buildGhlContactPayload(guest: GhlGuest): Record<string, unknown> {
  return { name: guest.name, email: guest.email || undefined, phone: guest.phone || undefined };
}

export async function syncContactToGhl(credentials: GhlCredentials, guest: GhlGuest): Promise<void> {
  if (!credentials.ghlLocationId || !credentials.ghlApiKey) return; // restaurant hasn't connected GHL yet
  try {
    await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.ghlApiKey}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locationId: credentials.ghlLocationId, ...buildGhlContactPayload(guest) }),
    });
  } catch (error) {
    console.error("GHL contact sync failed", error); // never breaks the booking
  }
}
```

`buildGhlContactPayload` is pure and fully unit-tested. `syncContactToGhl` is a thin, deliberately-never-throwing wrapper around the actual network call — a GHL outage, invalid credentials, or any other failure must never fail a reservation. It pushes only name/email/phone as a bare Contact — no reservation date/time/party size as custom fields this phase, per the decision to keep the payload minimal.

## 4. Wiring

`syncContactToGhl` is called, fire-and-forget (awaited, but its own errors are already swallowed internally), from every place a reservation is *created* — not on edits:

- `createReservationAction` (`src/app/(dashboard)/r/[slug]/reservations/actions.ts`, Phase 3) — internal booking modal.
- `quickSeatWalkInAction` (`src/app/(dashboard)/r/[slug]/floor-manager/actions.ts`, Phase 4) — Floor Manager walk-in seating.
- `seatFromWaitlistAction` (`src/app/(dashboard)/r/[slug]/waitlist/actions.ts`, Phase 5) — seating from the Waitlist.
- `createWidgetReservationAction` (`src/app/(public)/book/[slug]/actions.ts`, embeddable widget) — public bookings, regardless of the `PENDING` status they start at.

Every reservation syncs regardless of status (`PENDING`, `CONFIRMED`, or `SEATED`), per the decision to keep this to one sync point per creation path rather than adding a second sync when a `PENDING` reservation later becomes `CONFIRMED`. Each of these four actions already has the restaurant record loaded via its existing guard (`assertRestaurantMember`), so `ghlLocationId`/`ghlApiKey` are already available with no extra query needed.

## 5. Testing & Definition of Done

- **Unit tests (Vitest):** `buildGhlContactPayload()` — keeps the name, converts an empty email or phone string to `undefined` rather than sending an empty string. `syncContactToGhl()` — never calls `fetch` when either credential is missing (mocking `global.fetch` to assert it wasn't invoked); does not throw when the underlying fetch call rejects, confirming the swallow-errors guarantee.
- **E2e (Playwright):** Super Admin enters a Location ID and API Key on a Restaurant Detail page and confirms they persist after a reload. Separately, confirm that booking a reservation for a restaurant with *no* GHL credentials configured still succeeds normally end-to-end — this is the realistic, testable guarantee available without hitting the real GHL API in e2e, and it proves the integration never blocks the core booking flow it's layered onto.

**Definition of Done:** Super Admin can connect a restaurant's GHL sub-account by entering its Location ID and API Key on that restaurant's detail page. From then on, every new reservation on that restaurant — regardless of which of the four booking paths created it, and regardless of its status — pushes the guest into that GHL sub-account as a Contact, ready for the restaurant's own GHL automation to message and for staff to follow up from GHL's inbox. Restaurants without GHL connected continue to work exactly as before, entirely unaffected.

## Explicitly Out of Scope

- Programmatically creating or provisioning the GHL sub-account itself (GHL's Agency API, snapshot deployment, SaaS Mode billing) — Super Admin sets the sub-account up directly in GHL and just connects the resulting credentials here.
- Sending any email or SMS from this app directly — that responsibility moves entirely to GHL's own automation; Resend/Twilio are no longer part of this platform's plan.
- Pushing reservation date, time, or party size as GHL custom fields — bare Contact (name/email/phone) only.
- Encrypting the stored GHL API key at rest.
- Any UI for restaurant Owners or Staff to view or manage GHL credentials — Super Admin only.
- Syncing on reservation *updates* (e.g., a status change from `PENDING` to `CONFIRMED`) — only on creation.
- Real GHL API calls in automated tests — verified via unit tests on the pure/no-op logic and an e2e check that the integration doesn't block bookings when unconfigured.
