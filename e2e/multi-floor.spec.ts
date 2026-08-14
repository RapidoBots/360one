import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_FLOOR_NAME = "Patio";
const FIXTURE_FLOOR_RENAMED = "Rooftop Patio";
const FIXTURE_TABLE_NUMBER = "MF-1";

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
    await client.query(`DELETE FROM "table" WHERE number = $1`, [FIXTURE_TABLE_NUMBER]);
    await client.query(
      `DELETE FROM floor WHERE name = ANY($1) AND "restaurantId" = (SELECT id FROM restaurant WHERE slug = 'blue-fork')`,
      [[FIXTURE_FLOOR_NAME, FIXTURE_FLOOR_RENAMED]]
    );
  } finally {
    await client.end();
  }
}

test.describe("Multi-floor Floor Manager", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("owner creates a floor, a table placed on it is isolated to that floor, then rename/delete-guard/delete all work", async ({
    page,
  }) => {
    page.on("dialog", (d) => d.accept());
    await signInAsOwner(page);

    // Create a second floor.
    await page.goto("/r/blue-fork/floor-manager");
    await expect(page.getByRole("button", { name: "Main Floor", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add floor" }).click();
    await page.getByLabel("New floor name").fill(FIXTURE_FLOOR_NAME);
    await page.getByRole("button", { name: "Save new floor" }).click();
    await expect(page.getByRole("button", { name: FIXTURE_FLOOR_NAME, exact: true })).toBeVisible();

    // Add a table on the new floor via Manage Tables.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Floor").click();
    await page.getByRole("option", { name: FIXTURE_FLOOR_NAME }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER);
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(
      page.getByRole("dialog").locator("li", { hasText: `Table ${FIXTURE_TABLE_NUMBER}` })
    ).toContainText(FIXTURE_FLOOR_NAME);
    await page.keyboard.press("Escape");

    // The new table shows up (unplaced) on its own floor...
    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: FIXTURE_FLOOR_NAME, exact: true }).click();
    await expect(page).toHaveURL(/floor=/);
    await expect(page.getByText("aren't on the floor plan yet")).toBeVisible();
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await expect(page.getByRole("button", { name: `Table ${FIXTURE_TABLE_NUMBER} (2 seats)` })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // ...and does NOT show up on Main Floor.
    await page.getByRole("button", { name: "Main Floor", exact: true }).click();
    await expect(page.getByText(`Table ${FIXTURE_TABLE_NUMBER}`, { exact: true })).toHaveCount(0);

    // Rename the floor.
    await page.getByRole("button", { name: FIXTURE_FLOOR_NAME, exact: true }).click();
    await page.getByRole("button", { name: `Rename ${FIXTURE_FLOOR_NAME}` }).click();
    await page.getByLabel("Rename floor").fill(FIXTURE_FLOOR_RENAMED);
    await page.getByRole("button", { name: "Save floor name" }).click();
    await expect(page.getByRole("button", { name: FIXTURE_FLOOR_RENAMED, exact: true })).toBeVisible();

    // Can't delete while it still has a table on it.
    await page.getByRole("button", { name: `Delete ${FIXTURE_FLOOR_RENAMED}` }).click();
    await expect(
      page.getByText("Can't delete -- this floor still has tables on it. Move or delete those first.")
    ).toBeVisible();

    // Remove the table, then deletion succeeds.
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page
      .locator("li", { hasText: `Table ${FIXTURE_TABLE_NUMBER}` })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER}`)).toBeHidden();
    await page.keyboard.press("Escape");

    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: `Delete ${FIXTURE_FLOOR_RENAMED}` }).click();
    await expect(page.getByRole("button", { name: FIXTURE_FLOOR_RENAMED, exact: true })).toHaveCount(0);
  });
});
