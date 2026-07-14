# Phase 6: GHL Reservation Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push every new reservation's guest (name/email/phone) into that restaurant's own GoHighLevel (GHL) sub-account as a Contact via API, so the restaurant's own GHL automation sends the SMS/email confirmation and staff can follow up from GHL's unified inbox.

**Architecture:** Two new nullable credential columns on `Restaurant`; a small pure-plus-network helper module (`src/lib/ghl-sync.ts`) that no-ops when credentials are absent and never throws; a Super-Admin-only credential form on the existing Restaurant Detail page; and a one-line call to the helper added at the end of each of the four existing reservation-creation Server Actions.

**Tech Stack:** Next.js 15 Server Actions, Prisma 7, native `fetch`, Vitest, Playwright.

## Global Constraints

- `Restaurant.ghlLocationId` and `Restaurant.ghlApiKey` are both nullable strings, stored as plain columns — no encryption at rest this phase.
- Credentials are entered only on the Super Admin Restaurant Detail page (`/admin/restaurants/[id]`), guarded by `assertSuperAdmin()`. No Owner/Staff-facing UI.
- The sync payload is exactly `{ name, email, phone }` — no reservation date/time/party-size custom fields.
- Sync fires on reservation **creation only**, for every status (`PENDING`, `CONFIRMED`, `SEATED`) — never on edits.
- `syncContactToGhl` must never throw — a GHL outage or bad credentials must never fail a reservation.
- No real GHL API calls in automated tests (unit tests mock `global.fetch`; e2e only exercises restaurants with no GHL credentials configured).

---

### Task 1: Data model — GHL credential columns

**Files:**
- Modify: `prisma/schema.prisma:24-37` (the `Restaurant` model)

**Interfaces:**
- Produces: `Restaurant.ghlLocationId: string | null`, `Restaurant.ghlApiKey: string | null` — every later task reads these off the `restaurant` record already returned by `assertRestaurantMember()` / `assertSuperAdmin()`'s callers, no new query needed.

- [ ] **Step 1: Add the two fields to the `Restaurant` model**

Edit `prisma/schema.prisma` so the `Restaurant` model reads:

```prisma
model Restaurant {
  id        String           @id @default(cuid())
  name      String
  slug      String           @unique
  status    RestaurantStatus @default(ACTIVE)
  createdAt DateTime         @default(now())
  ghlLocationId String?
  ghlApiKey     String?
  users        User[]
  tables       Table[]
  customers    Customer[]
  reservations Reservation[]
  waitlistEntries WaitlistEntry[]

  @@map("restaurant")
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name ghl_credentials`
Expected: a new folder under `prisma/migrations/` (timestamp prefix + `_ghl_credentials`) containing an `ALTER TABLE "restaurant" ADD COLUMN "ghlLocationId" TEXT, ADD COLUMN "ghlApiKey" TEXT;`-equivalent migration, applied to the local dev database with no errors.

- [ ] **Step 3: Regenerate the Prisma client explicitly**

Run: `npx prisma generate`
(The generated client at `src/generated/prisma` doesn't always auto-regenerate after `migrate dev` in this environment — this clears any stale-type errors before the next step.)

- [ ] **Step 4: Verify the type-check picks up the new fields**

Run: `npx tsc --noEmit`
Expected: no errors (this only confirms the schema/client are in sync — nothing references the new fields yet).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add GHL credential columns to Restaurant"
```

---

### Task 2: GHL sync helper

**Files:**
- Create: `src/lib/ghl-sync.ts`
- Test: `tests/ghl-sync.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure module, only depends on the global `fetch`).
- Produces:
  - `type GhlCredentials = { ghlLocationId: string | null; ghlApiKey: string | null }`
  - `type GhlGuest = { name: string; email: string | null; phone: string | null }`
  - `buildGhlContactPayload(guest: GhlGuest): Record<string, unknown>`
  - `syncContactToGhl(credentials: GhlCredentials, guest: GhlGuest): Promise<void>`
  — Task 3 and Task 4 both import `syncContactToGhl` and `GhlCredentials`/`GhlGuest` from `@/lib/ghl-sync`.

- [ ] **Step 1: Write the failing test**

