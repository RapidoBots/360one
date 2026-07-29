import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

// Far-future fixed dates -- avoids "today" boundary flakiness across
// timezones, and won't collide with any date another spec happens to touch.
const BLOCKED_SLOT_DATE = "2026-12-24";
const CLOSED_DATE = "2026-12-25";

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM blocked_slot WHERE "restaurantId" = (SELECT id FROM restaurant WHERE slug = 'blue-fork') AND date = ANY($1)`,
      [[BLOCKED_SLOT_DATE, CLOSED_DATE]]
    );
    await client.query(
      `DELETE FROM closed_date WHERE "restaurantId" = (SELECT id FROM restaurant WHERE slug = 'blue-fork') AND date = ANY($1)`,
      [[BLOCKED_SLOT_DATE, CLOSED_DATE]]
    );
  } finally {
    await client.end();
  }
}

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("owner@blue-fork.example.com");
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);
}

test.describe("Availability overrides", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("owner blocks a single slot, and the widget greys it out while leaving neighbors bookable", async ({
    page,
  }) => {
    await signInAsOwner(page);

    await page.goto("/r/blue-fork/settings");
    await page.getByLabel("Date").fill(BLOCKED_SLOT_DATE);
    const slotButton = page.getByRole("button", { name: "7:00 PM", exact: true });
    await slotButton.click();
    // Toggling is an async Server Action -- wait for its round trip to land
    // (blocked styling) before navigating away, or the write can lose the race.
    await expect(slotButton).toHaveClass(/line-through/);

    await page.goto("/reservations/blue-fork");
    await page.getByLabel("Date").fill(BLOCKED_SLOT_DATE);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("button", { name: "7:00 PM", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "6:45 PM", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "7:15 PM", exact: true })).toBeEnabled();
  });

  test("owner closes an entire day, and the widget shows it as closed", async ({ page }) => {
    await signInAsOwner(page);

    await page.goto("/r/blue-fork/settings");
    await page.getByLabel("Date").fill(CLOSED_DATE);
    await page.getByRole("button", { name: "Close entire day" }).click();
    await expect(page.getByRole("button", { name: "Closed all day -- click to reopen" })).toBeVisible();

    await page.goto("/reservations/blue-fork");
    await page.getByLabel("Date").fill(CLOSED_DATE);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("We're closed on this day")).toBeVisible();
  });
});
