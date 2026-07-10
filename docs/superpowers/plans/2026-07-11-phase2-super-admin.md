# Phase 2: Super Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin/restaurants` from a stub page into the core Super Admin onboarding loop — create a restaurant with its Owner account, search/list restaurants, edit a restaurant's name/slug, suspend/reactivate (with immediate effect, reusing Phase 1's existing tenant-access checks), and add Staff/Owner accounts to an existing restaurant.

**Architecture:** No schema changes — `Restaurant`/`User` already carry everything this phase needs (Phase 1). New Server Actions wrap Prisma writes plus `auth.api.signUpEmail` for account creation (same pattern as `prisma/seed.ts`). A new `assertSuperAdmin()` guard (mirroring Phase 3's `assertRestaurantMember`) protects every action. UI follows the same Dialog/Server-Component-page/Client-Component-orchestrator pattern established in Phase 3.

**Tech Stack:** Next.js 15 Server Components + Server Actions, Prisma 7, Better Auth, shadcn/ui (Dialog, Table, Badge, Select — all already installed from Phase 3), Vitest, Playwright.

## Global Constraints

- No subscriptions/billing, no impersonation, no global SMS/email provider config, no cross-restaurant reservation view, no platform health monitoring — all explicitly out of scope this phase (see spec).
- No self-service sign-up — Owner/Staff accounts are only ever created by Super Admin (Phase 1 rule, unchanged).
- No individual staff removal/deactivation this phase — only adding accounts (Phase 8 owns deeper team management).
- No restaurant deletion — only suspend/reactivate exist.
- Every task must leave `pnpm dev` (or `pnpm build && pnpm start`) in a runnable state.
- `ponytail:` Every modal's trigger button and its own submit button must use visibly different text (e.g. "Create restaurant" trigger vs. "Create" submit) — Phase 3 hit repeated Playwright ambiguity bugs from reusing the same label text for a trigger and the dialog it opens, since the background page stays in the DOM behind an open dialog.

---

## File Structure

```
src/lib/
  slugify.ts                                    # pure: slugify(name): string
  auth-guards.ts                                # modify: add assertSuperAdmin()

src/app/(admin)/admin/restaurants/
  actions.ts                                    # "use server" — createRestaurantAction, updateRestaurantAction, setRestaurantStatusAction, addStaffMemberAction
  page.tsx                                      # replaces stub — list + search
  restaurants-list.tsx                          # Client Component — table + search + create-modal orchestration
  create-restaurant-modal.tsx                   # Dialog — name/slug/owner email/password
  restaurant-status-badge.tsx                   # shared ACTIVE/SUSPENDED badge
  [id]/
    page.tsx                                    # detail page — fetch restaurant + users
    restaurant-detail.tsx                       # Client Component — edit form, suspend button, staff list
    add-staff-dialog.tsx                        # Dialog — name/email/password/role

tests/
  slugify.test.ts

e2e/
  phase2-super-admin.spec.ts
```

---

### Task 1: Pure `slugify` helper (TDD)

**Files:**
- Create: `src/lib/slugify.ts`
- Test: `tests/slugify.test.ts`

**Interfaces:**
- Produces: `slugify(name: string): string` — consumed by Task 5 (create-restaurant-modal.tsx).

- [ ] **Step 1: Write the failing tests**

`tests/slugify.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("The Blue Fork")).toBe("the-blue-fork");
  });

  it("collapses repeated symbols/spaces into one hyphen", () => {
    expect(slugify("Joe's  Diner!!")).toBe("joe-s-diner");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Cafe-  ")).toBe("cafe");
  });

  it("returns an empty string for an all-symbol input", () => {
    expect(slugify("!!!")).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/slugify'`.

- [ ] **Step 3: Implement**

`src/lib/slugify.ts`:

```typescript
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — all 4 new tests green (plus all existing tests still passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slugify.ts tests/slugify.test.ts
git commit -m "feat: add pure slugify helper with tests"
```

---

### Task 2: `assertSuperAdmin()` guard

**Files:**
- Modify: `src/lib/auth-guards.ts`

**Interfaces:**
- Consumes: `getSessionUser` (already exported, Phase 1/3).
- Produces: `assertSuperAdmin(): Promise<SessionUser>` — consumed by Task 3's actions.

- [ ] **Step 1: Add the guard**

Append to `src/lib/auth-guards.ts`:

```typescript
// For Server Actions: throws a plain Error instead of calling redirect(),
// for the same reason assertRestaurantMember does (Server Actions don't
// reliably support Next's redirect()/notFound()).
export async function assertSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "SUPER_ADMIN") throw new Error("Not authorized");
  return user;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-guards.ts
git commit -m "feat: add assertSuperAdmin guard for Server Actions"
```

---

### Task 3: Server Actions — create/update restaurant, suspend/reactivate, add staff

**Files:**
- Create: `src/app/(admin)/admin/restaurants/actions.ts`

**Interfaces:**
- Consumes: `assertSuperAdmin` (Task 2), `prisma`, `auth`.
- Produces: `AdminActionResult = { ok: true } | { ok: false; error: string }`, `createRestaurantAction(input): Promise<AdminActionResult>`, `updateRestaurantAction(restaurantId, input): Promise<AdminActionResult>`, `setRestaurantStatusAction(restaurantId, status): Promise<AdminActionResult>`, `addStaffMemberAction(restaurantId, input): Promise<AdminActionResult>` — all consumed by Tasks 5, 6, 7, 8.

- [ ] **Step 1: Implement**

`src/app/(admin)/admin/restaurants/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { assertSuperAdmin } from "@/lib/auth-guards";
import { Prisma, type Role, type RestaurantStatus } from "@/generated/prisma/client";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

async function createUserAccount(input: { name: string; email: string; password: string }) {
  const { user } = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  return user;
}

export async function createRestaurantAction(input: {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
}): Promise<AdminActionResult> {
  await assertSuperAdmin();

  let restaurant;
  try {
    restaurant = await prisma.restaurant.create({ data: { name: input.name, slug: input.slug } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `A restaurant with slug "${input.slug}" already exists.` };
    }
    throw e;
  }

  let owner;
  try {
    owner = await createUserAccount({ name: `${input.name} Owner`, email: input.ownerEmail, password: input.ownerPassword });
  } catch {
    // Roll back the restaurant so we don't leave an orphaned restaurant
    // with no way to log in if the owner account couldn't be created
    // (e.g. duplicate email).
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
    return { ok: false, error: `Could not create an account for "${input.ownerEmail}" — it may already be in use.` };
  }

  await prisma.user.update({ where: { id: owner.id }, data: { role: "OWNER", restaurantId: restaurant.id } });

  revalidatePath("/admin/restaurants");
  return { ok: true };
}

export async function updateRestaurantAction(
  restaurantId: string,
  input: { name: string; slug: string }
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  try {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: { name: input.name, slug: input.slug } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `A restaurant with slug "${input.slug}" already exists.` };
    }
    throw e;
  }
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function setRestaurantStatusAction(
  restaurantId: string,
  status: RestaurantStatus
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { status } });
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}

export async function addStaffMemberAction(
  restaurantId: string,
  input: { name: string; email: string; password: string; role: Role }
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  let user;
  try {
    user = await createUserAccount({ name: input.name, email: input.email, password: input.password });
  } catch {
    return { ok: false, error: `Could not create an account for "${input.email}" — it may already be in use.` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: input.role, restaurantId } });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors. (Behavioral verification happens once the UI exists in Tasks 5-8 and Task 9's e2e test — same reasoning as Phase 3's actions.ts: calling these directly from a script hits `headers()` requiring a real request context.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/restaurants/actions.ts"
git commit -m "feat: add restaurant onboarding/suspend/staff Server Actions"
```

---

### Task 4: Restaurant status badge

**Files:**
- Create: `src/app/(admin)/admin/restaurants/restaurant-status-badge.tsx`

**Interfaces:**
- Produces: `<RestaurantStatusBadge status={RestaurantStatus} />` — consumed by Tasks 6 and 7.

- [ ] **Step 1: Implement**

`src/app/(admin)/admin/restaurants/restaurant-status-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import type { RestaurantStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<RestaurantStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600",
  SUSPENDED: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<RestaurantStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};

export function RestaurantStatusBadge({ status }: { status: RestaurantStatus }) {
  return (
    <Badge className={cn("font-medium", STATUS_STYLES[status])} variant="outline">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/restaurants/restaurant-status-badge.tsx"
git commit -m "feat: add restaurant status badge"
```

---

### Task 5: Create Restaurant Modal

**Files:**
- Create: `src/app/(admin)/admin/restaurants/create-restaurant-modal.tsx`

**Interfaces:**
- Consumes: `createRestaurantAction` (Task 3), `slugify` (Task 1).
- Produces: `<CreateRestaurantModal open, onOpenChange, onCreated />` — consumed by Task 6.

- [ ] **Step 1: Implement**

`src/app/(admin)/admin/restaurants/create-restaurant-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRestaurantAction } from "./actions";
import { slugify } from "@/lib/slugify";

export function CreateRestaurantModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setOwnerEmail("");
    setOwnerPassword("");
    setError(null);
  }, [open]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createRestaurantAction({ name, slug, ownerEmail, ownerPassword });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create restaurant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Restaurant details</h3>
            <div className="space-y-2">
              <Label htmlFor="restaurantName">Name</Label>
              <Input id="restaurantName" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurantSlug">Slug</Label>
              <Input
                id="restaurantSlug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                required
              />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Owner account</h3>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email</Label>
              <Input id="ownerEmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerPassword">Password</Label>
              <Input
                id="ownerPassword"
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          {/* Distinct from the toolbar's "Create restaurant" trigger button
              (see Global Constraints) so Playwright/getByRole doesn't match
              both while the dialog is open. */}
          <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/restaurants/create-restaurant-modal.tsx"
git commit -m "feat: add create-restaurant modal"
```

---

### Task 6: Restaurants List page (replaces stub)

**Files:**
- Create: `src/app/(admin)/admin/restaurants/restaurants-list.tsx`
- Modify: `src/app/(admin)/admin/restaurants/page.tsx` (replaces the Phase 1 stub)

**Interfaces:**
- Consumes: `RestaurantStatusBadge` (Task 4), `CreateRestaurantModal` (Task 5), `prisma`.
- Produces: the real `/admin/restaurants` page — consumed by Task 9 (e2e).

- [ ] **Step 1: Client list + search + create-modal orchestration**

`src/app/(admin)/admin/restaurants/restaurants-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RestaurantStatusBadge } from "./restaurant-status-badge";
import { CreateRestaurantModal } from "./create-restaurant-modal";
import type { RestaurantStatus } from "@/generated/prisma/client";

export type RestaurantListItem = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  createdAt: Date;
  userCount: number;
};

export function RestaurantsList({ restaurants }: { restaurants: RestaurantListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);

  function handleSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search by name or slug"
          defaultValue={searchParams.get("q") ?? ""}
          className="h-11 w-64 text-base"
          onChange={(e) => handleSearch(e.target.value)}
        />
        <Button className="h-11 px-5 text-base" onClick={() => setModalOpen(true)}>
          Create restaurant
        </Button>
      </div>

      {restaurants.length === 0 ? (
        <p className="py-16 text-center text-base text-muted-foreground">No restaurants yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurants.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/admin/restaurants/${r.id}`)}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.slug}</TableCell>
                <TableCell>
                  <RestaurantStatusBadge status={r.status} />
                </TableCell>
                <TableCell>{r.userCount}</TableCell>
                <TableCell>{r.createdAt.toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateRestaurantModal open={modalOpen} onOpenChange={setModalOpen} onCreated={() => router.refresh()} />
    </div>
  );
}
```

- [ ] **Step 2: Page (replaces the Phase 1 stub)**

`src/app/(admin)/admin/restaurants/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { RestaurantsList, type RestaurantListItem } from "./restaurants-list";

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;

  const restaurants = await prisma.restaurant.findMany({
    where: sp.q
      ? {
          OR: [
            { name: { contains: sp.q, mode: "insensitive" } },
            { slug: { contains: sp.q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: "desc" },
  });

  const items: RestaurantListItem[] = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    createdAt: r.createdAt,
    userCount: r._count.users,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Restaurants</h1>
      <RestaurantsList restaurants={items} />
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Log in as `admin@example.com`, visit `/admin/restaurants`, confirm the seeded `blue-fork` restaurant is listed. Use "Create restaurant" to add one; confirm it appears in the list and the search box filters correctly.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/restaurants/restaurants-list.tsx" "src/app/(admin)/admin/restaurants/page.tsx"
git commit -m "feat: wire restaurants list page with search and create modal"
```

---

### Task 7: Restaurant Detail page — edit form + suspend/reactivate

**Files:**
- Create: `src/app/(admin)/admin/restaurants/[id]/page.tsx`, `src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx`

**Interfaces:**
- Consumes: `updateRestaurantAction`, `setRestaurantStatusAction` (Task 3), `RestaurantStatusBadge` (Task 4).
- Produces: `RestaurantWithUsers` type, `<RestaurantDetail restaurant={RestaurantWithUsers} />` — consumed by Task 8 (adds the staff list + Add Staff dialog to this same component).

- [ ] **Step 1: Detail page**

`src/app/(admin)/admin/restaurants/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RestaurantDetail } from "./restaurant-detail";

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true },
        orderBy: { role: "asc" },
      },
    },
  });
  if (!restaurant) notFound();

  return <RestaurantDetail restaurant={restaurant} />;
}
```

- [ ] **Step 2: Detail client component (edit form + suspend button; staff list added in Task 8)**

`src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RestaurantStatusBadge } from "../restaurant-status-badge";
import { updateRestaurantAction, setRestaurantStatusAction } from "../actions";
import type { Role, RestaurantStatus } from "@/generated/prisma/client";

