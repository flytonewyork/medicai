/**
 * Bottom-nav rendering contract.
 *
 * The patient sees this nav on every screen on every device. Two
 * things have to be right at all viewports:
 *
 *  1. The five icons render and the nav fits within the viewport
 *     without horizontal scroll.
 *  2. The page content's bottom padding leaves a sensible gap to
 *     the nav — small enough that the patient isn't staring at
 *     dead space (the bug that triggered this spec), large enough
 *     that the last line of content isn't kissed by the nav.
 *
 * Multi-project Playwright runs the same spec on Desktop Chrome,
 * Desktop Safari (WebKit), iPhone 13, iPhone SE, Pixel 5 and iPad.
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

test.describe("Mobile bottom nav — render + clearance", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "chrome-desktop" ||
        testInfo.project.name === "safari-desktop" ||
        testInfo.project.name === "ipad",
      "Mobile bottom nav is hidden on md+ breakpoints",
    );
    await completeOnboarding(page);
  });

  test("renders all 5 patient slots", async ({ page }) => {
    const nav = page.locator("nav.pwa-bottom-nav");
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(5);
  });

  test("nav fits within the viewport (no horizontal scroll)", async ({
    page,
  }) => {
    const nav = page.locator("nav.pwa-bottom-nav");
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
  });

  test("page bottom padding leaves a sensible gap to the nav", async ({
    page,
  }) => {
    // Nav visible top edge from viewport bottom.
    const nav = page.locator("nav.pwa-bottom-nav");
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    const viewport = page.viewportSize()!;
    const navTopFromViewportBottom = viewport.height - navBox!.y;

    // Content's reserved bottom space — main element padding-bottom.
    const mainPaddingBottom = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return null;
      const cs = getComputedStyle(main);
      return parseFloat(cs.paddingBottom);
    });
    expect(mainPaddingBottom).not.toBeNull();

    // The padding must clear the visible nav (otherwise the last
    // line of content sits under the nav glass) and shouldn't waste
    // huge dead space (the user's complaint that triggered this
    // spec — 38 px excess on regular browsers).
    const gap = mainPaddingBottom! - navTopFromViewportBottom;
    expect(gap, `gap=${gap}px main pb=${mainPaddingBottom} navTop=${navTopFromViewportBottom}`).toBeGreaterThanOrEqual(0);
    expect(gap, `gap=${gap}px main pb=${mainPaddingBottom} navTop=${navTopFromViewportBottom}`).toBeLessThanOrEqual(28);
  });

  test("nav stays at the bottom of the viewport (fixed)", async ({ page }) => {
    const nav = page.locator("nav.pwa-bottom-nav");
    const initial = await nav.boundingBox();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    const after = await nav.boundingBox();
    expect(after!.y).toBeCloseTo(initial!.y, -1);
  });

  test("pill bottom edge sits within 16 px of viewport bottom (no big white band below)", async ({
    page,
  }) => {
    // The earlier bug: anchor was `max(0.75rem, env(safe-area-inset-
    // bottom))`, so on iOS PWA the inset (~34 px) pushed the pill up
    // and left a visible band of paper-2 below it — the user
    // screenshot that triggered this fix. Regular-browser viewports
    // don't expose the inset, so the assertion here is the simpler
    // "anchor is fixed at 0.75rem" expectation. PWA mode is verified
    // visually on the Vercel preview.
    const nav = page.locator("nav.pwa-bottom-nav");
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize()!;
    const gap = viewport.height - (box!.y + box!.height);
    expect(
      gap,
      `Pill bottom edge ${gap}px from viewport bottom (want ≤ 16px)`,
    ).toBeLessThanOrEqual(16);
    // Also confirm the pill *isn't* overlapping the viewport edge.
    expect(gap).toBeGreaterThanOrEqual(0);
  });

  test("nav is hidden on /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("nav.pwa-bottom-nav")).toHaveCount(0);
  });
});

test.describe("Mobile bottom nav — active state on sub-routes", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "chrome-desktop" ||
        testInfo.project.name === "safari-desktop" ||
        testInfo.project.name === "ipad",
      "Mobile bottom nav is hidden on md+ breakpoints",
    );
    await completeOnboarding(page);
  });

  test("Dashboard tab is active on /", async ({ page }) => {
    const link = page
      .locator("nav.pwa-bottom-nav")
      .getByRole("link", { name: /dashboard/i });
    // Active state styles `text-ink-900` text and `text-[var(--tide-2)]` icon
    // — the visible cue is the icon colour. Easiest assertion is the
    // class reflecting active.
    const cls = await link.getAttribute("class");
    expect(cls).toContain("text-ink-900");
  });

  test("Nutrition tab stays active on /nutrition/log (sub-route)", async ({
    page,
  }) => {
    await page.goto("/nutrition/log");
    const link = page
      .locator("nav.pwa-bottom-nav")
      .getByRole("link", { name: /nutrition/i });
    const cls = await link.getAttribute("class");
    expect(cls).toContain("text-ink-900");
  });

  test("Schedule tab stays active on /schedule/new", async ({ page }) => {
    await page.goto("/schedule/new");
    const link = page
      .locator("nav.pwa-bottom-nav")
      .getByRole("link", { name: /schedule/i });
    const cls = await link.getAttribute("class");
    expect(cls).toContain("text-ink-900");
  });
});

test.describe("Desktop sidebar — render", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !["chrome-desktop", "safari-desktop", "ipad"].includes(
        testInfo.project.name,
      ),
      "Desktop sidebar only renders at md+ breakpoints",
    );
    await completeOnboarding(page);
  });

  test("sidebar is visible", async ({ page }) => {
    await expect(page.locator("aside")).toBeVisible();
  });

  test("sidebar contains Nutrition link", async ({ page }) => {
    await expect(
      page.locator("aside").getByRole("link", { name: /nutrition/i }),
    ).toBeVisible();
  });
});
