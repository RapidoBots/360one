import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_TABLE_NUMBER = "WL-1";
const FIXTURE_GUEST_NAME = "E2E Waitlist Guest";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM waitlist_entry WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_GUEST_NAME]
    );
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_GUEST_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_GUEST_NAME]);
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 5 Waitlist", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("add a walk-in, seat them, and see the reservation on the calendar", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    // A table to seat into, via the existing Manage Tables dialog.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/r/blue-fork/waitlist");
    await page.getByRole("button", { name: "Add to waitlist" }).click();
    await page.getByLabel("Name").fill(FIXTURE_GUEST_NAME);
    await page.getByLabel("Phone").fill("555-000-4444");
    await page.getByLabel("Party size").fill("2");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(FIXTURE_GUEST_NAME)).toBeVisible();
    await expect(page.getByText(/waiting \d+m/)).toBeVisible();

    await page.getByRole("button", { name: "Seat" }).click();
    await page.getByRole("button", { name: new RegExp(`Table ${FIXTURE_TABLE_NUMBER}`) }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Moved into Today's history, no longer in the active waiting list.
    await expect(page.getByText("No one is waiting right now.")).toBeVisible();
    await expect(page.getByText("Today")).toBeVisible();
    await expect(page.getByText("Seated")).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=day");
    await expect(page.getByText(FIXTURE_GUEST_NAME)).toBeVisible();
  });
});
