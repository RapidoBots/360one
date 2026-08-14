import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_TABLE_SETTINGS = "STYLE-1";
const FIXTURE_TABLE_COLOR = "STYLE-2";
const FIXTURE_TABLE_NUMBERS = [FIXTURE_TABLE_SETTINGS, FIXTURE_TABLE_COLOR];

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
      `DELETE FROM reservation WHERE "tableId" IN (SELECT id FROM "table" WHERE number = ANY($1))`,
      [FIXTURE_TABLE_NUMBERS]
    );
    await client.query(`DELETE FROM "table" WHERE number = ANY($1)`, [FIXTURE_TABLE_NUMBERS]);
  } finally {
    await client.end();
  }
}

test.describe("Floor Manager table styling", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("owner customizes shape, rotation, size, and per-side chairs via the settings panel, and it persists across reload", async ({
    page,
  }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_SETTINGS);
    await page.getByLabel("Capacity").fill("4");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_SETTINGS}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: `Table ${FIXTURE_TABLE_SETTINGS} (4 seats)` }).click();

    const outerWrapperForSettings = page
      .getByText(`Table ${FIXTURE_TABLE_SETTINGS}`, { exact: true })
      .locator("../..");
    await outerWrapperForSettings.getByRole("button", { name: "Table settings" }).click();
    await page.getByLabel("Shape").click();
    await page.getByRole("option", { name: "Rectangle" }).click();
    await page.getByLabel("Rotation (degrees)").fill("45");
    await page.getByLabel("Width (px)").fill("150");
    await page.getByLabel("Height (px)").fill("60");
    await page.getByLabel("Chairs on top").fill("0");
    await page.getByLabel("Chairs on right").fill("1");
    await page.getByLabel("Chairs on bottom").fill("0");
    await page.getByLabel("Chairs on left").fill("1");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const tableInner = page.getByText(`Table ${FIXTURE_TABLE_SETTINGS}`, { exact: true }).locator("..");
    await expect(tableInner).toHaveCSS("width", "150px");
    await expect(tableInner).toHaveCSS("border-radius", "5px"); // rectangle, not round

    const outerWrapper = tableInner.locator("..");
    await expect(outerWrapper).toHaveCSS("transform", /matrix/); // rotation applied

    await page.getByRole("button", { name: "Done" }).click();
    await page.reload();

    // Persisted: reopen settings and confirm the saved values round-trip.
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await outerWrapperForSettings.getByRole("button", { name: "Table settings" }).click();
    await expect(page.getByLabel("Rotation (degrees)")).toHaveValue("45");
    await expect(page.getByLabel("Width (px)")).toHaveValue("150");
    await expect(page.getByLabel("Height (px)")).toHaveValue("60");
    await expect(page.getByLabel("Chairs on right")).toHaveValue("1");
    await expect(page.getByLabel("Chairs on top")).toHaveValue("0");
  });

  test("table color reflects status: green when available, red once seated", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_COLOR);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_COLOR}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: `Table ${FIXTURE_TABLE_COLOR} (2 seats)` }).click();
    await page.getByRole("button", { name: "Done" }).click();

    const tableInner = page.getByText(`Table ${FIXTURE_TABLE_COLOR}`, { exact: true }).locator("..");
    await expect(tableInner).toHaveClass(/bg-emerald-500/); // available

    await tableInner.click();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByLabel("Party size").fill("2");
    await page.getByRole("button", { name: "Add walk-in" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(tableInner).toHaveClass(/bg-red-500/); // seated
  });
});
