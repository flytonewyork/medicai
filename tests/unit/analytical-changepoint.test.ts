import { describe, it, expect } from "vitest";
import { cusumPosterior } from "~/lib/state/analytical";
import {
  generateSyntheticSeries,
  ancCycleSignature,
} from "../fixtures/analytical/synthetic-cycles";
import { residualSeries } from "~/lib/state/analytical";

function makeResiduals(values: number[], startISO = "2026-01-01") {
  const start = Date.parse(startISO);
  return values.map((v, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    raw_value: v,
    expected_mean: 0,
    expected_sd: 1,
    value: v,
    source: "population" as const,
  }));
}

describe("analytical / cusumPosterior", () => {
  it("returns null when fewer than min_n residuals", () => {
    const r = makeResiduals([0.1, -0.2, 0.0]);
    expect(cusumPosterior(r, "2026-01-04")).toBeNull();
  });

  it("emits a low p_change for stationary noise", () => {
    // Pure noise around zero — should not trip the bands meaningfully.
    let p_max = 0;
    for (let seed = 0; seed < 30; seed++) {
      // Deterministic-ish noise: triangular-ish via sum of two sines.
      const values: number[] = [];
      for (let i = 0; i < 28; i++) {
        const v =
          0.5 * Math.sin((seed + 1) * i * 0.7) +
          0.3 * Math.cos((seed + 2) * i * 1.3);
        values.push(v);
      }
      const r = makeResiduals(values);
      const post = cusumPosterior(r, "2026-01-29");
      if (post && post.p_change > p_max) p_max = post.p_change;
    }
    // Stationary noise should not push p_change into the confirm band
    // (>= 0.55) for any of these deterministic seeds.
    expect(p_max).toBeLessThan(0.55);
  });

  it("detects a sustained negative shift of -1 SD", () => {
    // 14 days of zero-mean noise, then 14 days at -1 SD shift.
    const values: number[] = [];
    for (let i = 0; i < 14; i++) values.push(0.05 * (i % 3 - 1));
    for (let i = 0; i < 14; i++) values.push(-1.0 + 0.05 * (i % 3 - 1));
    const r = makeResiduals(values);
    const post = cusumPosterior(r, "2026-01-29");
    expect(post).not.toBeNull();
    if (!post) return;
    expect(post.p_change).toBeGreaterThan(0.55);
    expect(post.magnitude_sd).toBeLessThan(0);
    // Tau should land at or after the half-way mark.
    // tau_days_ago of N means the change-point lands N days before
    // asOf; for 28 obs starting 2026-01-01, asOf 2026-01-29, the
    // half-way obs is on 2026-01-15 (tau_days_ago = 14).
    expect(post.tau_days_ago).toBeLessThanOrEqual(14);
    expect(post.tau_days_ago).toBeGreaterThanOrEqual(0);
  });

  it("detects a sustained positive shift of +1 SD", () => {
    const values: number[] = [];
    for (let i = 0; i < 14; i++) values.push(0.05 * (i % 3 - 1));
    for (let i = 0; i < 14; i++) values.push(1.0 + 0.05 * (i % 3 - 1));
    const r = makeResiduals(values);
    const post = cusumPosterior(r, "2026-01-29");
    expect(post).not.toBeNull();
    if (!post) return;
    expect(post.p_change).toBeGreaterThan(0.55);
    expect(post.magnitude_sd).toBeGreaterThan(0);
  });

  it("returns method='cusum'", () => {
    const r = makeResiduals(Array.from({ length: 20 }, () => 0));
    const post = cusumPosterior(r, "2026-01-21");
    expect(post?.method).toBe("cusum");
  });

  it("respects custom thresholds (tighter bands raise p_change for the same input)", () => {
    // Values must clear k (default 0.5) to drive the CUSUM statistic.
    // -0.7 means r - k_pos = -1.2 (S+ stays at 0) and r + k_neg = -0.2
    // (S- accumulates at -0.2 per step). Over 7 steps, |S-| ≈ 1.4.
    const values = [
      0, 0, 0, 0, 0, 0, 0,
      -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7,
    ];
    const r = makeResiduals(values);
    const wide = cusumPosterior(r, "2026-01-15");
    const narrow = cusumPosterior(r, "2026-01-15", {
      quiet: 0.3,
      noise: 0.6,
      confirm: 1.0,
      fire: 2.0,
    });
    expect(wide).not.toBeNull();
    expect(narrow).not.toBeNull();
    if (!wide || !narrow) return;
    expect(narrow.p_change).toBeGreaterThan(wide.p_change);
  });

  it("does not fire when synthetic data tracks the population curve", () => {
    // Synthetic ANC that follows the literature curve (signature ≈
    // population mean) should yield residuals near N(0,1) and not
    // trip CUSUM above the noise band.
    const series = generateSyntheticSeries({
      metric_id: "anc",
      protocol_cycle_length_days: 28,
      n_cycles: 2,
      cycle1_start: "2026-01-01",
      baseline: 3.0,
      daily_noise_sd: 0.2,
      cycle_signature: ancCycleSignature,
      seed: 7,
    });
    const residuals = residualSeries({
      metric_id: "anc",
      observations: series.observations,
      cycles: series.cycles,
    });
    const post = cusumPosterior(residuals, "2026-02-26");
    expect(post).not.toBeNull();
    if (!post) return;
    expect(post.p_change).toBeLessThan(0.55);
  });
});