Create `tests/ghl-sync.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildGhlContactPayload, syncContactToGhl } from "@/lib/ghl-sync";

describe("buildGhlContactPayload", () => {
  it("keeps the guest name", () => {
    const payload = buildGhlContactPayload({ name: "Taylor Guest", email: null, phone: null });
    expect(payload.name).toBe("Taylor Guest");
  });

  it("omits email and phone when null", () => {
    const payload = buildGhlContactPayload({ name: "Taylor Guest", email: null, phone: null });
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBeUndefined();
  });

  it("includes email and phone when present", () => {
    const payload = buildGhlContactPayload({
      name: "Taylor Guest",
      email: "taylor@example.com",
      phone: "555-000-1111",
    });
    expect(payload.email).toBe("taylor@example.com");
    expect(payload.phone).toBe("555-000-1111");
  });
});

describe("syncContactToGhl", () => {
  const guest = { name: "Taylor Guest", email: "taylor@example.com", phone: "555-000-1111" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when ghlLocationId is missing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await syncContactToGhl({ ghlLocationId: null, ghlApiKey: "key" }, guest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when ghlApiKey is missing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: null }, guest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the contact to GHL when both credentials are present", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, guest);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/contacts/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
          Version: "2021-07-28",
        }),
      })
    );
    const [, options] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse(options!.body as string);
    expect(body).toEqual({
      locationId: "loc123",
      name: "Taylor Guest",
      email: "taylor@example.com",
      phone: "555-000-1111",
    });
  });

  it("swallows a fetch failure instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, guest)
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ghl-sync.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ghl-sync'` (or similar resolution error).

- [ ] **Step 3: Implement the helper**

Create `src/lib/ghl-sync.ts`:

```ts
export type GhlCredentials = { ghlLocationId: string | null; ghlApiKey: string | null };
export type GhlGuest = { name: string; email: string | null; phone: string | null };

export function buildGhlContactPayload(guest: GhlGuest): Record<string, unknown> {
  return { name: guest.name, email: guest.email || undefined, phone: guest.phone || undefined };
}

export async function syncContactToGhl(credentials: GhlCredentials, guest: GhlGuest): Promise<void> {
  if (!credentials.ghlLocationId || !credentials.ghlApiKey) return;
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
    console.error("GHL contact sync failed", error);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/ghl-sync.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ghl-sync.ts tests/ghl-sync.test.ts
git commit -m "feat: add GHL contact sync helper"
```

---

### Task 3: Super Admin credential entry

**Files:**
- Modify: `src/app/(admin)/admin/restaurants/actions.ts` (add `updateGhlCredentialsAction`)
- Modify: `src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx` (add the GHL form section)

**Interfaces:**
- Consumes: `assertSuperAdmin()` from `@/lib/auth-guards` (already imported in `actions.ts`); `AdminActionResult` type already defined in `actions.ts`.
- Produces: `updateGhlCredentialsAction(restaurantId: string, input: { ghlLocationId: string | null; ghlApiKey: string | null }): Promise<AdminActionResult>` — not consumed by any other task in this plan, but this is the function name/signature to keep stable for future work.

- [ ] **Step 1: Add the Server Action**

In `src/app/(admin)/admin/restaurants/actions.ts`, add after `setRestaurantStatusAction` (after line 80):

```ts
export async function updateGhlCredentialsAction(
  restaurantId: string,
  input: { ghlLocationId: string | null; ghlApiKey: string | null }
): Promise<AdminActionResult> {
  await assertSuperAdmin();
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { ghlLocationId: input.ghlLocationId, ghlApiKey: input.ghlApiKey },
  });
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Add the two new fields to the page's data fetch and type**

In `src/app/(admin)/admin/restaurants/[id]/page.tsx`, the existing `prisma.restaurant.findUnique` call already returns every scalar column on `Restaurant` (Prisma includes all scalars by default alongside an `include`), so no query change is needed — only the narrower `RestaurantWithUsers` type in `restaurant-detail.tsx` needs the two fields added.

In `src/app/(admin)/admin/restaurants/[id]/restaurant-detail.tsx`, update the type at the top:

```ts
export type RestaurantWithUsers = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  ghlLocationId: string | null;
  ghlApiKey: string | null;
  users: { id: string; name: string; email: string; role: Role }[];
};
```

- [ ] **Step 3: Import the new action and add form state**

In `restaurant-detail.tsx`, update the import line:

```ts
import { updateRestaurantAction, setRestaurantStatusAction, updateGhlCredentialsAction } from "../actions";
```

Add alongside the existing `useState` calls inside `RestaurantDetail`:

```ts
const [ghlLocationId, setGhlLocationId] = useState(restaurant.ghlLocationId ?? "");
const [ghlApiKey, setGhlApiKey] = useState(restaurant.ghlApiKey ?? "");
const [ghlSaving, setGhlSaving] = useState(false);
const [ghlError, setGhlError] = useState<string | null>(null);

