import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_SLUG = "e2e-settings-restaurant";
const FIXTURE_OWNER_EMAIL = "owner-p8-e2e@example.com";
const FIXTURE_STAFF_EMAIL = "staff-p8-e2e@example.com";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TODAY_DAY_NAME = DAY_NAMES[new Date().getDay()];

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "user" WHERE email = ANY($1)`, [[FIXTURE_OWNER_EMAIL, FIXTURE_STAFF_EMAIL]]);
    await client.query(
      `DELETE FROM business_hours WHERE "restaurantId" = (SELECT id FROM restaurant WHERE slug = $1)`,
      [FIXTURE_SLUG]
    );
    await client.query(`DELETE FROM restaurant WHERE slug = $1`, [FIXTURE_SLUG]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 8 Settings", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  // Runs first: creates the dedicated fixture restaurant and its Owner
  // account, which the second test (running after it, same worker, same
  // file -- Playwright runs tests within one file sequentially by default)
  // reuses rather than recreating.
  test("Owner closes today's hours and sets a new default duration, and both take effect", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/restaurants");
    await page.getByRole("button", { name: "Create restaurant" }).click();
    await page.getByLabel("Name").fill("E2E Settings Restaurant");
    await page.getByLabel("Slug").fill(FIXTURE_SLUG);
    await page.getByLabel("Email").fill(FIXTURE_OWNER_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel("Email").fill(FIXTURE_OWNER_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${FIXTURE_SLUG}/dashboard`));

    await page.goto(`/r/${FIXTURE_SLUG}/settings`);
    await page.getByRole("combobox", { name: `${TODAY_DAY_NAME} status` }).click();
    await page.getByRole("option", { name: "Closed" }).click();

    await page.getByLabel("Default reservation duration (minutes)").fill("60");
    await page.getByRole("button", { name: "Save business settings" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    // Widget: today should now show as closed (Step 1 defaults to today's date).
    await page.goto(`/reservations/${FIXTURE_SLUG}`);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("We're closed on this day")).toBeVisible();

    // Internal booking: the modal's default duration should reflect the new setting.
    await page.goto(`/r/${FIXTURE_SLUG}/reservations`);
    await page.getByRole("button", { name: "New reservation" }).click();
    await expect(page.getByText("60 min")).toBeVisible();
  });

  test("Owner adds a staff member who can sign in, then deactivates them so they no longer can", async ({
    page,
    browser,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(FIXTURE_OWNER_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/r/${FIXTURE_SLUG}/dashboard`));

    await page.goto(`/r/${FIXTURE_SLUG}/settings`);
    await page.getByRole("button", { name: "Add staff member" }).click();
    await page.getByLabel("Staff name").fill("Phase 8 E2E Staff");
    await page.getByLabel("Email").fill(FIXTURE_STAFF_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(FIXTURE_STAFF_EMAIL)).toBeVisible();

    // Owner's own row has no deactivate/reactivate control (no self-deactivation).
    const ownerRow = page.locator("tr", { hasText: FIXTURE_OWNER_EMAIL });
    await expect(ownerRow.getByRole("button")).toHaveCount(0);

    // A new page from the SAME context shares its cookie jar with `page` --
    // signing in there as Staff would silently swap the Owner session on
    // `page` too, since we need `page` to still be the Owner afterward. A
    // fully separate browser context keeps the two sessions independent.
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await staffPage.goto("/sign-in");
    await staffPage.getByLabel("Email").fill(FIXTURE_STAFF_EMAIL);
    await staffPage.getByLabel("Password").fill("password1234");
    await staffPage.getByRole("button", { name: "Sign in" }).click();
    await expect(staffPage).toHaveURL(new RegExp(`/r/${FIXTURE_SLUG}/dashboard`));
    await staffContext.close();

    const staffRow = page.locator("tr", { hasText: FIXTURE_STAFF_EMAIL });
    await staffRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(staffRow.getByRole("button", { name: "Reactivate" })).toBeVisible();

    const deactivatedContext = await browser.newContext();
    const deactivatedPage = await deactivatedContext.newPage();
    await deactivatedPage.goto("/sign-in");
    await deactivatedPage.getByLabel("Email").fill(FIXTURE_STAFF_EMAIL);
    await deactivatedPage.getByLabel("Password").fill("password1234");
    await deactivatedPage.getByRole("button", { name: "Sign in" }).click();
    await expect(deactivatedPage).toHaveURL(/\/sign-in/);
    await deactivatedContext.close();
  });
});
