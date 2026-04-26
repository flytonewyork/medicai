/**
 * US-7 & US-8: Navigation discoverability
 *
 * Verifies that a new user on mobile and desktop can reach all core
 * sections without needing to know hidden URLs. This tests the
 * "single channel" principle — all important actions should be reachable
 * from the main UI without digging through menus.
 */

import { test, expect, type Page } from "@playwright/test";

async function completeOnboarding(page: Page) {
  await page.addInitScript(() => {
    indexedDB.deleteDatabase("AnchorDB");
  });
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /begin/i }).click();
  await page.getByText("I'm the patient").click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByPlaceholder(/hu lin/i).fill("Test Patient");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByText("Finish setup later").click();
  await page.getByRole("button", { name: /save and continue/i }).click();
  await page.waitForURL("/");
}

test.describe("Mobile navigation (390px wide)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
  });

  test("bottom nav is visible on dashboard", async ({ page }) => {
    const nav = page.locator("nav").filter({
      has: page.getByRole("link", { name: /dashboard/i }),
    });
    await expect(nav).toBeVisible();
  });

  test("bottom nav contains link to Daily", async ({ page }) => {
    // Daily is the core daily interaction — must be in mobile nav.
    await expect(
      page.getByRole("link", { name: /daily/i }),
    ).toBeVisible();
  });

  test("bottom nav contains link to Dashboard", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /dashboard/i }),
    ).toBeVisible();
  });

  test("bottom nav contains link to Schedule", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /schedule/i }),
    ).toBeVisible();
  });

  test("'More' menu opens and shows all remaining nav items", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /menu/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Should include Settings at minimum
    await expect(
      page.getByRole("link", { name: /settings/i }),
    ).toBeVisible();
  });

  test("can navigate to /daily from mobile nav", async ({ page }) => {
    await page.getByRole("link", { name: /daily/i }).click();
    await expect(page).toHaveURL(/\/daily/);
  });

  test("can navigate to /settings via more menu", async ({ page }) => {
    await page.getByRole("button", { name: /menu/i }).click();
    await page.getByRole("link", { name: /settings/i }).click();
    await expect(page).toHaveURL("/settings");
  });
});

test.describe("Desktop navigation (1440px wide)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
  });

  test("desktop sidebar is visible", async ({ page }) => {
    await expect(page.locator("aside")).toBeVisible();
  });

  test("sidebar shows Anchor app name", async ({ page }) => {
    await expect(page.getByText("Anchor").first()).toBeVisible();
  });

  test("sidebar link to /daily is present", async ({ page }) => {
    await expect(
      page.locator("aside").getByRole("link", { name: /daily/i }),
    ).toBeVisible();
  });

  test("sidebar link to /bridge is present", async ({ page }) => {
    await expect(
      page.locator("aside").getByRole("link", { name: /bridge/i }),
    ).toBeVisible();
  });
});