async function handleSaveGhl(e: React.FormEvent) {
  e.preventDefault();
  setGhlSaving(true);
  setGhlError(null);
  const result = await updateGhlCredentialsAction(restaurant.id, {
    ghlLocationId: ghlLocationId || null,
    ghlApiKey: ghlApiKey || null,
  });
  setGhlSaving(false);
  if (!result.ok) {
    setGhlError(result.error);
    return;
  }
  router.refresh();
}
```

- [ ] **Step 4: Add the form section to the JSX**

In `restaurant-detail.tsx`, add this new `<form>` immediately after the existing "Restaurant details" `<form>` (after its closing `</form>`, before the `<div className="rounded-[5px] border border-border">` that holds the Staff table):

```tsx
<form onSubmit={handleSaveGhl} className="max-w-md space-y-3 rounded-[5px] border border-border p-5">
  <h2 className="text-base font-semibold">GoHighLevel</h2>
  <p className="text-sm text-muted-foreground">
    Connect this restaurant&apos;s GHL sub-account so new reservations sync as Contacts.
  </p>
  <div className="space-y-2">
    <Label htmlFor="ghlLocationId">Location ID</Label>
    <Input
      id="ghlLocationId"
      value={ghlLocationId}
      onChange={(e) => setGhlLocationId(e.target.value)}
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="ghlApiKey">API Key</Label>
    <Input
      id="ghlApiKey"
      type="password"
      value={ghlApiKey}
      onChange={(e) => setGhlApiKey(e.target.value)}
    />
  </div>
  {ghlError && <p className="text-base text-destructive">{ghlError}</p>}
  <Button type="submit" className="h-11 px-5 text-base" disabled={ghlSaving}>
    {ghlSaving ? "Saving..." : "Save GHL settings"}
  </Button>
</form>
```

(Named "Save GHL settings", distinct from the existing "Save changes" button, since both forms are on the same page at once and Playwright's `getByRole("button", { name: ... })` needs to disambiguate them.)

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/admin/restaurants/actions.ts src/app/\(admin\)/admin/restaurants/\[id\]/restaurant-detail.tsx
git commit -m "feat: add GHL credential entry to Restaurant Detail page"
```

---

### Task 4: Wire the sync into all four reservation-creation paths

**Files:**
- Modify: `src/app/(dashboard)/r/[slug]/reservations/actions.ts` (`createReservationAction`, lines 24-57)
- Modify: `src/app/(dashboard)/r/[slug]/floor-manager/actions.ts` (`quickSeatWalkInAction`, lines 27-57)
- Modify: `src/app/(dashboard)/r/[slug]/waitlist/actions.ts` (`seatFromWaitlistAction`, lines 44-80)
- Modify: `src/app/(public)/book/[slug]/actions.ts` (`createWidgetReservationAction`, lines 38-106)

**Interfaces:**
- Consumes: `syncContactToGhl(credentials: GhlCredentials, guest: GhlGuest): Promise<void>` from `@/lib/ghl-sync` (Task 2). `Restaurant.ghlLocationId`/`ghlApiKey` from Task 1, already present on every `restaurant` record these actions load.
- Produces: nothing new — this task only adds call sites.

- [ ] **Step 1: Wire `createReservationAction`**

In `src/app/(dashboard)/r/[slug]/reservations/actions.ts`, add the import:

```ts
import { syncContactToGhl } from "@/lib/ghl-sync";
```

Then in `createReservationAction`, right after the `await prisma.reservation.create({...})` call (after line 52) and before `revalidatePath(...)`:

```ts
  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: customer.name, email: customer.email, phone: customer.phone }
  );
```

- [ ] **Step 2: Wire `quickSeatWalkInAction`**

In `src/app/(dashboard)/r/[slug]/floor-manager/actions.ts`, add the import:

```ts
import { syncContactToGhl } from "@/lib/ghl-sync";
```

Then in `quickSeatWalkInAction`, right after the `await prisma.reservation.create({...})` call (after line 52) and before `revalidatePath(...)`:

```ts
  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: customer.name, email: customer.email, phone: customer.phone }
  );
```

- [ ] **Step 3: Wire `seatFromWaitlistAction`**

In `src/app/(dashboard)/r/[slug]/waitlist/actions.ts`, add the import:

```ts
import { syncContactToGhl } from "@/lib/ghl-sync";
```

The existing `entry` lookup doesn't load the customer's contact info, so change it to include the relation. Replace:

```ts
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: waitlistEntryId, restaurantId: restaurant.id },
  });
```

with:

