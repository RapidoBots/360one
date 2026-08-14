import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_GUEST_NAME = "Internal Note Guest";
const FIXTURE_TABLE_NUMBER = "IN-1";
const NOTE_TEXT = "Regular -- prefers the corner booth, allergic to shellfish";

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
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_GUEST_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_GUEST_NAME]);
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
  } finally {
    await client.end();
  }
}

test.describe("Internal staff-only note", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("saved on create, editable afterward, and never shown on the public booking widget", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Name").fill(FIXTURE_GUEST_NAME);
    await page.getByLabel("Internal note (staff only)").fill(NOTE_TEXT);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: new RegExp(`Table ${FIXTURE_TABLE_NUMBER}`) }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Reopening the reservation shows the saved note.
    await page.getByText(FIXTURE_GUEST_NAME).click();
    await expect(page.getByLabel("Internal note (staff only)")).toHaveValue(NOTE_TEXT);
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "SEATED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Remains accessible to staff after the table is seated, via Floor Manager.
    // The table was only created above (Manage Tables), never arranged onto
    // the floor plan -- place it first or it stays in the "unplaced" tray.
    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: `Table ${FIXTURE_TABLE_NUMBER} (2 seats)` }).click();
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByText(`Table ${FIXTURE_TABLE_NUMBER}`, { exact: true }).click();
    await expect(page.getByRole("dialog").getByText(NOTE_TEXT)).toBeVisible();
    await page.getByRole("button", { name: "Free table" }).click();

    // Never leaked to the guest-facing widget's contact form.
    await page.goto("/reservations/blue-fork");
    const widgetText = await page.locator("body").innerText();
    expect(widgetText).not.toContain(NOTE_TEXT);
  });
});
