import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const FIXTURE_CUSTOMER_NAME = "E2E Success Message Guest";

async function resetSuccessMessageFields() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE restaurant SET "successMessage" = NULL, "successButtonText" = NULL WHERE slug = 'blue-fork'`
    );
  } finally {
    await client.end();
  }
}

async function cleanupFixtures() {
  await resetSuccessMessageFields();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_CUSTOMER_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_CUSTOMER_NAME]);
  } finally {
    await client.end();
  }
}

test.describe("Widget confirmation message customization", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("owner customizes the widget's confirmation message and button, and guests see it substituted", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.goto("/r/blue-fork/settings");
    await page
      .getByLabel("Widget confirmation message")
      .fill(
        "Your request has been sent to {restaurant_name} for {date} at {time}. We'll notify you once confirmed."
      );
    await page.getByLabel("Widget confirmation button text").fill("New Reservation");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    await page.goto("/reservations/blue-fork");
    await expect(page.getByLabel("Number of Guests")).toBeVisible();
    await page
      .getByRole("button", { name: /^\d{1,2}:\d{2}/ })
      .and(page.locator(":enabled"))
      .first()
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Full Name").fill(FIXTURE_CUSTOMER_NAME);
    await page.getByLabel("Email Address").fill("success-message-e2e@example.com");
    await page.getByLabel("Phone Number", { exact: true }).fill("5550004444");
    await page.getByRole("button", { name: "Submit" }).click();

    // {restaurant_name} resolves to the real name; {date}/{time} resolve to
    // the actual booked slot -- checked as "no longer literal placeholders"
    // rather than an exact string, since which slot got picked is dynamic.
    await expect(page.getByText("Your request has been sent to The Blue Fork for", { exact: false })).toBeVisible();
    const messageText = await page.getByText("Your request has been sent to The Blue Fork").innerText();
    expect(messageText).not.toContain("{date}");
    expect(messageText).not.toContain("{time}");
    await expect(page.getByRole("button", { name: "New Reservation" })).toBeVisible();
  });
});
