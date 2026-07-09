import { test, expect } from "@playwright/test";

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("owner@blue-fork.example.com");
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);
}

test.describe("Phase 3 reservations core", () => {
  test("create a table, book a reservation, see it across all calendar views, edit it, and find the guest in Customers", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");

    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill("E2E-1");
    await page.getByLabel("Capacity").fill("4");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText("Table E2E-1")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("Taylor Guest");
    await page.getByLabel("Phone").fill("555-000-1111");
    await page.getByLabel("Party size").fill("3");
    await page.getByLabel("Date").fill("2026-08-01");
    await page.getByLabel("Time").fill("19:00");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: /Table E2E-1/ }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-01");
    await expect(page.getByText("Taylor Guest")).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=week&date=2026-08-01");
    await expect(page.getByText(/Taylor Guest/)).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=timeline&date=2026-08-01");
    await expect(page.getByText("Taylor Guest")).toBeVisible();

    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-01");
    await page.getByText("Taylor Guest").click();
    await page.getByLabel("Reservation status").click();
    await page.getByRole("option", { name: "SEATED" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Seated", { exact: true })).toBeVisible();

    await page.goto("/r/blue-fork/customers");
    await expect(page.getByText("Taylor Guest")).toBeVisible();
    await page.getByText("Taylor Guest").click();
    await expect(page.getByText(/Party of 3/)).toBeVisible();
  });

  test("assigning an already-booked table at an overlapping time is rejected", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-02");

    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill("E2E-2");
    await page.getByLabel("Capacity").fill("2");
    await page.getByRole("button", { name: "Add table" }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("First Guest");
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-02");
    await page.getByLabel("Time").fill("20:00");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: /Table E2E-2/ }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();

    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill("Second Guest");
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Date").fill("2026-08-02");
    await page.getByLabel("Time").fill("20:30");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: /Table E2E-2/ }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();

    await expect(page.getByText("That table is already booked for an overlapping time.")).toBeVisible();
  });
});
