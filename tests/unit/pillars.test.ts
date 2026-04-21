import { describe, it, expect } from "vitest";
import { computePillars } from "~/lib/calculations/pillars";

describe("computePillars", () => {
  it("high scores when everything near-perfect", () => {
    const p = computePillars({
      ecog_self: 0,
      grip_dominant_kg: 42,
      gait_speed_ms: 1.3,
      sit_to_stand_30s: 15,
      sts_5x_seconds: 9,
      tug_seconds: 9,
      single_leg_stance_seconds: 30,
      sarc_f_total: 0,
      weight_kg: 80,
      pain_worst: 0,
      pain_interference: 0,
      fatigue_severity: 1,
      fatigue_interference: 0,
      appetite_rating: 8,
      nausea_severity: 0,
      vomiting_frequency: 0,
      diarrhoea_frequency: 0,
      constipation_severity: 0,
      jaundice: false,
      pruritus_severity: 0,
      dyspnoea_severity: 0,
      cough_severity: 0,
      fever_recent: false,
      night_sweats: false,
      neuropathy_grade_overall: 0,
      cold_dysaesthesia_severity: 0,
      mucositis_severity: 0,
      cognitive_concern: 0,
      skin_changes: false,
      nail_changes: false,
      easy_bruising: false,
      phq9_total: 2,
      gad7_total: 1,
      distress_thermometer: 2,
      sleep_quality: 8,
      facitsp_responses: Array(12).fill(3),
      facitsp_total: 36,
      practice_days_past_week: 7,
    }, 80);
    expect(p.functional_score).toBeGreaterThan(85);
    expect(p.symptom_score).toBeGreaterThan(85);
    expect(p.toxicity_score).toBeGreaterThan(85);
    expect(p.anchor_index).toBeGreaterThan(80);
  });

  it("drops functional score on ECOG 3 + low grip + slow gait", () => {
    const p = computePillars({
      ecog_self: 3,
      grip_dominant_kg: 14,
      gait_speed_ms: 0.5,
      sarc_f_total: 8,
    });
    expect(p.functional_score).toBeLessThan(40);
  });

  it("drops symptom score with severe pain + fatigue", () => {
    const p = computePillars({
      pain_worst: 9,
      pain_interference: 8,
      fatigue_severity: 8,
      fatigue_interference: 8,
      appetite_rating: 2,
    });
    expect(p.symptom_score).toBeLessThan(35);
  });

  it("drops toxicity score with grade 3 neuropathy", () => {
    const p = computePillars({
      neuropathy_grade_overall: 3,
      cold_dysaesthesia_severity: 7,
      cognitive_concern: 6,
    });
    expect(p.toxicity_score).toBeLessThanOrEqual(50);
  });

  it("weights function highest in composite", () => {
    const highFunction = computePillars({
      ecog_self: 0,
      grip_dominant_kg: 45,
      gait_speed_ms: 1.3,
      sarc_f_total: 0,
      pain_worst: 8,
      fatigue_severity: 8,
      neuropathy_grade_overall: 3,
    });
    const lowFunction = computePillars({
      ecog_self: 3,
      grip_dominant_kg: 15,
      gait_speed_ms: 0.5,
      sarc_f_total: 8,
      pain_worst: 1,
      fatigue_severity: 1,
      neuropathy_grade_overall: 0,
    });
    expect(highFunction.anchor_index).toBeGreaterThan(lowFunction.anchor_index);
  });

  it("handles empty payload gracefully", () => {
    const p = computePillars({});
    expect(p).toBeTruthy();
    expect(Number.isFinite(p.anchor_index)).toBe(true);
  });
});
