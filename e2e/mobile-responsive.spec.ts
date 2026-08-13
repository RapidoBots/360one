import "dotenv/config";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

test.use({ viewport: { width: 375, height: 812 } });

// Distinct table numbers per test -- the floor plan tray only lists
// *unplaced* tables, and placing one (as the zoom/touch test does) is
// permanent for the run, so sharing a number across tests would make the
// second test's tray lookup fail.
const FIXTURE_TABLE_NUMBER_ZOOM = "FM-MOBILE-1";
const FIXTURE_TABLE_NUMBER_TOOLTIP = "FM-MOBILE-2";
const FIXTURE_GUEST_NAME = "Mobile Floor Guest";

async function cleanupFloorManagerFixtures() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM reservation WHERE "customerId" IN (SELECT id FROM customer WHERE name = $1)`,
      [FIXTURE_GUEST_NAME]
    );
    await client.query(`DELETE FROM customer WHERE name = $1`, [FIXTURE_GUEST_NAME]);
    await client.query(`DELETE FROM "table" WHERE number = ANY($1)`, [
      [FIXTURE_TABLE_NUMBER_ZOOM, FIXTURE_TABLE_NUMBER_TOOLTIP],
    ]);
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
  test.beforeAll(cleanupFloorManagerFixtures);
  test.afterAll(cleanupFloorManagerFixtures);

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

  test("Floor Manager: zoom controls resize the canvas, dragging is touch-safe, and the page doesn't overflow", async ({
    page,
  }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER_ZOOM);
    await page.getByLabel("Capacity").fill("4");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER_ZOOM}`)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: `Table ${FIXTURE_TABLE_NUMBER_ZOOM} (4 seats)` }).click();

    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(page.getByText("80%", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByText("120%", { exact: true })).toBeVisible();

    // In edit mode, the draggable table must not compete with the browser's
    // native touch-scroll gesture on the canvas. The touch-none class lives
    // on the outer wrapper, two levels up from the "Table X" text (text ->
    // inner colored box -> outer draggable wrapper).
    const tableWrapper = page.getByText(`Table ${FIXTURE_TABLE_NUMBER_ZOOM}`, { exact: true }).locator("../..");
    const touchAction = await tableWrapper.evaluate((el) => getComputedStyle(el).touchAction);
    expect(touchAction).toBe("none");

    await page.getByRole("button", { name: "Done" }).click();
    await expectNoHorizontalOverflow(page);
  });

  test("Floor Manager: the reservation-count badge is tappable (not hover-only)", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/r/blue-fork/reservations");
    await page.getByRole("button", { name: "Manage tables" }).click();
    await page.getByLabel("Number").fill(FIXTURE_TABLE_NUMBER_TOOLTIP);
    await page.getByLabel("Capacity").fill("4");
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByRole("dialog").getByText(`Table ${FIXTURE_TABLE_NUMBER_TOOLTIP}`)).toBeVisible();
    await page.keyboard.press("Escape");

    // Book a reservation for today (no date override) so it shows up on the
    // Floor Manager, which only surfaces today's reservations.
    await page.getByRole("button", { name: "New reservation" }).click();
    await page.getByLabel("Name").fill(FIXTURE_GUEST_NAME);
    await page.getByLabel("Party size").fill("2");
    await page.getByLabel("Assigned table").click();
    await page.getByRole("option", { name: new RegExp(`Table ${FIXTURE_TABLE_NUMBER_TOOLTIP}`) }).click();
    await page.getByRole("button", { name: "Confirm reservation" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/r/blue-fork/floor-manager");
    await page.getByRole("button", { name: "Edit Layout" }).click();
    await page.getByRole("button", { name: `Table ${FIXTURE_TABLE_NUMBER_TOOLTIP} (4 seats)` }).click();
    await page.getByRole("button", { name: "Done" }).click();

    const badge = page.getByRole("button", { name: "1 reservation today" });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("aria-expanded", "false");
    await badge.click();
    await expect(badge).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(`${FIXTURE_GUEST_NAME} · 2p`)).toBeVisible();
    await badge.click();
    await expect(badge).toHaveAttribute("aria-expanded", "false");
  });
});
