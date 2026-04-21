import { describe, it, expect } from "vitest";
import {
  accelOver,
  observationsInWindow,
  olsSlopePerDay,
  slopeOver,
} from "~/lib/state/slope";
import type { Observation } from "~/lib/state/types";

function obs(date: string, value: number): Observation {
  return { date, value };
}

describe("olsSlopePerDay", () => {
  it("returns null with fewer than 3 observations", () => {
    expect(olsSlopePerDay([])).toBeNull();
    expect(olsSlopePerDay([obs("2026-04-01", 10)])).toBeNull();
    expect(
      olsSlopePerDay([obs("2026-04-01", 10), obs("2026-04-02", 11)]),
    ).toBeNull();
  });

  it("returns +1 per day for a clean +1/day increase", () => {
    const s = olsSlopePerDay([
      obs("2026-04-01", 10),
      obs("2026-04-02", 11),
      obs("2026-04-03", 12),
      obs("2026-04-04", 13),
    ]);
    expect(s).not.toBeNull();
    expect(s!).toBeCloseTo(1, 6);
  });

  it("returns negative slope for a falling series", () => {
    const s = olsSlopePerDay([
      obs("2026-04-01", 60),
      obs("2026-04-04", 57),
      obs("2026-04-07", 54),
    ]);
    expect(s!).toBeCloseTo(-1, 6);
  });

  it("is robust to noise (best-fit line, not first-last)", () => {
    const s = olsSlopePerDay([
      obs("2026-04-01", 70),
      obs("2026-04-02", 72),
      obs("2026-04-03", 71),
      obs("2026-04-04", 73),
      obs("2026-04-05", 74),
      obs("2026-04-06", 73),
      obs("2026-04-07", 75),
    ]);
    // Rising ~0.7/day
    expect(s!).toBeGreaterThan(0.5);
    expect(s!).toBeLessThan(1.0);
  });

  it("returns null when all points fall on the same day (x variance 0)", () => {
    const s = olsSlopePerDay([
      obs("2026-04-01", 70),
      obs("2026-04-01", 72),
      obs("2026-04-01", 71),
    ]);
    expect(s).toBeNull();
  });
});

describe("observationsInWindow", () => {
  const series = [
    obs("2026-04-01", 1),
    obs("2026-04-05", 2),
    obs("2026-04-10", 3),
    obs("2026-04-12", 4),
    obs("2026-04-15", 5),
  ];

  it("returns only observations within [asOf - window, asOf]", () => {
    const w = observationsInWindow(series, "2026-04-15", 7);
    expect(w.map((o) => o.value)).toEqual([3, 4, 5]);
  });

  it("includes the asOf day itself", () => {
    const w = observationsInWindow(series, "2026-04-10", 0);
    expect(w.map((o) => o.value)).toEqual([3]);
  });

  it("tolerates unsorted input", () => {
    const shuffled = [series[4]!, series[0]!, series[2]!, series[1]!, series[3]!];
    const w = observationsInWindow(shuffled, "2026-04-15", 7);
    expect(w.map((o) => o.value).sort()).toEqual([3, 4, 5]);
  });
});

describe("slopeOver", () => {
  it("computes slope over a trailing window", () => {
    const series = [
      obs("2026-04-01", 100),
      obs("2026-04-05", 95),
      obs("2026-04-08", 92),
      obs("2026-04-12", 90),
      obs("2026-04-15", 88),
    ];
    // Last 7 days: 04-08 (92), 04-12 (90), 04-15 (88) — roughly -0.57/day
    const s = slopeOver(series, "2026-04-15", 7);
    expect(s!).toBeLessThan(0);
  });

  it("returns null when window holds < 3 points", () => {
    const series = [obs("2026-04-01", 70), obs("2026-04-02", 71)];
    expect(slopeOver(series, "2026-04-15", 7)).toBeNull();
  });
});

describe("accelOver", () => {
  it("detects accelerating decline (more negative recent slope)", () => {
    // First fortnight: stable around 70; second fortnight: falling fast.
    const series = [
      obs("2026-04-01", 70),
      obs("2026-04-03", 70),
      obs("2026-04-05", 70),
      obs("2026-04-07", 70),
      obs("2026-04-09", 69),
      obs("2026-04-11", 67),
      obs("2026-04-13", 64),
      obs("2026-04-15", 60),
    ];
    const a = accelOver(series, "2026-04-15", 7);
    expect(a).not.toBeNull();
    expect(a!).toBeLessThan(0);
  });

  it("is positive for recovery (flat after decline)", () => {
    const series = [
      obs("2026-04-01", 70),
      obs("2026-04-03", 68),
      obs("2026-04-05", 66),
      obs("2026-04-07", 64),
      obs("2026-04-09", 64),
      obs("2026-04-11", 65),
      obs("2026-04-13", 65),
      obs("2026-04-15", 65),
    ];
    const a = accelOver(series, "2026-04-15", 7);
    expect(a).not.toBeNull();
    expect(a!).toBeGreaterThan(0);
  });

  it("returns null when either half window lacks data", () => {
    const series = [
      obs("2026-04-13", 70),
      obs("2026-04-14", 71),
      obs("2026-04-15", 72),
    ];
    // Prior half-window (04-02..04-08) has no observations
    const a = accelOver(series, "2026-04-15", 7);
    expect(a).toBeNull();
  });
});