export type RestaurantWithUsers = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  users: { id: string; name: string; email: string; role: Role }[];
};

export function RestaurantDetail({ restaurant }: { restaurant: RestaurantWithUsers }) {
  const router = useRouter();
  const [name, setName] = useState(restaurant.name);
  const [slug, setSlug] = useState(restaurant.slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateRestaurantAction(restaurant.id, { name, slug });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleToggleStatus() {
    setTogglingStatus(true);
    const nextStatus: RestaurantStatus = restaurant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await setRestaurantStatusAction(restaurant.id, nextStatus);
    setTogglingStatus(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
          <RestaurantStatusBadge status={restaurant.status} />
        </div>
        <Button variant="outline" className="h-11 px-5 text-base" onClick={handleToggleStatus} disabled={togglingStatus}>
          {restaurant.status === "ACTIVE" ? "Suspend" : "Reactivate"}
        </Button>
      </div>

      <form onSubmit={handleSave} className="max-w-md space-y-3 rounded-[5px] border border-border p-5">
        <h2 className="text-base font-semibold">Restaurant details</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>
        {error && <p className="text-base text-destructive">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

From `/admin/restaurants`, click into a restaurant. Confirm name/status show correctly, editing name+Save updates it, and clicking Suspend/Reactivate toggles the badge and button label.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/restaurants/[id]/page.tsx" "src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx"
git commit -m "feat: add restaurant detail page with edit form and suspend/reactivate"
```

---

### Task 8: Add Staff Dialog + staff list

**Files:**
- Create: `src/app/(admin)/admin/restaurants/[id]/add-staff-dialog.tsx`
- Modify: `src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx`

**Interfaces:**
- Consumes: `addStaffMemberAction` (Task 3).
- Produces: `<AddStaffDialog open, onOpenChange, restaurantId, onAdded />` — this is the final piece of the detail page; nothing later in this plan consumes it directly, but Task 9 (e2e) exercises it.

- [ ] **Step 1: Add Staff dialog**

`src/app/(admin)/admin/restaurants/[id]/add-staff-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addStaffMemberAction } from "../actions";
import type { Role } from "@/generated/prisma/client";

const ROLE_OPTIONS: Role[] = ["OWNER", "STAFF"];

export function AddStaffDialog({
  open,
  onOpenChange,
  restaurantId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await addStaffMemberAction(restaurantId, { name, email, password, role });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Labeled "Staff name" (not just "Name") -- the restaurant
              detail page behind this dialog already has its own "Name"
              field in the edit form, still present in the DOM while this
              dialog is open. See Global Constraints. */}
          <div className="space-y-2">
            <Label htmlFor="staffName">Staff name</Label>
            <Input id="staffName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffEmail">Email</Label>
            <Input id="staffEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffPassword">Password</Label>
            <Input
              id="staffPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staffRole">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="staffRole">
                <SelectValue>{(value: string) => value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-base text-destructive">{error}</p>}
          {/* Distinct from the "Add staff member" trigger button below —
              see Global Constraints. */}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Adding..." : "Add staff"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire the staff list + dialog into the detail page**

In `src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx`, add these imports:

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddStaffDialog } from "./add-staff-dialog";
```

Add state, alongside the existing `useState` calls:

```typescript
  const [addStaffOpen, setAddStaffOpen] = useState(false);
```

Replace the component's final `return (...)` closing `</div>` (right after the edit form's closing `</form>`) so the staff list and dialog render after it:

```tsx
      <div className="rounded-[5px] border border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold">Staff</h2>
          <Button className="h-9" onClick={() => setAddStaffOpen(true)}>
            Add staff member
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurant.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{u.role}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddStaffDialog
        open={addStaffOpen}
        onOpenChange={setAddStaffOpen}
        restaurantId={restaurant.id}
        onAdded={() => router.refresh()}
      />
    </div>
  );
}
```

(The final `</div>` + `);` + `}` here replace the previous closing of the component — the staff list block and dialog are now siblings of the edit `<form>`, all inside the outer `<div className="space-y-6">`.)

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

From a restaurant's detail page, click "Add staff member", fill in a new Staff account, submit, and confirm it appears in the staff table. Sign out and sign in as that new account, confirm it lands on that restaurant's dashboard.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/restaurants/[id]/add-staff-dialog.tsx" "src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx"
git commit -m "feat: add staff list and add-staff dialog to restaurant detail page"
```

---

### Task 9: Playwright e2e — Phase 2 Definition of Done

**Files:**
- Create: `e2e/phase2-super-admin.spec.ts`

**Interfaces:**
- Consumes: the running production build (`pnpm build && pnpm start`, per Phase 1's `playwright.config.ts`) and the seeded `admin@example.com` Super Admin account.

- [ ] **Step 1: Write the test**

`e2e/phase2-super-admin.spec.ts`:

```typescript
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_SLUGS = ["e2e-admin-restaurant"];
const FIXTURE_EMAILS = ["owner-e2e@example.com", "staff-e2e@example.com"];

// Self-cleaning, same reasoning as phase3-reservations.spec.ts: fixed
// slugs/emails aren't naturally idempotent across repeated runs.
async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "user" WHERE email = ANY($1)`, [FIXTURE_EMAILS]);
    await client.query(`DELETE FROM restaurant WHERE slug = ANY($1)`, [FIXTURE_SLUGS]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 2 Super Admin", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("create, search, edit, suspend/reactivate a restaurant, and add a staff member", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/restaurants");
    await page.getByRole("button", { name: "Create restaurant" }).click();
    await page.getByLabel("Name").fill("E2E Admin Restaurant");
    await page.getByLabel("Slug").fill("e2e-admin-restaurant");
    await page.getByLabel("Email").fill("owner-e2e@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("E2E Admin Restaurant")).toBeVisible();

    await page.getByPlaceholder("Search by name or slug").fill("E2E Admin");
    await expect(page.getByText("E2E Admin Restaurant")).toBeVisible();

    await page.getByText("E2E Admin Restaurant").click();
    await expect(page).toHaveURL(/\/admin\/restaurants\//);

    await page.getByLabel("Name").fill("E2E Admin Restaurant Renamed");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "E2E Admin Restaurant Renamed" })).toBeVisible();

    await page.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();

    // Confirm the owner is now blocked -- reuses Phase 1's existing
    // suspended-restaurant access check, not new logic.
    const ownerPage = await page.context().newPage();
    await ownerPage.goto("/sign-in");
    await ownerPage.getByLabel("Email").fill("owner-e2e@example.com");
    await ownerPage.getByLabel("Password").fill("password1234");
    await ownerPage.getByRole("button", { name: "Sign in" }).click();
    await ownerPage.goto("/r/e2e-admin-restaurant/dashboard");
    await expect(ownerPage).not.toHaveURL(/\/r\/e2e-admin-restaurant\/dashboard/);
    await ownerPage.close();

    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByRole("button", { name: "Suspend" })).toBeVisible();

    await page.getByRole("button", { name: "Add staff member" }).click();
    await page.getByLabel("Staff name").fill("E2E Staff");
    await page.getByLabel("Email").fill("staff-e2e@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("staff-e2e@example.com")).toBeVisible();

    const staffPage = await page.context().newPage();
    await staffPage.goto("/sign-in");
    await staffPage.getByLabel("Email").fill("staff-e2e@example.com");
    await staffPage.getByLabel("Password").fill("password1234");
    await staffPage.getByRole("button", { name: "Sign in" }).click();
    await expect(staffPage).toHaveURL(/\/r\/e2e-admin-restaurant\/dashboard/);
    await staffPage.close();
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:e2e
```

Expected: PASS. Run it a second time immediately after (no manual cleanup in between) to confirm the `beforeAll`/`afterAll` hooks make it idempotent, same check as Phase 3.

- [ ] **Step 3: Commit**

```bash
git add e2e/phase2-super-admin.spec.ts
git commit -m "test: add Playwright coverage for Phase 2 definition of done"
```
