/**
 * US-2 & US-3: Daily check-in (quick and full)
 *
 * Verifies that a patient who has completed onboarding can:
 *   - Complete the 3-slider quick check-in in ~30 seconds
 *   - Understand what 0 and 10 mean on the pain/nausea scales
 *   - Navigate to the full daily wizard
 *   - Select categories and progress through the wizard
 *   - See a helpful message when no categories are selected
 *   - Review and save entries
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

test.describe("Quick check-in card", () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
  });

  test("quick check-in card is visible on dashboard", async ({ page }) => {
    await expect(
      page.getByText(/today's check-in/i, { exact: false }),
    ).toBeVisible();
  });

  test("pain scale shows anchor labels so meaning is clear", async ({
    page,
  }) => {
    // The pain scale should have context showing 0=none and 10=worst
    // so patients aren't guessing the direction of the scale.
    const painSection = page.locator("text=Pain").first();
    await expect(painSection).toBeVisible();

    // Anchor labels should be near the scale
    await expect(page.getByText(/none|0 = none/i).first()).toBeVisible();
  });

  test("save button completes the quick check-in", async ({ page }) => {
    await page.getByRole("button", { name: /save today/i }).click();
    await expect(page.getByText(/saved for today/i)).toBeVisible();
  });

  test("'Full log' link is visible and navigates to full wizard", async ({
    page,
  }) => {
    const fullLogLink = page.getByRole("link", { name: /full log/i }).first();
    await expect(fullLogLink).toBeVisible();
    await fullLogLink.click();
    await page.waitForURL(/\/daily\/new/);
  });
});

test.describe("Full daily wizard", () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/daily/new");
  });

  test("shows category picker on load", async ({ page }) => {
    await expect(
      page.getByText(/what would you like to note/i),
    ).toBeVisible();
  });

  test("Start button is disabled when no categories selected", async ({
    page,
  }) => {
    const startBtn = page.getByRole("button", { name: /start/i });
    await expect(startBtn).toBeDisabled();
  });

  test("disabled Start button shows a helpful hint explaining why", async ({
    page,
  }) => {
    // A new user hitting a disabled button with no explanation is a dead end.
    // There should be visible text guiding them to select at least one category.
    await expect(
      page.getByText(/select|choose|pick/i, { exact: false }).first(),
    ).toBeVisible();
  });

  test("selecting a category enables the Start button", async ({ page }) => {
    await page.getByText("How you feel").click();
    const startBtn = page.getByRole("button", { name: /start \(1\)/i });
    await expect(startBtn).toBeEnabled();
  });

  test("progresses through a selected category and reaches review", async ({
    page,
  }) => {
    // Pick only "Sleep"
    await page.getByText("Sleep").click();
    await page.getByRole("button", { name: /start \(1\)/i }).click();

    // Sleep step heading
    await expect(page.getByText("Sleep")).toBeVisible();

    // Hit Next / Review
    await page.getByRole("button", { name: /review|next/i }).click();

    // Should reach Review screen
    await expect(page.getByText("Review")).toBeVisible();
    await expect(page.getByRole("button", { name: /save/i })).toBeVisible();
  });

  test("Skip button clears the step and advances", async ({ page }) => {
    await page.getByText("How you feel").click();
    await page.getByText("Sleep").click();
    await page.getByRole("button", { name: /start \(2\)/i }).click();

    // On "How you feel" step — click Skip
    await page.getByRole("button", { name: /skip/i }).click();

    // Should advance to Sleep step
    await expect(page.getByText("Sleep")).toBeVisible();
  });
});

test.describe("Daily history page", () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
  });

  test("is reachable from mobile bottom nav", async ({ page }) => {
    // Daily should be accessible from mobile nav — this is a core daily flow.
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 15
    await page.goto("/");

    // The mobile bottom nav should have a link to /daily or at least the
    // dashboard route that contains the daily quick-check-in.
    const dailyNavLink = page.getByRole("navigation").getByRole("link", {
      name: /daily/i,
    });
    await expect(dailyNavLink).toBeVisible();
  });

  test("shows empty state with CTA when no entries exist", async ({ page }) => {
    await page.goto("/daily");
    await expect(page.getByText(/no entries yet/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /quick entry|new|begin/i }),
    ).toBeVisible();
  });
});
