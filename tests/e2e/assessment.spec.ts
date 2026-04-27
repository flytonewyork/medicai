/**
 * US-5: Assessment page
 *
 * Verifies that a new patient can understand the assessment entry point,
 * knows roughly what to expect (time, content), and can begin without
 * confusion. The empty state is the first thing they see — it must be
 * actionable and informative.
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

test.describe("Assessment empty state", () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/assessment");
  });

  test("shows a clear empty state message", async ({ page }) => {
    await expect(
      page.getByText(/no comprehensive assessment yet|no assessment/i),
    ).toBeVisible();
  });

  test("shows a time estimate so the patient knows what to expect", async ({
    page,
  }) => {
    // Without a time estimate, patients may defer because they don't know
    // if this will take 5 minutes or an hour.
    await expect(page.getByText(/minute|min/i)).toBeVisible();
  });

  test("has a clear CTA button to start baseline assessment", async ({
    page,
  }) => {
    const cta = page.getByRole("button", { name: /establish baseline|begin|start/i });
    await expect(cta).toBeVisible();
  });

  test("baseline nudge card uses plain language without jargon", async ({
    page,
  }) => {
    // "rule engine watches for drift" is internal jargon — should not appear
    // in patient-facing UI.
    await expect(page.getByText(/rule engine/i)).not.toBeVisible();
    await expect(page.getByText(/watches for drift/i)).not.toBeVisible();
  });
});

test.describe("Assessment dashboard nudge card", () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/");
  });

  test("baseline nudge card appears on fresh dashboard", async ({ page }) => {
    await expect(page.getByText(/capture your baselines/i)).toBeVisible();
  });

  test("baseline nudge links to /assessment", async ({ page }) => {
    const link = page.getByRole("link", { name: /open|start/i }).first();
    await link.click();
    await expect(page).toHaveURL("/assessment");
  });
});
