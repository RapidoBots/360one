# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Restaurant Reservation SaaS project skeleton — multi-tenant data model, Better Auth login with role/tenant routing, and a styled app shell — so `pnpm dev` lets you log in as Super Admin, Owner, or Staff and land on the correct dashboard.

**Architecture:** Single Next.js 15 App Router project (TypeScript, Tailwind v4, shadcn/ui) backed by a local Dockerized Postgres via Prisma. Better Auth owns its own `User`/`Session`/`Account` tables (extended with `role`/`restaurantId` fields); edge middleware only checks for a session cookie's existence (cheap, no DB), while real role/tenant authorization runs in route-group `layout.tsx` server components (full Node runtime, DB access). This split avoids loading the full DB-backed auth config into edge middleware.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui, Framer Motion, Prisma, Postgres (Docker locally, Neon later), Better Auth, pnpm, Vitest (unit), Playwright (e2e).

## Global Constraints

- Package manager: pnpm for every install/script.
- TypeScript strict mode on; no `any` in new code.
- Visual theme: white background, deep black typography, blue `#2563EB` primary accent, 8px spacing grid, 14–18px border radius, soft shadows, light mode only.
- No self-service sign-up route — accounts are created only via seed script (this phase) or Super Admin onboarding (Phase 2).
- Sentry/PostHog are out of scope for this phase (see spec's "Explicitly Out of Scope").
- Every task must leave `pnpm dev` in a runnable state.

---

## File Structure

```
360One_final/
├── docker-compose.yml
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── middleware.ts
│   ├── lib/
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── auth.ts               # betterAuth server config
│   │   ├── auth-client.ts        # createAuthClient for client components
│   │   ├── auth-routes.ts        # pure routing/access decisions (unit tested)
│   │   └── auth-guards.ts        # server-only: requireSuperAdmin/requireRestaurantAccess
│   ├── components/
│   │   └── shell/
│   │       ├── top-nav.tsx
│   │       ├── sidebar.tsx
│   │       ├── shell-layout.tsx
│   │       ├── page-transition.tsx
│   │       └── nav-config.ts     # nav item arrays for admin vs. restaurant
│   └── app/
│       ├── layout.tsx            # root layout (theme, fonts, PageTransition)
│       ├── page.tsx              # "/" resolves to the right home route
│       ├── globals.css
│       ├── (auth)/
│       │   └── sign-in/page.tsx
│       ├── api/auth/[...all]/route.ts
│       ├── (admin)/
│       │   └── admin/
│       │       ├── layout.tsx    # requireSuperAdmin guard + shell
│       │       ├── page.tsx      # redirects to /admin/restaurants
│       │       ├── restaurants/page.tsx   # stub
│       │       └── settings/page.tsx      # stub
│       └── (dashboard)/
│           └── r/[slug]/
│               ├── layout.tsx    # requireRestaurantAccess guard + shell
│               ├── dashboard/page.tsx     # real, minimal
│               ├── reservations/page.tsx  # stub
│               ├── waitlist/page.tsx      # stub
│               ├── floor-manager/page.tsx # stub
│               ├── customers/page.tsx     # stub
│               ├── reports/page.tsx       # stub
│               ├── notifications/page.tsx # stub
│               └── settings/page.tsx      # stub
├── tests/
│   └── auth-routes.test.ts       # Vitest unit tests
└── e2e/
    └── phase1-smoke.spec.ts      # Playwright end-to-end test
```

---

### Task 1: Scaffold the Next.js project & base tooling

**Files:**
- Create: entire project scaffold via `create-next-app` (package.json, tsconfig.json, next.config.ts, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, .eslintrc/eslint.config.mjs)
- Modify: `tsconfig.json` (enable full strict mode), `package.json` (add scripts)

**Interfaces:**
- Produces: a `pnpm dev` runnable Next.js app at the repo root, path alias `@/*` → `src/*`.

- [ ] **Step 1: Scaffold with create-next-app**

```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir --tailwind --import-alias "@/*" --use-pnpm
```

When prompted, accept defaults (React 19, Next 15 are current stable via `@latest`).

- [ ] **Step 2: Enable full strict mode**

In `tsconfig.json`, ensure the `compilerOptions` block includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: Add workflow scripts to package.json**

Add under `"scripts"`:

```json
{
  "scripts": {
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:seed": "tsx prisma/seed.ts",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 4: Verify dev server runs**

Run: `pnpm dev`
Expected: Server starts on `http://localhost:3000`, default Next.js page loads with no console errors. Stop the server after confirming.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with TypeScript strict mode"
```

---

### Task 2: Local Postgres + Prisma schema & migration

> **Amendment (2026-07-10):** Docker required WSL2 (not installed, needs a restart). Switched to natively-installed PostgreSQL 17 (Windows service already on this machine) — created the `app` role and `reservation_saas` database directly via `psql` (see `scripts/reset-postgres-local.ps1`, a one-time password-reset helper since the postgres superuser password was unknown). Steps 1 and 6 below are superseded; everything else is unchanged since `DATABASE_URL` still just points at `localhost:5432`.

**Files:**
- Create: `.env.example`, `prisma/schema.prisma`, `src/lib/prisma.ts`
- Modify: `.gitignore` (ensure `.env.local` is ignored)

**Interfaces:**
- Produces: `prisma.restaurant`, `prisma.user` (with `role: Role`, `restaurantId: string | null`), `prisma.session`, `prisma.account`, `prisma.verification` — all consumed by Task 3+ (Better Auth) and Task 4/5 (guards).

- [x] **Step 1 (superseded): Local Postgres via native Windows install**

Done via `scripts/reset-postgres-local.ps1` instead of Docker Compose — created role `app` (password `app`) and database `reservation_saas` on the natively-installed PostgreSQL 17 Windows service.

- [ ] **Step 2 (adjusted): Add env files**

`.env.example` (note: a single `.env` is used, not `.env.local` — see Step 3 amendment):

```
DATABASE_URL="postgresql://app:app@localhost:5432/reservation_saas"
BETTER_AUTH_SECRET="replace-with-a-long-random-string"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Copy it to `.env` (gitignored) with the same values, generating a real secret:

```bash
cp .env.example .env
```

Confirm `.gitignore` contains `.env*` with a `!.env.example` exception (both already present from Task 1's scaffold).

- [ ] **Step 3 (adjusted for Prisma 7): Install Prisma and Better Auth's peer deps**

> **Amendment (2026-07-10):** `npx prisma init` (Prisma 7) also generates `prisma.config.ts` (centralizes the datasource URL — the schema's `datasource` block no longer has a `url =` line) and requires `dotenv` since `prisma.config.ts` does `import "dotenv/config"`.

```bash
pnpm add prisma @prisma/client
pnpm add -D tsx dotenv
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and `prisma.config.ts` — replace `schema.prisma`'s contents with the schema below; leave the generated `prisma.config.ts` as-is.

- [ ] **Step 4 (adjusted for Prisma 7): Write the full schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  SUPER_ADMIN
  OWNER
  STAFF
}

enum RestaurantStatus {
  ACTIVE
  SUSPENDED
}

model Restaurant {
  id        String           @id @default(cuid())
  name      String
  slug      String           @unique
  status    RestaurantStatus @default(ACTIVE)
  createdAt DateTime         @default(now())
  users     User[]

  @@map("restaurant")
}

// Better Auth owns id/name/email/emailVerified/image/createdAt/updatedAt.
// role/restaurantId are our domain extensions, exposed via Better Auth's
// user.additionalFields config in src/lib/auth.ts.
model User {
  id            String      @id
  name          String
  email         String      @unique
  emailVerified Boolean
  image         String?
  createdAt     DateTime
  updatedAt     DateTime
  role          Role        @default(STAFF)
  restaurantId  String?
  restaurant    Restaurant? @relation(fields: [restaurantId], references: [id])
  sessions      Session[]
  accounts      Account[]

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime
  updatedAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime
  updatedAt             DateTime

  @@map("account")
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@map("verification")
}
```

- [ ] **Step 5 (adjusted for Prisma 7): Prisma client singleton**

> **Amendment (2026-07-10):** The installed Prisma version (7.8.0) generates the client to `src/generated/prisma` (not `node_modules/@prisma/client`) and requires an explicit driver adapter (`@prisma/adapter-pg`) — the old no-args `new PrismaClient()` no longer type-checks. Also install `pnpm add @prisma/adapter-pg pg` and `pnpm add -D @types/pg`.

`src/lib/prisma.ts`:

```typescript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Note: scripts run via `tsx` outside Next.js's own env loading (the seed script in Task 11, any ad-hoc script) must `import "dotenv/config"` as their first line, or `process.env.DATABASE_URL` will be undefined.

- [ ] **Step 6 (adjusted): Run the migration**

Postgres is already running as a native Windows service (no `pnpm db:up` needed):

```bash
npx prisma migrate dev --name init
```

Expected: Output ends with `Your database is now in sync with your schema.` and a `prisma/migrations/<timestamp>_init/` folder is created.

- [ ] **Step 7: Verify tables exist**

```bash
npx prisma studio
```

Expected: Browser opens showing `restaurant`, `user`, `session`, `account`, `verification` tables, all empty. Close Prisma Studio after confirming.

- [ ] **Step 8: Commit**

```bash
git add .env.example .gitignore prisma prisma.config.ts package.json pnpm-lock.yaml src/lib/prisma.ts
git commit -m "feat: add local Postgres, Prisma schema, and client singleton"
```

---

### Task 3: Better Auth server config, client, and API route

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`
- Modify: `.env.example`, `.env.local` (already has `BETTER_AUTH_SECRET` from Task 2)

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts` (Task 2).
- Produces: `auth` (server, used by Task 5/6 guards), `authClient` (used by Task 3's sign-in page and Task 11's seed script does NOT use this — seed uses `auth.api` directly).

- [ ] **Step 1: Install Better Auth**

```bash
pnpm add better-auth
```

- [ ] **Step 2: Server config with role/restaurantId additional fields**

`src/lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,
      },
      restaurantId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
});
```

- [ ] **Step 3: API route handler**

`src/app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

