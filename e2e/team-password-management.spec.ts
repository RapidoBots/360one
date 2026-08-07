import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

const OWNER_RESET_STAFF_EMAIL = "owner-reset-target@example.com";
const ADMIN_RESET_STAFF_EMAIL = "admin-reset-target@example.com";
const FIXTURE_EMAILS = [OWNER_RESET_STAFF_EMAIL, ADMIN_RESET_STAFF_EMAIL];

async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "user" WHERE email = ANY($1)`, [FIXTURE_EMAILS]);
  } finally {
    await client.end();
  }
}

async function expectSignInSucceeds(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

test.describe("Team member password management", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("Owner resets a team member's password, and they can sign in with the new one", async ({
    page,
    browser,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@blue-fork.example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);

    await page.goto("/r/blue-fork/settings");
    await page.getByRole("button", { name: "Add staff member" }).click();
    await page.getByLabel("Staff name").fill("Owner Reset Target");
    await page.getByLabel("Email").fill(OWNER_RESET_STAFF_EMAIL);
    await page.getByLabel("Password").fill("originalpass1");
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const row = page.locator("tr", { hasText: OWNER_RESET_STAFF_EMAIL });
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("New password (leave blank to keep current)").fill("resetbyowner1");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const staffContext = await browser.newContext();
    await expectSignInSucceeds(await staffContext.newPage(), OWNER_RESET_STAFF_EMAIL, "resetbyowner1");
    await staffContext.close();
  });

  test("Super Admin resets a restaurant staff member's password from the admin panel", async ({
    page,
    browser,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/restaurants");
    await page.getByPlaceholder("Search by name or slug").fill("blue-fork");
    await page.getByText("The Blue Fork").click();
    await expect(page).toHaveURL(/\/admin\/restaurants\/.+/);

    await page.getByRole("button", { name: "Add staff member" }).click();
    await page.getByLabel("Staff name").fill("Admin Reset Target");
    await page.getByLabel("Email").fill(ADMIN_RESET_STAFF_EMAIL);
    await page.getByLabel("Password").fill("originalpass2");
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const row = page.locator("tr", { hasText: ADMIN_RESET_STAFF_EMAIL });
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("New password (leave blank to keep current)").fill("resetbyadmin1");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const staffContext = await browser.newContext();
    await expectSignInSucceeds(await staffContext.newPage(), ADMIN_RESET_STAFF_EMAIL, "resetbyadmin1");
    await staffContext.close();
  });
});