```ts
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: waitlistEntryId, restaurantId: restaurant.id },
    include: { customer: true },
  });
```

Then, right after the `await prisma.reservation.create({...})` call (after line 70) and before the `await prisma.waitlistEntry.update({...})` call:

```ts
  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: entry.customer.name, email: entry.customer.email, phone: entry.customer.phone }
  );
```

- [ ] **Step 4: Wire `createWidgetReservationAction`**

In `src/app/(public)/book/[slug]/actions.ts`, add the import:

```ts
import { syncContactToGhl } from "@/lib/ghl-sync";
```

Then in `createWidgetReservationAction`, right after the `await prisma.reservation.create({...})` call (after line 101) and before `revalidatePath(...)`:

```ts
  await syncContactToGhl(
    { ghlLocationId: restaurant.ghlLocationId, ghlApiKey: restaurant.ghlApiKey },
    { name: customer.name, email: customer.email, phone: customer.phone }
  );
```

- [ ] **Step 5: Verify types and existing unit tests still pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all existing tests plus the new `ghl-sync.test.ts` suite pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/r/\[slug\]/reservations/actions.ts src/app/\(dashboard\)/r/\[slug\]/floor-manager/actions.ts src/app/\(dashboard\)/r/\[slug\]/waitlist/actions.ts src/app/\(public\)/book/\[slug\]/actions.ts
git commit -m "feat: sync new reservation guests to GHL on creation"
```

---

### Task 5: Playwright e2e coverage

**Files:**
- Create: `e2e/phase6-ghl-sync.spec.ts`

**Interfaces:**
- Consumes: the "Location ID" / "API Key" labeled inputs and "Save GHL settings" button from Task 3; the existing "New reservation" / "Manage tables" flow from `phase3-reservations.spec.ts`'s conventions; the seeded `owner@blue-fork.example.com` account (has no GHL credentials, per Task 1's nullable default).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/phase6-ghl-sync.spec.ts`:

```ts
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_SLUG = "e2e-ghl-restaurant";
const FIXTURE_OWNER_EMAIL = "owner-ghl-e2e@example.com";
const FIXTURE_TABLE_NUMBER = "GHL-1";
const FIXTURE_CUSTOMER_NAME = "GHL Sync Guest";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "user" WHERE email = $1`, [FIXTURE_OWNER_EMAIL]);
    await client.query(`DELETE FROM restaurant WHERE slug = $1`, [FIXTURE_SLUG]);
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_CUSTOMER_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_CUSTOMER_NAME]);
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 6 GHL reservation sync", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("Super Admin connects a restaurant's GHL credentials and they persist after reload", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/restaurants");
    await page.getByRole("button", { name: "Create restaurant" }).click();
    await page.getByLabel("Name").fill("E2E GHL Restaurant");
    await page.getByLabel("Slug").fill(FIXTURE_SLUG);
    await page.getByLabel("Email").fill(FIXTURE_OWNER_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByText("E2E GHL Restaurant").click();
    await expect(page).toHaveURL(/\/admin\/restaurants\//);

    await page.getByLabel("Location ID").fill("loc_e2e_123");
    await page.getByLabel("API Key").fill("key_e2e_abc");
    await page.getByRole("button", { name: "Save GHL settings" }).click();

    await page.reload();
    await expect(page.getByLabel("Location ID")).toHaveValue("loc_e2e_123");
    await expect(page.getByLabel("API Key")).toHaveValue("key_e2e_abc");
  });

  test("booking a reservation succeeds normally when GHL isn't connected", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(FIXTURE_CUSTOMER_NAME);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-03");
    await page.getByLabel("Time").fill("18:00");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: new RegExp(`Table ${FIXTURE_TABLE_NUMBER}`) }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-03");
    await expect(page.getByText(FIXTURE_CUSTOMER_NAME)).toBeVisible();
  });
});
```

- [ ] **Step 2: Build production and run the e2e suite**

Run: `npx next build && npx next start`
(In a separate terminal, once the server is up) Run: `npx playwright test e2e/phase6-ghl-sync.spec.ts`
Expected: both tests PASS. If port 3000 already has a stale server from a previous run, stop it first (`netstat -ano | findstr :3000` then `Stop-Process -Id <pid> -Force`) before starting a fresh build.

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npx playwright test`
Expected: all suites pass (the existing 12 tests plus this phase's 2 new ones).

- [ ] **Step 4: Commit**

```bash
git add e2e/phase6-ghl-sync.spec.ts
git commit -m "test: add Phase 6 GHL reservation sync e2e coverage"
```
