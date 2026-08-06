import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_CUSTOMER_NAME = "E2E Widget Guest";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_CUSTOMER_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_CUSTOMER_NAME]);
  } finally {
    await client.end();
  }
}

test.describe("Embeddable reservation widget", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("books through all 3 steps, lands as Pending, and staff can confirm it", async ({ page }) => {
    await page.goto("/reservations/blue-fork");

    // Step 1 (party size, date, and time slot are all on one screen now):
    // pick a slot (just highlights it), Next is disabled until one is chosen.
    // Today's date defaults in, so early slots may already be in the past
    // (greyed out, disabled) -- filter down to one that's still bookable.
    await expect(page.getByLabel("Number of Guests")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await page
      .getByRole("button", { name: /^\d{1,2}:\d{2}/ })
      .and(page.locator(":enabled"))
      .first()
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 3: contact info.
    await page.getByLabel("Full Name").fill(FIXTURE_CUSTOMER_NAME);
    await page.getByLabel("Email Address").fill("widget-e2e@example.com");
    await page.getByLabel("Phone Number").fill("555-000-3333");
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Request received!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Book another reservation" })).toBeVisible();

    // Staff side: sign in, find it Pending, confirm it.
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.goto("/r/blue-fork/reservations?view=day");
    await page.getByRole("button", { name: "Pending" }).click();
    await page.getByText(FIXTURE_CUSTOMER_NAME).click();
    await expect(page.getByLabel("Reservation status")).toBeVisible();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "CONFIRMED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Settings page shows a working embed snippet", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.goto("/r/blue-fork/settings");
    await expect(page.getByText("/reservations/blue-fork")).toBeVisible();
  });
});
