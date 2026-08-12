import "dotenv/config";
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("owner@blue-fork.example.com");
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/r\/blue-fork\/dashboard/);
}

// A generous tolerance for scrollbar-width rounding; anything past this on a
// 375px viewport is a real horizontal-overflow bug, not noise.
const OVERFLOW_TOLERANCE_PX = 2;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + OVERFLOW_TOLERANCE_PX);
}

test.describe("Mobile responsiveness (375px viewport)", () => {
  test("dashboard sidebar is hidden, hamburger opens a nav drawer, and a link navigates", async ({ page }) => {
    await signInAsOwner(page);

    // The desktop sidebar is `hidden md:block` -- it exists in the DOM but
    // must not be visible/interactable on mobile.
    await expect(page.getByRole("link", { name: /Reservations/ })).toHaveCount(0);

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const reservationsLink = drawer.getByRole("link", { name: /Reservations/ });
    await expect(reservationsLink).toBeVisible();
    await reservationsLink.click();

    await expect(page).toHaveURL(/\/r\/blue-fork\/reservations/);
    await expect(drawer).toBeHidden();

    await expectNoHorizontalOverflow(page);
  });

  test("admin shell also gets the mobile nav drawer", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@example.com");
    await page.getByLabel("Password").fill("password1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Restaurants" })).toBeVisible();
  });

  test("Settings business hours grid doesn't overflow the viewport", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/settings");
    await expect(page.getByText("Business hours & reservation rules")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("reservation edit modal fits within the viewport", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=day&date=2026-08-06");
    await page.getByRole("button", { name: "New reservation" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(375);
  });

  test("week view doesn't force page-level overflow (scrolls internally instead)", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=week&date=2026-08-03");
    await expectNoHorizontalOverflow(page);
  });

  test("timeline view (default) doesn't force page-level overflow, and its table-label column is sticky", async ({
    page,
  }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations?view=timeline&date=2026-08-03");
    await expectNoHorizontalOverflow(page);

    const position = await page.getByText("Tables", { exact: true }).evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe("sticky");
  });

  test("Manage tables dialog stacks its fields into a single column", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const numberBox = await page.getByLabel("Number").boundingBox();
    const capacityBox = await page.getByLabel("Capacity").boundingBox();
    expect(numberBox).not.toBeNull();
    expect(capacityBox).not.toBeNull();
    // Stacked (grid-cols-1) means Capacity sits below Number, not beside it.
    expect(capacityBox!.y).toBeGreaterThan(numberBox!.y + numberBox!.height - 1);
  });
});
