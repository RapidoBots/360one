import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_TABLE_NUMBERS = ["FM-1", "FM-2"];

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "tableId" IN (SELECT id FROM "table" WHERE number = ANY($1))`,
      [FIXTURE_TABLE_NUMBERS]
    );
    await client.query(`DELETE FROM customer WHERE name = 'Walk-in'`);
    await client.query(`DELETE FROM "table" WHERE number = ANY($1)`, [FIXTURE_TABLE_NUMBERS]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 4 Floor Manager", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("arrange a table, seat and free a walk-in, and get a smart table recommendation", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    // Create two tables of different capacities via the existing Manage Tables dialog.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill("FM-1");
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText("Table FM-1")).toBeVisible();
    await page.getByLabel("Number").fill("FM-2");
    await page.getByLabel("Capacity").fill("6");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText("Table FM-2")).toBeVisible();
    await page.keyboard.press("Escape");

    // Arrange FM-1 on the floor plan.
    await page.goto("/r/blue-fork/floor-manager");
    await expect(page.getByText("aren't on the floor plan yet")).toBeVisible();
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: "Table FM-1 (2 seats)" }).click();

    const fm1Box = page.getByText("Table FM-1", { exact: true });
    await expect(fm1Box).toBeVisible();
    const box = await fm1Box.locator("..").boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 150);
      await page.mouse.up();
    }
    await page.getByRole("button", { name: "Done" }).click();
    await page.reload();
    await expect(page.getByText("Table FM-1", { exact: true })).toBeVisible();

    // Seat a walk-in at FM-1, then free it.
    await page.getByText("Table FM-1", { exact: true }).click();
    await page.getByLabel("Party size").fill("2");
    await page.getByRole("button", { name: "Seat now" }).click();
    // "Walk-in" alone is a bad check here -- it case-insensitively substring-
    // matches this same dialog's own title ("Seat walk-in at Table FM-1"),
    // so it can look "visible" even if the dialog never actually closed.
    // Confirming the dialog is gone is the real signal that seating succeeded.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Table FM-1", { exact: true }).locator("..").getByText("Walk-in")).toBeVisible();

    await page.getByText("Table FM-1", { exact: true }).click();
    await expect(page.getByRole("dialog").getByText("Party of 2")).toBeVisible();
    await page.getByRole("button", { name: "Free table" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Table FM-1", { exact: true }).locator("..").getByText("Walk-in")).toHaveCount(0);

    // Smart recommendation: booking for 2 guests should get a small-table
    // recommendation, not the 6-top -- checked as "not the oversized table"
    // rather than "must be exactly FM-1", since the shared dev database can
    // have other small tables from unrelated manual testing sessions that
    // legitimately tie with FM-1 on capacity. recommendTable's exact tie-break
    // behavior is already covered precisely by its own unit tests (Task 3);
    // this e2e check only needs to prove the modal is actually wired to it.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("Recommend Test");
    await page.getByLabel("Phone").fill("555-000-2222");
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-05");
    await page.getByLabel("Time").fill("18:00");
    await expect(page.getByLabel("Assigned table")).toContainText("Recommended");
    await expect(page.getByLabel("Assigned table")).not.toContainText("FM-2");
    await page.keyboard.press("Escape");
  });
});
