/**
 * US-1: First-time patient onboarding
 *
 * Verifies that a brand-new user can complete onboarding and reach the
 * dashboard without hitting any blockers. Tests the minimum viable path
 * (name only) as well as the full path with team + treatment.
 */

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Clear IndexedDB so every test starts as a truly new user.
  await page.addInitScript(() => {
    indexedDB.deleteDatabase("AnchorDB");
  });
  await page.goto("/");
});

test("redirects to /onboarding when no settings exist", async ({ page }) => {
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByText("Let's set up Anchor together")).toBeVisible();
});

test("progress bar and step counter advance correctly", async ({ page }) => {
  await page.goto("/onboarding");
  // Step 1 of N shows "Welcome · 1/"
  await expect(page.getByText(/Welcome · 1\//)).toBeVisible();

  // Click Begin
  await page.getByRole("button", { name: /begin/i }).click();

  // Should now be on "Who you are" step
  await expect(page.getByText(/Who you are/i)).toBeVisible();
});

test("minimum viable path: name only, skip everything else", async ({
  page,
}) => {
  await page.goto("/onboarding");

  // Welcome → next
  await page.getByRole("button", { name: /begin/i }).click();

  // user_type: pick "I'm the patient"
  await page.getByText("I'm the patient").click();
  await page.getByRole("button", { name: /continue/i }).click();

  // Profile: enter name
  await page.getByPlaceholder(/hu lin/i).fill("Test Patient");
  await page.getByRole("button", { name: /continue/i }).click();

  // Team: skip
  await page.getByText("Finish setup later").click();

  // Should jump to Done step
  await expect(page.getByText("You're ready")).toBeVisible();

  // Summary should show the name
  await expect(page.getByText("Test Patient")).toBeVisible();

  // Hit Save and Continue
  await page.getByRole("button", { name: /save and continue/i }).click();

  // Should land on dashboard
  await expect(page).toHaveURL("/");
  await expect(page.getByText(/good morning|good afternoon|good evening/i)).toBeVisible();
});

test("protocol name shown as readable label in Done step summary", async ({
  page,
}) => {
  await page.goto("/onboarding");

  await page.getByRole("button", { name: /begin/i }).click();
  await page.getByText("I'm the patient").click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByPlaceholder(/hu lin/i).fill("Test Patient");
  await page.getByRole("button", { name: /continue/i }).click();

  // Skip team
  await page.getByRole("button", { name: /continue/i }).click();

  // Treatment: check "I'm currently on a protocol"
  await page.getByLabel(/currently on a protocol/i).check();
  await page.getByRole("button", { name: /continue/i }).click();

  // Preferences → continue
  await page.getByRole("button", { name: /continue/i }).click();

  // Done step: protocol should NOT show raw ID like "gnp_weekly"
  const protocolRow = page.locator("dd").filter({ hasText: /gnp_weekly/i });
  await expect(protocolRow).not.toBeVisible();

  // Should show a human-readable name
  await expect(page.getByText(/GnP/i)).toBeVisible();
});

test("caregiver path lands on /family, not /", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByRole("button", { name: /begin/i }).click();
  await page.getByText("I'm family or a caregiver").click();
  await page.getByRole("button", { name: /continue/i }).click();

  // pick_patient step — no existing households, so "start fresh"
  await page.getByText("I'm setting up a new patient instead").click();

  // Profile
  await page.getByPlaceholder(/hu lin/i).fill("Caregiver Name");
  await page.getByRole("button", { name: /continue/i }).click();

  // Preferences → continue then Done
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /save and continue/i }).click();

  await expect(page).toHaveURL("/family");
});

test("'Finish setup later' is visible and functional from Team step", async ({
  page,
}) => {
  await page.goto("/onboarding");

  await page.getByRole("button", { name: /begin/i }).click();
  await page.getByText("I'm the patient").click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByPlaceholder(/hu lin/i).fill("Test Patient");
  await page.getByRole("button", { name: /continue/i }).click();

  // On Team step — "Finish setup later" should be visible
  await expect(page.getByText("Finish setup later")).toBeVisible();
  await page.getByText("Finish setup later").click();

  // Should jump to Done
  await expect(page.getByText("You're ready")).toBeVisible();
});
