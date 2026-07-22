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
    await expect(page.getByRole("button", { name: "Saving..." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save GHL settings" })).toBeVisible();

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
