import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const NEW_SUPER_ADMIN_EMAIL = "super-e2e@example.com";
const SETTINGS_SUPER_ADMIN_EMAIL = "settings-e2e@example.com";
const SETTINGS_SUPER_ADMIN_NEW_EMAIL = "settings-e2e-renamed@example.com";
const FIXTURE_EMAILS = [NEW_SUPER_ADMIN_EMAIL, SETTINGS_SUPER_ADMIN_EMAIL, SETTINGS_SUPER_ADMIN_NEW_EMAIL];

// Self-cleaning, same reasoning as phase2-super-admin.spec.ts -- fixed
// emails aren't naturally idempotent across repeated runs. Never touches
// the shared admin@example.com seed account other spec files rely on.
async function cleanupFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "user" WHERE email = ANY($1)`, [FIXTURE_EMAILS]);
  } finally {
    await client.end();
  }
}

test.describe("Admin account management", () => {
  test.beforeAll(cleanupFixtures);
  test.afterAll(cleanupFixtures);

  test("Super Admin creates another Super Admin, who can sign in, then deactivates them", async ({
    page,
    browser,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/super-admins");
    await page.getByRole("button", { name: "Add Super Admin" }).click();
    await page.getByLabel("Name").fill("E2E Super Admin");
    await page.getByLabel("Email").fill(NEW_SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Add Super Admin", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(NEW_SUPER_ADMIN_EMAIL)).toBeVisible();

    // Separate context: sharing `page`'s cookie jar would swap the
    // original Super Admin's session too (same risk as phase8-settings).
    const newAdminContext = await browser.newContext();
    const newAdminPage = await newAdminContext.newPage();
    await newAdminPage.goto("/sign-in");
    await newAdminPage.getByLabel("Email").fill(NEW_SUPER_ADMIN_EMAIL);
    await newAdminPage.getByLabel("Password").fill("password1234");
    await newAdminPage.getByRole("button", { name: "Sign in" }).click();
    await expect(newAdminPage).toHaveURL(/\/admin/);
    await newAdminContext.close();

    const newAdminRow = page.locator("tr", { hasText: NEW_SUPER_ADMIN_EMAIL });
    await newAdminRow.getByRole("button", { name: "Deactivate" }).click();
    await expect(newAdminRow.getByRole("button", { name: "Reactivate" })).toBeVisible();

    const deactivatedContext = await browser.newContext();
    const deactivatedPage = await deactivatedContext.newPage();
    await deactivatedPage.goto("/sign-in");
    await deactivatedPage.getByLabel("Email").fill(NEW_SUPER_ADMIN_EMAIL);
    await deactivatedPage.getByLabel("Password").fill("password1234");
    await deactivatedPage.getByRole("button", { name: "Sign in" }).click();
    await expect(deactivatedPage).toHaveURL(/\/sign-in/);
    await deactivatedContext.close();
  });

  test("Super Admin changes their own email and password from Settings", async ({ page, browser }) => {
    // Uses a dedicated fixture account (not admin@example.com) so other
    // spec files' shared login keeps working regardless of test order.
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/super-admins");
    await page.getByRole("button", { name: "Add Super Admin" }).click();
    await page.getByLabel("Name").fill("Settings E2E Admin");
    await page.getByLabel("Email").fill(SETTINGS_SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Add Super Admin", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/sign-in");
    await adminPage.getByLabel("Email").fill(SETTINGS_SUPER_ADMIN_EMAIL);
    await adminPage.getByLabel("Password").fill("password1234");
    await adminPage.getByRole("button", { name: "Sign in" }).click();
    await expect(adminPage).toHaveURL(/\/admin/);

    await adminPage.goto("/admin/settings");
    await adminPage.getByLabel("New password").fill("newpassword1234");
    await adminPage.getByLabel("Current password").fill("password1234");
    await adminPage.getByRole("button", { name: "Update password" }).click();
    await expect(adminPage.getByText("Password updated.")).toBeVisible();

    await adminPage.getByLabel("New email").fill(SETTINGS_SUPER_ADMIN_NEW_EMAIL);
    await adminPage.getByRole("button", { name: "Update email" }).click();
    await expect(adminPage.getByText("Email updated.")).toBeVisible();
    await adminContext.close();

    // Confirm both changes actually took effect: old credentials fail,
    // new email + new password succeed.
    const oldCredsContext = await browser.newContext();
    const oldCredsPage = await oldCredsContext.newPage();
    await oldCredsPage.goto("/sign-in");
    await oldCredsPage.getByLabel("Email").fill(SETTINGS_SUPER_ADMIN_EMAIL);
    await oldCredsPage.getByLabel("Password").fill("password1234");
    await oldCredsPage.getByRole("button", { name: "Sign in" }).click();
    await expect(oldCredsPage).toHaveURL(/\/sign-in/);
    await oldCredsContext.close();

    const newCredsContext = await browser.newContext();
    const newCredsPage = await newCredsContext.newPage();
    await newCredsPage.goto("/sign-in");
    await newCredsPage.getByLabel("Email").fill(SETTINGS_SUPER_ADMIN_NEW_EMAIL);
    await newCredsPage.getByLabel("Password").fill("newpassword1234");
    await newCredsPage.getByRole("button", { name: "Sign in" }).click();
    await expect(newCredsPage).toHaveURL(/\/admin/);
    await newCredsContext.close();
  });
});
