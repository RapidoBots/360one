import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

// Uses a plain `pg` client and the running dev server's own sign-up API
// rather than importing @/lib/prisma or @/lib/auth directly: the
// generated Prisma client (Task 2) is ESM (`import.meta`), which breaks
// under Playwright's test-runner module loader.
async function createOtherRestaurantStaff(baseURL: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO restaurant (id, name, slug, status, "createdAt")
       VALUES (gen_random_uuid()::text, 'Other Restaurant', 'other-restaurant', 'ACTIVE', now())
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const restaurantId = rows[0]!.id;

    const signUpResponse = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "staff@other-restaurant.example.com",
        password: "password1234",
        name: "Other Staff",
      }),
    });
    const body = (await signUpResponse.json()) as { user?: { id: string } };

    const userId =
      body.user?.id ??
      (
        await client.query<{ id: string }>(
          `SELECT id FROM "user" WHERE email = 'staff@other-restaurant.example.com'`
        )
      ).rows[0]?.id;
    if (!userId) throw new Error("Could not create or find staff@other-restaurant.example.com");

    await client.query(`UPDATE "user" SET role = 'STAFF', "restaurantId" = $1 WHERE id = $2`, [
      restaurantId,
      userId,
    ]);
  } finally {
    await client.end();
  }
}

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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("The Blue Fork");
  });

  test("a staff member from another restaurant cannot access this one", async ({ page, baseURL }) => {
    await createOtherRestaurantStaff(baseURL!);

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
