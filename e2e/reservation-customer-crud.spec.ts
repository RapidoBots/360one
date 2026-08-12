import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("owner@blue-fork.example.com");
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);
}

const RESERVATION_DELETE_GUEST = "CRUD Delete Guest";
const CUSTOMER_EDIT_GUEST = "CRUD Edit Guest";
const CUSTOMER_EDIT_GUEST_RENAMED = "CRUD Edit Guest Renamed";
const FIXTURE_NAMES = [RESERVATION_DELETE_GUEST, CUSTOMER_EDIT_GUEST, CUSTOMER_EDIT_GUEST_RENAMED];

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = ANY($1))`,
      [FIXTURE_NAMES]
    );
    await client.query(`DELETE FROM customer WHERE name = ANY($1)`, [FIXTURE_NAMES]);
  } finally {
    await client.end();
  }
}

test.describe("Reservation and customer edit/delete", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("owner deletes a reservation from the edit modal", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-03");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(RESERVATION_DELETE_GUEST);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-03");
    await page.getByLabel("Time").fill("18:00");
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(RESERVATION_DELETE_GUEST)).toBeVisible();

    await page.getByText(RESERVATION_DELETE_GUEST).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(RESERVATION_DELETE_GUEST)).toBeHidden();
  });

  test("owner edits a customer's details, then can't delete until their reservation is gone", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-04");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(CUSTOMER_EDIT_GUEST);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-04");
    await page.getByLabel("Time").fill("18:30");
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/r/blue-fork/customers");
    await page.getByText(CUSTOMER_EDIT_GUEST, { exact: true }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(CUSTOMER_EDIT_GUEST_RENAMED);
    await page.getByLabel("Email").fill("crud-edit-guest@example.com");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(CUSTOMER_EDIT_GUEST_RENAMED)).toBeVisible();

    // Deleting is blocked while the customer still has a reservation.
    await page.getByText(CUSTOMER_EDIT_GUEST_RENAMED).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Can't delete — this customer has reservations. Delete those first.")).toBeVisible();

    // Remove the reservation, then deletion succeeds.
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-04");
    await page.getByText(CUSTOMER_EDIT_GUEST_RENAMED).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/r/blue-fork/customers");
    await page.getByText(CUSTOMER_EDIT_GUEST_RENAMED).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("tbody").getByText(CUSTOMER_EDIT_GUEST_RENAMED)).toBeHidden();
  });
});
