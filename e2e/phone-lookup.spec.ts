import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_PHONE = "555-000-9999";
const FIXTURE_UNKNOWN_PHONE = "555-000-8888";
const FIXTURE_NAME = "Phone Lookup Guest";
const FIXTURE_EMAIL = "phonelookup@example.com";
const FIXTURE_TABLE_NUMBER = "PL-1";

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("owner@blue-fork.example.com");
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);
}

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM waitlist_entry WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_NAME]
    );
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_NAME]);
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
  } finally {
    await client.end();
  }
}

// These three tests run in order within this file (Playwright doesn't
// parallelize tests within one file by default) -- the first test creates
// the returning-guest customer record that the other two look up by phone.
test.describe("Phone-first lookup + auto-fill", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("New Reservation auto-fills a returning guest by phone, and leaves fields blank for an unknown number", async ({
    page,
  }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-20");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Phone number").fill(FIXTURE_PHONE);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Name").fill(FIXTURE_NAME);
    await page.getByLabel("Email").fill(FIXTURE_EMAIL);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-20");
    await page.getByLabel("Time").fill("18:00");
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Second booking, same phone -- name/email auto-fill instead of being retyped.
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-21");
    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Phone number").fill(FIXTURE_PHONE);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Name")).toHaveValue(FIXTURE_NAME);
    await expect(page.getByLabel("Email")).toHaveValue(FIXTURE_EMAIL);

    // An unrecognized number leaves the fields blank for staff to type in.
    await page.getByRole("button", { name: "Use a different phone number" }).click();
    await page.getByLabel("Phone number").fill(FIXTURE_UNKNOWN_PHONE);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue("");
  });

  test("Floor Manager walk-in seating auto-fills a returning guest's name from phone", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: `Table ${FIXTURE_TABLE_NUMBER} (2 seats)` }).click();
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByText(`Table ${FIXTURE_TABLE_NUMBER}`, { exact: true }).click();
    // Scoped to the dialog -- unscoped getByLabel("Name") also substring-matches
    // the floor switcher's "Rename Main Floor" button ("Rename" contains "name").
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Phone number").fill(FIXTURE_PHONE);
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue(FIXTURE_NAME);
    await dialog.getByLabel("Party size").fill("2");
    await dialog.getByRole("button", { name: "Add walk-in" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(
      page.getByText(`Table ${FIXTURE_TABLE_NUMBER}`, { exact: true }).locator("..").getByText(FIXTURE_NAME)
    ).toBeVisible();
  });

  test("Waiting Area lookup auto-fills a returning guest's name and email from phone", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/waitlist");
    await page.getByRole("button", { name: "Add to Waiting Area" }).click();
    await page.getByLabel("Phone number").fill(FIXTURE_PHONE);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Name")).toHaveValue(FIXTURE_NAME);
    await expect(page.getByLabel("Email")).toHaveValue(FIXTURE_EMAIL);
    await page.getByLabel("Party size").fill("2");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(FIXTURE_NAME)).toBeVisible();
  });
});
