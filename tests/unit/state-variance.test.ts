import { describe, it, expect } from "vitest";
import {
  consecutiveDaysAbove,
  consecutiveDaysBelow,
  patientSD,
  rollingMean,
} from "~/lib/state/variance";
import type { Observation } from "~/lib/state/types";

function obs(date: string, value: number): Observation {
  return { date, value };
}

function synthSeries(
  startISO: string,
  values: number[],
): Observation[] {
  const out: Observation[] = [];
  const start = new Date(startISO).getTime();
  values.forEach((v, i) => {
    const d = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: d, value: v });
  });
  return out;
}

describe("patientSD", () => {
  it("returns null with fewer than minN observations", () => {
    const series = synthSeries("2026-03-18", [5000, 5100, 4800, 4900]);
    expect(patientSD(series, "2026-04-15", 28, 5)).toBeNull();
  });

  it("excludes the asOf day itself", () => {
    // Add a huge spike on asOf day — should not enter the SD window.
    const body = synthSeries("2026-03-20", [
      5000, 5100, 5200, 4900, 5000, 4950, 5050, 5100,
    ]);
    const spike: Observation = { date: "2026-04-15", value: 20000 };
    const est = patientSD([...body, spike], "2026-04-15", 28);
    expect(est).not.toBeNull();
    expect(est!.sd).toBeLessThan(200); // body sd is ~100, spike would blow it up
  });

  it("produces a reasonable SD for noisy data", () => {
    const series = synthSeries("2026-03-20", [
      5000, 5100, 5200, 4900, 5000, 4950, 5050, 5100, 4980, 5020,
    ]);
    const est = patientSD(series, "2026-04-15", 28);
    expect(est).not.toBeNull();
    expect(est!.mean).toBeGreaterThan(4900);
    expect(est!.mean).toBeLessThan(5100);
    expect(est!.sd).toBeGreaterThan(50);
    expect(est!.sd).toBeLessThan(150);
  });

  it("returns null for a constant series (sd=0)", () => {
    const series = synthSeries(
      "2026-03-20",
      Array.from({ length: 10 }, () => 5000),
    );
    expect(patientSD(series, "2026-04-15", 28)).toBeNull();
  });
});

describe("rollingMean", () => {
  it("averages values in the trailing window including asOf", () => {
    const series = synthSeries("2026-04-09", [5000, 5100, 4900, 5200, 4800, 5000, 4950]);
    // asOf 2026-04-15, window 7 days → all 7 observations included.
    const m = rollingMean(series, "2026-04-15", 7);
    expect(m).not.toBeNull();
    expect(m!).toBeCloseTo((5000 + 5100 + 4900 + 5200 + 4800 + 5000 + 4950) / 7, 2);
  });

  it("returns null with < minN points in window", () => {
    const series = synthSeries("2026-04-13", [5000, 5100]);
    expect(rollingMean(series, "2026-04-15", 7, 3)).toBeNull();
  });
});

describe("consecutiveDaysBelow / Above", () => {
  it("returns 0 when today's rolling mean is above threshold", () => {
    const series = synthSeries("2026-04-09", [5000, 5000, 5000, 5000, 5000, 5000, 5000]);
    const d = consecutiveDaysBelow(series, "2026-04-15", 7, 4000);
    expect(d).toBe(0);
  });

  it("counts trailing days where rolling mean stays below threshold", () => {
    // 10 days of gradually declining values; last 7 are all below 4200.
    const series = synthSeries("2026-04-06", [
      5000, 5000, 5000, 4200, 4100, 4000, 3900, 3800, 3700, 3600,
    ]);
    const d = consecutiveDaysBelow(series, "2026-04-15", 7, 4200);
    expect(d).toBeGreaterThan(0);
  });

  it("consecutiveDaysAbove mirrors below for rising thresholds", () => {
    const series = synthSeries("2026-04-06", [
      3000, 3000, 3000, 4000, 4100, 4200, 4300, 4400, 4500, 4600,
    ]);
    const d = consecutiveDaysAbove(series, "2026-04-15", 7, 4000);
    expect(d).toBeGreaterThan(0);
  });

  it("stops counting at the first day the threshold isn't breached", () => {
    // Flat mid-range for 3 days, then below for 5 days, then flat again.
    const series = synthSeries("2026-04-02", [
      5000, 5000, 5000, 3000, 3000, 3000, 3000, 3000, 5000, 5000, 5000, 5000, 5000, 5000,
    ]);
    const d = consecutiveDaysBelow(series, "2026-04-15", 7, 4000);
    expect(d).toBe(0); // today's rolling mean (across last 7) is above 4000
  });
});
