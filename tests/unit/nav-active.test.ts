import { describe, it, expect } from "vitest";
import { isNavItemActive } from "~/lib/nav/active";

// Active-state matcher for the bottom nav + desktop sidebar.
// Used to be `pathname === item.href`, which silently dropped the
// active highlight on every sub-route — `/nutrition/log` no longer
// lit up the Nutrition tab, `/schedule/new` no longer lit up
// Schedule, etc. The screenshot of an all-grey navbar that
// triggered this fix was taken on exactly such a sub-route.

describe("isNavItemActive", () => {
  it("dashboard '/' matches only the exact pathname", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/nutrition", "/")).toBe(false);
    expect(isNavItemActive("/anything", "/")).toBe(false);
  });

  it("non-root href matches its own pathname", () => {
    expect(isNavItemActive("/nutrition", "/nutrition")).toBe(true);
    expect(isNavItemActive("/schedule", "/schedule")).toBe(true);
  });

  it("non-root href matches a nested sub-route", () => {
    // The persistent bug: this used to return false because
    // `/nutrition/log !== /nutrition`. The Nutrition tab stayed grey
    // even though the user was inside the Nutrition section.
    expect(isNavItemActive("/nutrition/log", "/nutrition")).toBe(true);
    expect(isNavItemActive("/nutrition/123", "/nutrition")).toBe(true);
    expect(isNavItemActive("/nutrition/foods", "/nutrition")).toBe(true);
    expect(isNavItemActive("/schedule/new", "/schedule")).toBe(true);
    expect(isNavItemActive("/treatment/cycle/3", "/treatment")).toBe(true);
  });

  it("does NOT match prefix collisions", () => {
    // `/nutritional` shouldn't activate `/nutrition`; `/scheduled`
    // shouldn't activate `/schedule`. Without the boundary check,
    // `/nutritional`.startsWith(`/nutrition`) is true — would
    // wrongly highlight the wrong tab.
    expect(isNavItemActive("/nutritional", "/nutrition")).toBe(false);
    expect(isNavItemActive("/scheduled", "/schedule")).toBe(false);
    expect(isNavItemActive("/care-team-roster", "/care-team")).toBe(false);
  });

  it("treats null/undefined pathname as inactive", () => {
    expect(isNavItemActive(null, "/")).toBe(false);
    expect(isNavItemActive(undefined, "/nutrition")).toBe(false);
  });

  it("ignores trailing slash on pathname", () => {
    expect(isNavItemActive("/nutrition/", "/nutrition")).toBe(true);
    expect(isNavItemActive("/", "/")).toBe(true);
  });

  it("sibling routes are independent", () => {
    // /nutrition vs /history — neither should ever activate the
    // other no matter the trailing path.
    expect(isNavItemActive("/history", "/nutrition")).toBe(false);
    expect(isNavItemActive("/nutrition", "/history")).toBe(false);
  });

  it("query strings and hashes do not affect matching", () => {
    expect(isNavItemActive("/nutrition?foo=bar", "/nutrition")).toBe(true);
    expect(isNavItemActive("/nutrition#section", "/nutrition")).toBe(true);
    expect(isNavItemActive("/nutrition/log?id=1", "/nutrition")).toBe(true);
  });
});