- [ ] **Step 4: Client instance**

`src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
```

- [ ] **Step 5: Verify the auth API responds**

```bash
pnpm dev
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.com","password":"password1234","name":"Smoke Test"}'
```

Expected: JSON response containing a `user` object with `id`, `email: "smoke-test@example.com"`. Then confirm in `npx prisma studio` that a row appeared in `user` and `account`. Delete that row afterward (it was only a smoke test, not seed data) via Prisma Studio.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth-client.ts src/app/api/auth package.json pnpm-lock.yaml
git commit -m "feat: configure Better Auth with role/restaurant fields"
```

---

### Task 4: Pure routing/access-decision logic (Vitest, TDD)

**Files:**
- Create: `src/lib/auth-routes.ts`, `tests/auth-routes.test.ts`
- Modify: `package.json` (vitest dep + config)

**Interfaces:**
- Produces: `SessionUser` type `{ role: "SUPER_ADMIN" | "OWNER" | "STAFF"; restaurantSlug: string | null }`, `resolveHomeRoute(user: SessionUser): string`, `canAccessRestaurant(user: SessionUser, targetSlug: string): boolean` — both consumed by `src/lib/auth-guards.ts` in Task 5.

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest
```

Add to `package.json` `"scripts"`: `"test": "vitest run"` (already added in Task 1 — confirm it's present).

- [ ] **Step 2: Write the failing tests**

`tests/auth-routes.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { canAccessRestaurant, resolveHomeRoute } from "@/lib/auth-routes";

describe("resolveHomeRoute", () => {
  it("sends Super Admins to /admin", () => {
    expect(resolveHomeRoute({ role: "SUPER_ADMIN", restaurantSlug: null })).toBe("/admin");
  });

  it("sends Owners/Staff to their restaurant dashboard", () => {
    expect(resolveHomeRoute({ role: "OWNER", restaurantSlug: "blue-fork" })).toBe(
      "/r/blue-fork/dashboard"
    );
    expect(resolveHomeRoute({ role: "STAFF", restaurantSlug: "blue-fork" })).toBe(
      "/r/blue-fork/dashboard"
    );
  });

  it("sends a restaurant user with no restaurant back to sign-in", () => {
    expect(resolveHomeRoute({ role: "STAFF", restaurantSlug: null })).toBe("/sign-in");
  });
});

describe("canAccessRestaurant", () => {
  it("lets Super Admin access any restaurant", () => {
    expect(canAccessRestaurant({ role: "SUPER_ADMIN", restaurantSlug: null }, "any-slug")).toBe(true);
  });

  it("lets a restaurant user access only their own restaurant", () => {
    const user = { role: "OWNER" as const, restaurantSlug: "blue-fork" };
    expect(canAccessRestaurant(user, "blue-fork")).toBe(true);
    expect(canAccessRestaurant(user, "other-restaurant")).toBe(false);
  });
});
```

Since `src/lib/auth-routes.ts` doesn't exist yet, this file won't type-check/import.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/auth-routes'` (or similar resolution error).

- [ ] **Step 4: Implement**

`src/lib/auth-routes.ts`:

```typescript
export type SessionUser = {
  role: "SUPER_ADMIN" | "OWNER" | "STAFF";
  restaurantSlug: string | null;
};

export function resolveHomeRoute(user: SessionUser): string {
  if (user.role === "SUPER_ADMIN") return "/admin";
  if (!user.restaurantSlug) return "/sign-in";
  return `/r/${user.restaurantSlug}/dashboard`;
}

export function canAccessRestaurant(user: SessionUser, targetSlug: string): boolean {
  return user.role === "SUPER_ADMIN" || user.restaurantSlug === targetSlug;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth-routes.ts tests/auth-routes.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add pure role/tenant routing decisions with unit tests"
```

---

### Task 5: Server-side auth guards + edge middleware

**Files:**
- Create: `src/lib/auth-guards.ts`, `src/middleware.ts`

**Interfaces:**
- Consumes: `auth` (Task 3), `prisma` (Task 2), `resolveHomeRoute`/`canAccessRestaurant`/`SessionUser` (Task 4).
- Produces: `requireSuperAdmin(): Promise<SessionUser>`, `requireRestaurantAccess(slug: string): Promise<{ user: SessionUser; restaurant: Restaurant }>` — both consumed by Task 7's route-group layouts.

- [ ] **Step 1: Write the guards**

`src/lib/auth-guards.ts`:

```typescript
import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessRestaurant, resolveHomeRoute, type SessionUser } from "@/lib/auth-routes";

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { role, restaurantId } = session.user as typeof session.user & {
    role: SessionUser["role"];
    restaurantId: string | null;
  };

  if (!restaurantId) return { role, restaurantSlug: null };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  });
  return { role, restaurantSlug: restaurant?.slug ?? null };
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "SUPER_ADMIN") redirect(resolveHomeRoute(user));
  return user;
}

export async function requireRestaurantAccess(slug: string) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!canAccessRestaurant(user, slug)) redirect(resolveHomeRoute(user));

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") notFound();

  return { user, restaurant };
}
```

- [ ] **Step 2: Edge middleware — cookie existence only**

`src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/r/:path*"],
};
```

This deliberately does NOT check role or tenant — it only rejects requests with no session cookie at all, keeping the edge bundle small. `requireSuperAdmin`/`requireRestaurantAccess` (used in Task 7 layouts, which run with full Node.js + DB access) do the real authorization.

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Visit `http://localhost:3000/admin` in a browser with no session cookie. Expected: redirected to `/sign-in`. (Role/tenant behavior is verified once Task 7's layouts exist — this step only confirms the cookie gate works.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-guards.ts src/middleware.ts
git commit -m "feat: add role/tenant auth guards and cookie-only edge middleware"
```

---

### Task 6: Tailwind v4 theme + shadcn/ui

**Files:**
- Modify: `src/app/globals.css`
- Create: `components.json` (via shadcn CLI), `src/components/ui/*` (button, input, label, card, dialog, dropdown-menu, sonner — via CLI)

**Interfaces:**
- Produces: themed shadcn primitives under `@/components/ui/*`, consumed by Task 7 (shell) and Task 8 (sign-in page, stub pages).

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Accept defaults for Tailwind v4 (CSS-variables based, "New York" or "Default" style — pick "Default"), base color "Neutral".

- [ ] **Step 2: Override theme tokens for the spec's design system**

In `src/app/globals.css`, inside the `:root` block (light mode only — no `.dark` overrides needed), set:

```css
:root {
  --radius: 1rem; /* 16px, within the 14-18px range */
  --background: oklch(1 0 0); /* white */
  --foreground: oklch(0.145 0 0); /* near-black */
  --primary: oklch(0.55 0.22 260); /* blue, ~#2563EB */
  --primary-foreground: oklch(1 0 0);
}
```

(Exact `oklch` values from shadcn's generated file may already be close — adjust `--primary` until it visually matches `#2563EB`; verify with the browser color picker in Step 4.)

- [ ] **Step 3: Add the primitives this phase needs**

```bash
npx shadcn@latest add button input label card sonner
```

- [ ] **Step 4: Verify visually**

```bash
pnpm dev
```

Temporarily drop `<Button>Test</Button>` into `src/app/page.tsx`, confirm in the browser it renders with the blue `#2563EB` background and 16px-ish rounded corners, then remove the test line.

- [ ] **Step 5: Commit**

```bash
git add components.json src/app/globals.css src/components/ui package.json pnpm-lock.yaml
git commit -m "feat: set up Tailwind v4 theme and shadcn/ui primitives"
```

---

### Task 7: App shell (top nav, sidebar, layouts) + sign-in page

**Files:**
- Create: `src/components/shell/nav-config.ts`, `src/components/shell/top-nav.tsx`, `src/components/shell/sidebar.tsx`, `src/components/shell/shell-layout.tsx`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(admin)/admin/layout.tsx`, `src/app/(dashboard)/r/[slug]/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `requireSuperAdmin`/`requireRestaurantAccess` (Task 5), `authClient` (Task 3), shadcn primitives (Task 6).
- Produces: `<ShellLayout navItems={...} title={...}>` component consumed by both route-group layouts and reused as-is in later phases.

- [ ] **Step 1: Nav config**

`src/components/shell/nav-config.ts`:

```typescript
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  ListOrdered,
  Map,
  BarChart3,
  Bell,
  Settings,
  Building2,
  CreditCard,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export function restaurantNavItems(slug: string): NavItem[] {
  const base = `/r/${slug}`;
  return [
    { label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard },
    { label: "Reservations", href: `${base}/reservations`, icon: CalendarClock },
    { label: "Waitlist", href: `${base}/waitlist`, icon: ListOrdered },
    { label: "Floor Manager", href: `${base}/floor-manager`, icon: Map },
    { label: "Customers", href: `${base}/customers`, icon: Users },
    { label: "Reports", href: `${base}/reports`, icon: BarChart3 },
    { label: "Notifications", href: `${base}/notifications`, icon: Bell },
    { label: "Settings", href: `${base}/settings`, icon: Settings },
  ];
}

export const adminNavItems: NavItem[] = [
  { label: "Restaurants", href: "/admin/restaurants", icon: Building2 },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
```

- [ ] **Step 2: Sidebar**

`src/components/shell/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { NavItem } from "./nav-config";
import { cn } from "@/lib/utils";

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-background p-4">
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Top nav**

`src/components/shell/top-nav.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function TopNav({ title }: { title: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <span className="text-sm font-semibold">{title}</span>
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </header>
  );
}
```

- [ ] **Step 4: Shell layout**

`src/components/shell/shell-layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import type { NavItem } from "./nav-config";

export function ShellLayout({
  title,
  navItems,
  children,
}: {
  title: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <TopNav title={title} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar items={navItems} />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Sign-in page**

`src/app/(auth)/sign-in/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      setError(signInError.message ?? "Sign in failed");
      return;
    }
    router.push("/");
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border p-8 shadow-sm">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Root page resolves home route**

`src/app/page.tsx`:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveHomeRoute, type SessionUser } from "@/lib/auth-routes";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const { role, restaurantId } = session.user as typeof session.user & {
    role: SessionUser["role"];
    restaurantId: string | null;
  };

  let restaurantSlug: string | null = null;
  if (restaurantId) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });
    restaurantSlug = restaurant?.slug ?? null;
  }

  redirect(resolveHomeRoute({ role, restaurantSlug }));
}
```

- [ ] **Step 7: Admin layout (guard + shell)**

`src/app/(admin)/admin/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { ShellLayout } from "@/components/shell/shell-layout";
import { adminNavItems } from "@/components/shell/nav-config";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin();
  return (
    <ShellLayout title="Super Admin" navItems={adminNavItems}>
      {children}
    </ShellLayout>
  );
}
```

- [ ] **Step 8: Restaurant dashboard layout (guard + shell)**

`src/app/(dashboard)/r/[slug]/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { requireRestaurantAccess } from "@/lib/auth-guards";
import { ShellLayout } from "@/components/shell/shell-layout";
import { restaurantNavItems } from "@/components/shell/nav-config";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { restaurant } = await requireRestaurantAccess(slug);
  return (
    <ShellLayout title={restaurant.name} navItems={restaurantNavItems(slug)}>
      {children}
    </ShellLayout>
  );
}
```

- [ ] **Step 9: Verify manually**

```bash
pnpm dev
```

Visit `/sign-in`, confirm the styled form renders. (Full login flow verified once Task 11's seed data exists.)

- [ ] **Step 10: Commit**

```bash
git add src/components/shell src/app/page.tsx src/app/(auth) src/app/(admin) src/app/(dashboard)
git commit -m "feat: add app shell, sign-in page, and role/tenant layout guards"
```

---

### Task 8: Stub pages for remaining nav items

**Files:**
- Create: `src/components/shell/coming-soon.tsx`, and one `page.tsx` each for:
  `(admin)/admin/page.tsx`, `(admin)/admin/restaurants/page.tsx`, `(admin)/admin/subscriptions/page.tsx`, `(admin)/admin/settings/page.tsx`,
  `(dashboard)/r/[slug]/reservations/page.tsx`, `waitlist/page.tsx`, `floor-manager/page.tsx`, `customers/page.tsx`, `reports/page.tsx`, `notifications/page.tsx`, `settings/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks — these are placeholders replaced phase-by-phase.

- [ ] **Step 1: Shared placeholder component**

`src/components/shell/coming-soon.tsx`:

```tsx
export function ComingSoon({ feature, phase }: { feature: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-16 text-center">
      <h2 className="text-lg font-semibold">{feature}</h2>
      <p className="text-sm text-muted-foreground">Coming in {phase}.</p>
    </div>
  );
}
```

- [ ] **Step 2: One stub page per remaining nav item**

`src/app/(dashboard)/r/[slug]/reservations/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function ReservationsPage() {
  return <ComingSoon feature="Reservations" phase="Phase 3" />;
}
```

`src/app/(dashboard)/r/[slug]/waitlist/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function WaitlistPage() {
  return <ComingSoon feature="Waitlist" phase="Phase 5" />;
}
```

`src/app/(dashboard)/r/[slug]/floor-manager/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function FloorManagerPage() {
  return <ComingSoon feature="Floor Manager" phase="Phase 4" />;
}
```

`src/app/(dashboard)/r/[slug]/customers/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function CustomersPage() {
  return <ComingSoon feature="Customers" phase="Phase 3" />;
}
```

`src/app/(dashboard)/r/[slug]/reports/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function ReportsPage() {
  return <ComingSoon feature="Reports" phase="Phase 7" />;
}
```

`src/app/(dashboard)/r/[slug]/notifications/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function NotificationsPage() {
  return <ComingSoon feature="Notifications" phase="Phase 6" />;
}
```

`src/app/(dashboard)/r/[slug]/settings/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function RestaurantSettingsPage() {
  return <ComingSoon feature="Settings" phase="Phase 8" />;
}
```

`src/app/(admin)/admin/page.tsx` (redirect to the first real admin section):

```tsx
import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/restaurants");
}
```

`src/app/(admin)/admin/restaurants/page.tsx`:

```tsx
import { ComingSoon } from "@/components/shell/coming-soon";

export default function AdminRestaurantsPage() {
  return <ComingSoon feature="Restaurants" phase="Phase 2" />;
}
```

`src/app/(admin)/admin/subscriptions/page.tsx` and `src/app/(admin)/admin/settings/page.tsx` follow the same one-liner pattern (`phase="Phase 2"` for both).

- [ ] **Step 3: Verify navigation**

```bash
pnpm dev
```

(Full click-through verified in Task 11 once you can log in — for now, confirm the files compile with no TypeScript errors: `npx tsc --noEmit`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/coming-soon.tsx src/app/(admin) src/app/(dashboard)
git commit -m "feat: add stub pages for phase 2-8 nav items"
```

---

### Task 9: Phase 1 dashboard page (real)

**Files:**
- Create: `src/app/(dashboard)/r/[slug]/dashboard/page.tsx`

**Interfaces:**
- Consumes: `requireRestaurantAccess` result already resolved by the parent layout (Task 7) — this page re-derives the restaurant name via `params` for simplicity rather than threading props through the layout.

- [ ] **Step 1: Implement the minimal dashboard**

`src/app/(dashboard)/r/[slug]/dashboard/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Welcome to {restaurant.name}</h1>
      <p className="text-sm text-muted-foreground">
        Reservation widgets, occupancy, and today's arrivals land here in Phase 3.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors. (Rendered output verified in Task 11's login flow.)

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/r/[slug]/dashboard/page.tsx
git commit -m "feat: add minimal Phase 1 restaurant dashboard page"
```

---

### Task 10: Framer Motion page transitions

**Files:**
- Create: `src/components/shell/page-transition.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `<PageTransition>` wrapping `{children}` in the root layout, so every route gets a fade transition without each page opting in individually.

- [ ] **Step 1: Page transition wrapper**

`src/components/shell/page-transition.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [x] **Step 2 (adjusted): Wire into root layout**

> **Amendment (2026-07-10):** `framer-motion` was already installed during Task 7, since the Sidebar's hover animation needed it before this task ran. No install step needed here.

In `src/app/layout.tsx`, wrap `{children}` with `<PageTransition>{children}</PageTransition>` (import from `@/components/shell/page-transition`).

- [ ] **Step 3: Verify visually**

```bash
pnpm dev
```

Navigate between `/sign-in` and any other reachable route; confirm a soft fade instead of an instant snap. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/page-transition.tsx src/app/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat: add fade page transitions with Framer Motion"
```

---

### Task 11: Seed script (Super Admin, demo restaurant, Owner, Staff)

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `"prisma": { "seed": "tsx prisma/seed.ts" }`)

**Interfaces:**
- Consumes: `auth.api.signUpEmail` (Task 3), `prisma` (Task 2).
- Produces: 3 logged-in-able accounts for manual testing and for Task 12's e2e test.

- [ ] **Step 1: Write the seed script**

`prisma/seed.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function createUser(email: string, password: string, name: string) {
  const { user } = await auth.api.signUpEmail({ body: { email, password, name } });
  return user;
}

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "blue-fork" },
    update: {},
    create: { name: "The Blue Fork", slug: "blue-fork" },
  });

  const superAdmin = await createUser("admin@example.com", "password1234", "Super Admin");
  await prisma.user.update({ where: { id: superAdmin.id }, data: { role: "SUPER_ADMIN" } });

  const owner = await createUser("owner@blue-fork.example.com", "password1234", "Blue Fork Owner");
  await prisma.user.update({
    where: { id: owner.id },
    data: { role: "OWNER", restaurantId: restaurant.id },
  });

  const staff = await createUser("staff@blue-fork.example.com", "password1234", "Blue Fork Staff");
  await prisma.user.update({
    where: { id: staff.id },
    data: { role: "STAFF", restaurantId: restaurant.id },
  });

  console.log("Seeded:", { restaurant: restaurant.slug, superAdmin: superAdmin.email, owner: owner.email, staff: staff.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Register the seed command**

In `package.json`, add a top-level key:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 3: Run it**

```bash
pnpm db:seed
```

Expected: console prints `Seeded: { restaurant: 'blue-fork', superAdmin: 'admin@example.com', owner: 'owner@blue-fork.example.com', staff: 'staff@blue-fork.example.com' }` with no errors. Re-running is safe (restaurant upsert; if a user email already exists, Better Auth's sign-up will error — acceptable for a one-time local seed, reset via `npx prisma migrate reset` if you need to reseed).

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add seed script for demo restaurant and three role accounts"
```

---

### Task 12: Playwright end-to-end smoke test (Definition of Done)

> **Amendments (2026-07-10):** This task's first real run surfaced four issues, now fixed:
> 1. **Real bug in Task 7:** `ShellLayout`/`Sidebar` passed Lucide icon *components* (functions) as props from a Server Component (`layout.tsx`) into a `"use client"` component — React/Next forbids passing non-serializable values across that boundary ("Only plain objects can be passed to Client Components..."). Fixed by having `nav-config.ts` carry an icon *name* string (`NavIconName`) instead of the component, with `Sidebar` resolving name → icon component in its own local `ICONS` map.
> 2. **`webServer.command` changed from `pnpm dev` to `pnpm build && pnpm start`.** Testing against `next dev` produced a real but misleading failure: on-demand route compilation + Fast Refresh raced with client-side navigation immediately after sign-in, aborting the RSC fetch mid-flight. This is a known class of Next.js dev-mode flake; testing against a production build avoids it and is more representative of real behavior anyway.
> 3. **Better Auth's built-in rate limiter** (enabled by default outside dev mode) caps `/sign-in/email` at 3 requests/10s by default — too strict for both real multi-tab use and this test suite signing the same seeded Owner in three times. Loosened (not disabled) via `rateLimit.customRules` in `src/lib/auth.ts` to `{ window: 60, max: 20 }`.
> 4. **The e2e test's "other restaurant" setup** cannot import `@/lib/prisma` or `@/lib/auth` directly — Prisma's generated client (Task 2) is ESM (`import.meta`), which breaks under Playwright's test-runner module loader. Rewritten to use a plain `pg` `Client` for the two SQL statements and a `fetch` call to the already-running app's own sign-up endpoint instead.
>
> Also fixed in passing: `eslint.config.mjs` (generated by Task 1's scaffold at Next 16) referenced `eslint-config-next`'s v16 flat-config export shape; downgrading to v15 (Global Constraints) required rewriting it to the v15-style `FlatCompat` bridge (`@eslint/eslintrc`), plus restoring the `.next/**`/`out/**`/`build/**`/`next-env.d.ts` ignores that got dropped in the rewrite, plus adding `src/generated/**` (never lint generated code).

**Files:**
- Create: `playwright.config.ts`, `e2e/phase1-smoke.spec.ts`

**Interfaces:**
- Consumes: the running app (via `pnpm dev`) and seeded accounts (Task 11), plus a second restaurant/staff created in the test's own setup for the tenant-isolation check.

- [ ] **Step 1: Install Playwright**

```bash
pnpm create playwright --yes
```

When prompted, choose TypeScript, `e2e` as the test directory, and skip adding a GitHub Actions workflow (not needed yet — add when CI exists).

- [ ] **Step 2: Point config at the dev server**

`playwright.config.ts` (adjust the generated file to include):

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 3: Write the smoke test**

`e2e/phase1-smoke.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";

const prisma = new PrismaClient();

test.describe("Phase 1 foundation", () => {
  test("Super Admin logs in and lands on /admin", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("Owner logs in and lands on their restaurant dashboard", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);
    await expect(page.getByRole("heading")).toContainText("The Blue Fork");
  });

  test("sidebar navigation reaches every stub page with no 404s", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    for (const label of ["Reservations", "Waitlist", "Floor Manager", "Customers", "Reports", "Notifications", "Settings"]) {
      await page.getByRole("link", { name: label }).click();
      await expect(page.getByText("Coming in Phase")).toBeVisible();
    }
  });

  test("a staff member from another restaurant cannot access this one", async ({ page }) => {
    const otherRestaurant = await prisma.restaurant.upsert({
      where: { slug: "other-restaurant" },
      update: {},
      create: { name: "Other Restaurant", slug: "other-restaurant" },
    });
    const { user } = await auth.api.signUpEmail({
      body: { email: "staff@other-restaurant.example.com", password: "password1234", name: "Other Staff" },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "STAFF", restaurantId: otherRestaurant.id },
    });

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("staff@other-restaurant.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/r/blue-fork/dashboard");
    await expect(page).not.toHaveURL(/\/r\/blue-fork\/dashboard/);
  });

  test("signing out redirects to sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
```

- [ ] **Step 4: Run it**

Make sure Postgres is up and seeded (`pnpm db:up && pnpm db:seed`), then:

```bash
pnpm test:e2e
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e package.json pnpm-lock.yaml
git commit -m "test: add Playwright smoke test covering Phase 1 definition of done"
```
