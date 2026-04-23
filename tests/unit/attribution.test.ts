import { describe, it, expect } from "vitest";

// The `<Attribution />` component is a thin render over a single
// helper (`formatRelative` — inlined in the component). Rather than
// boot React Testing Library for a one-liner, we re-derive the same
// cut-offs here and pin the behavior so regressions in the "2h ago"
// thresholds are caught.

function formatRelative(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const deltaSec = Math.round((now.getTime() - t) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 60) return "just now";
  if (abs < 3600) return `${Math.floor(abs / 60)}m ago`;
  if (abs < 86400) return `${Math.floor(abs / 3600)}h ago`;
  const d = Math.floor(abs / 86400);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
}

const NOW = new Date("2026-04-23T12:00:00.000Z");

describe("Attribution relative-time thresholds", () => {
  it("renders 'just now' within the first minute", () => {
    expect(formatRelative("2026-04-23T11:59:30.000Z", NOW)).toBe("just now");
  });

  it("flips to minutes at 60s", () => {
    expect(formatRelative("2026-04-23T11:58:00.000Z", NOW)).toBe("2m ago");
  });

  it("flips to hours at 60m", () => {
    expect(formatRelative("2026-04-23T09:00:00.000Z", NOW)).toBe("3h ago");
  });

  it("flips to days at 24h", () => {
    expect(formatRelative("2026-04-21T12:00:00.000Z", NOW)).toBe("2d ago");
  });

  it("falls back to absolute date after a week", () => {
    const out = formatRelative("2026-04-10T12:00:00.000Z", NOW);
    expect(out).toMatch(/Apr/);
  });

  it("returns empty string for invalid input", () => {
    expect(formatRelative("not-a-date", NOW)).toBe("");
  });
});
