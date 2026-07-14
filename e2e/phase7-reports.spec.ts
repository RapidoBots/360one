import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_TABLE_NUMBER = "RPT-1";
const SHOWN_GUEST = "Reports Shown Guest";
const NO_SHOW_GUEST = "Reports No-Show Guest";
const START_DATE = "2026-09-01";
const END_DATE = "2026-09-02";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = ANY($1))`,
      [[SHOWN_GUEST, NO_SHOW_GUEST]]
    );
    await client.query(`DELETE FROM customer WHERE name = ANY($1)`, [[SHOWN_GUEST, NO_SHOW_GUEST]]);
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
  } finally {
    await client.end();
  }
}

test.describe("Phase 7 Reports", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("shows accurate rates for a selected range and exports a matching CSV", async ({ page }) => {
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

    // One reservation that will be marked SEATED (shows up), one left PENDING
    // then marked NO_SHOW -- gives a known, non-zero no-show rate to assert on.
    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(SHOWN_GUEST);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill(START_DATE);
    await page.getByLabel("Time").fill("18:00");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: new RegExp(`Table ${FIXTURE_TABLE_NUMBER}`) }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(NO_SHOW_GUEST);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill(START_DATE);
    await page.getByLabel("Time").fill("20:00");
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto(`/r/blue-fork/reservations?view=day&date=${START_DATE}`);
    await page.getByText(NO_SHOW_GUEST).click();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "NO_SHOW" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto(`/r/blue-fork/reservations?view=day&date=${START_DATE}`);
    await page.getByText(SHOWN_GUEST).click();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "SEATED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto(`/r/blue-fork/reports?start=${START_DATE}&end=${END_DATE}`);
    await expect(page.getByLabel("Start")).toHaveValue(START_DATE);
    await expect(page.getByLabel("End")).toHaveValue(END_DATE);
    await expect(page.getByText("No-show rate")).toBeVisible();
    await expect(page.getByText("50%", { exact: true })).toBeVisible(); // no-show rate: 1 of 2
    await expect(page.getByText("0%", { exact: true })).toBeVisible(); // cancellation rate: 0 of 2

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    const csvPath = await download.path();
    const fs = await import("node:fs/promises");
    const csvContent = csvPath ? await fs.readFile(csvPath, "utf-8") : "";
    expect(csvContent).toContain(SHOWN_GUEST);
    expect(csvContent).toContain(NO_SHOW_GUEST);
    expect(csvContent).toContain("Date,Time,Guest Name,Party Size,Table,Status");
  });
});
