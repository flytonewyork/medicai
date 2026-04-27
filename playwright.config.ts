import { defineConfig, devices } from "@playwright/test";

// Multi-project config so the navbar (and any future cross-device-
// sensitive UI) is exercised across the engines and viewports the
// patient and family actually use:
//   - desktop Chrome (clinic laptops)
//   - desktop Safari / WebKit (Mac users in the family)
//   - iPhone 13 (iOS Safari) — primary patient device
//   - iPhone SE (narrowest mainstream iOS — overflow trap)
//   - Pixel 5 (Android Chrome) — caregiver phones
//   - iPad — the form factor that often falls through the cracks
//     between mobile and desktop layouts
//
// Tests can opt into mobile-only behaviour by name-filtering the
// `mobile` projects, or stay engine-agnostic if they're testing
// shared logic.

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chrome-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "safari-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "iphone-safari", use: { ...devices["iPhone 13"] } },
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
    { name: "android-chrome", use: { ...devices["Pixel 5"] } },
    { name: "ipad", use: { ...devices["iPad Pro 11"] } },
  ],
});
