import { describe, it, expect } from "vitest";
import {
  movingAverage,
  percentChange,
  linearSlope,
  consecutiveRising,
} from "~/lib/calculations/trends";
import { phq9Score, gad7Score, phq9Severity, gad7Severity } from "~/lib/calculations/scoring";

describe("movingAverage", () => {
  it("returns trailing window mean", () => {
    const out = movingAverage([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeCloseTo(1);
    expect(out[1]).toBeCloseTo(1.5);
    expect(out[2]).toBeCloseTo(2);
    expect(out[4]).toBeCloseTo(4);
  });
});

describe("percentChange", () => {
  it("handles baseline zero safely", () => {
    expect(percentChange(0, 10)).toBe(0);
  });
  it("computes positive change", () => {
    expect(percentChange(80, 72)).toBeCloseTo(-10);
  });
});

describe("linearSlope", () => {
  it("returns 0 with <2 points", () => {
    expect(linearSlope([5])).toBe(0);
  });
  it("returns positive slope for rising series", () => {
    expect(linearSlope([1, 2, 3, 4])).toBeCloseTo(1);
  });
});

describe("consecutiveRising", () => {
  it("counts monotonic rise", () => {
    expect(consecutiveRising([1, 2, 3])).toBe(3);
  });
  it("resets on dip", () => {
    expect(consecutiveRising([1, 2, 1, 2, 3])).toBe(3);
  });
});

describe("PHQ-9 / GAD-7 scoring", () => {
  it("sums PHQ-9 responses", () => {
    expect(phq9Score([1, 2, 3, 0, 0, 0, 0, 0, 0])).toBe(6);
  });
  it("rejects wrong length", () => {
    expect(() => phq9Score([1, 2, 3])).toThrow();
  });
  it("categorises PHQ-9 severity", () => {
    expect(phq9Severity(3)).toBe("minimal");
    expect(phq9Severity(7)).toBe("mild");
    expect(phq9Severity(12)).toBe("moderate");
    expect(phq9Severity(17)).toBe("moderately-severe");
    expect(phq9Severity(22)).toBe("severe");
  });
  it("categorises GAD-7 severity", () => {
    expect(gad7Severity(2)).toBe("minimal");
    expect(gad7Severity(7)).toBe("mild");
    expect(gad7Severity(12)).toBe("moderate");
    expect(gad7Severity(17)).toBe("severe");
  });
  it("sums GAD-7", () => {
    expect(gad7Score([1, 1, 1, 1, 1, 1, 1])).toBe(7);
  });
});
