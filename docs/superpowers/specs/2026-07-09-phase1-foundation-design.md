# Phase 1: Foundation — Design Spec

Date: 2026-07-09
Status: Approved
Scope: First of 8 phases for the Restaurant Reservation SaaS platform (widget deferred to v2). This phase establishes the project skeleton, multi-tenant data model, auth/roles, and app shell that every later phase builds on.

## Context

Building a multi-tenant Restaurant Reservation SaaS platform. Only a Super Admin onboards restaurants; each restaurant gets its own dashboard (reservations, waitlist, floor plans, customers, reports, notifications, settings). Full platform scope is decomposed into sequential phases, each independently testable on localhost before the next begins:

1. **Foundation** (this spec)
2. Super Admin (onboarding, suspend, subscriptions, impersonation)
3. Reservations core (CRUD, calendar, modal, customers)
4. Floor Manager + Smart Allocation engine
5. Waitlist
6. Notifications (Resend/Twilio)
7. Reports
8. Settings

Embeddable booking widget is v2 — out of scope until the above phases ship.

## 1. Architecture & Project Setup

- Single Next.js 15 (App Router) + React 19 + TypeScript app, pnpm-managed. No monorepo split — one package until there's a concrete reason to split.
- Route groups:
  - `(marketing)` — minimal public landing page.
  - `(auth)` — sign-in.
  - `(admin)` — Super Admin, under `/admin/...`.
  - `(dashboard)` — restaurant staff, under `/r/[restaurantSlug]/...` (path-based tenancy).
- Middleware responsibilities: session check, role-based redirect (Super Admin → `/admin`, Owner/Staff → `/r/[slug]/dashboard`), and tenant isolation (a staff user cannot access a different restaurant's `/r/[slug]/...` routes).
- Styling: Tailwind CSS 4 + shadcn/ui, themed immediately — white background, deep black typography, blue `#2563EB` primary accent, neutral gray surfaces, 8px spacing grid, 14–18px border radius, soft shadows. Established now so every later phase inherits the look rather than restyling retroactively.
- Local dev database: Docker Compose running Postgres, `DATABASE_URL` in `.env.local` pointing at it. Moving to Neon later is an env var change only — Prisma treats both as plain Postgres connections, no code change required.

## 2. Data Model (Phase 1 scope only)

```prisma
model Restaurant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  status    RestaurantStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  users     User[]
}

enum RestaurantStatus {
  ACTIVE
  SUSPENDED
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role
  restaurantId String?
  restaurant   Restaurant? @relation(fields: [restaurantId], references: [id])
  createdAt    DateTime @default(now())
}

enum Role {
  SUPER_ADMIN
  OWNER
  STAFF
}
```

- Super Admin: `role = SUPER_ADMIN`, `restaurantId = null`.
- Owner/Staff: scoped to exactly one `restaurantId`.
- `Restaurant.status` is included now (not deferred to Phase 2) because middleware must lock out a suspended restaurant's users immediately — this is an access-control concern, not just a Phase 2 admin-screen concern.
- No `Subscription`, `FloorPlan`, `Table`, `Reservation`, `Customer`, etc. in this phase — those are introduced by the phases that need them.
- Better Auth manages its own session/account tables alongside this schema.

## 3. Auth & Roles

- Better Auth, email + password provider only (no social login — not in spec).
- Session resolves to a Better Auth user, joined to our `User` row for `role` and `restaurantId`.
- Two shared authorization helpers in `lib/auth.ts`, reused by middleware and by every server action/route handler that needs them:
  - `requireSuperAdmin()`
  - `requireRestaurantAccess(slug)`
- No public self-service sign-up route. Only a Super Admin creates restaurants and Owner accounts (per spec: "only Super Admin can onboard restaurant accounts"). Phase 1 accounts come from the seed script; Phase 2 adds the Super Admin onboarding UI as the real creation path.

## 4. App Shell & Navigation

- Shared shell layout: top nav (logo, restaurant name, user menu) + permanent left sidebar + main content area. A right utility panel slot exists in the layout but stays empty until a later phase has real content for it.
- Restaurant sidebar items: Dashboard (real in Phase 1), Reservations / Waitlist / Floor Manager / Customers / Reports / Notifications / Settings (stub "Coming in Phase X" pages, built out in their own phases).
- Super Admin sidebar: Restaurants (stub, real in Phase 2), Subscriptions (stub), Settings (stub) — reuses the same shell component with a different nav set.
- Phase 1 dashboard page is intentionally minimal (welcome header + restaurant name) — no widgets/charts, since those depend on reservation data that doesn't exist until Phase 3.
- Framer Motion scope for this phase: page fade transitions and sidebar hover/active states only. Skeletons, animated counters, and calendar transitions are added in the phases that introduce the content they animate.

## 5. Dev Environment, Tooling & Seed Data

- `docker-compose.yml`: single Postgres service. `pnpm db:up` / `pnpm db:down` wrap `docker compose up/down`.
- `pnpm prisma migrate dev` against local Postgres.
- `prisma/seed.ts` creates: one Super Admin user, one demo restaurant with one Owner and one Staff user — so login works immediately after `pnpm db:seed`.
- `.env.example` committed with placeholder values; `.env.local` gitignored.
- ESLint + TypeScript strict mode enabled from the start.
- Sentry and PostHog are **not** wired into Phase 1. They're production monitoring/analytics tools with nothing meaningful to observe on an empty local app yet; wiring them now means carrying unused config through every phase. Add both in whichever phase first reaches a real deployment.

## 6. Definition of Done

Running `pnpm dev` locally:
- Can log in as Super Admin, Owner, or Staff using seeded accounts.
- Each role is redirected to the correct shell (`/admin` vs `/r/[slug]/dashboard`).
- Styled app shell (top nav, sidebar, content area) renders with working navigation between real/stub pages.
- A Staff user from restaurant A is blocked from accessing restaurant B's routes.
- Logging out redirects to sign-in.

## Explicitly Out of Scope (this phase)

- Restaurant onboarding UI (Phase 2).
- Any reservation/floor/waitlist/reports/notifications functionality (their own phases).
- Subscriptions, impersonation (Phase 2).
- Sentry, PostHog wiring (deferred to first real deployment).
- Embeddable booking widget (v2, all phases).
