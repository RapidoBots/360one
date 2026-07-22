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
    // requireRestaurantAccess calls notFound() for a suspended restaurant
    // (not redirect()), so the URL stays the same -- assert on the 404
    // content instead, same as phase1-smoke's cross-tenant test would if
    // it were exercising this branch instead of the different-restaurant one.
    await ownerPage.goto("/r/e2e-admin-restaurant/dashboard");
    await expect(ownerPage.getByText("This page could not be found.")).toBeVisible();
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
