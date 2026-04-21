import { describe, it, expect } from "vitest";
import { evaluatePrompts } from "~/lib/medication/prompts";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import type { Medication } from "~/types/medication";
import type { ProtocolId, TreatmentCycle } from "~/types/treatment";

function cycle(overrides: Partial<TreatmentCycle> = {}): TreatmentCycle {
  return {
    id: 7,
    protocol_id: "gnp_weekly",
    cycle_number: 3,
    start_date: "2026-04-01",
    status: "active",
    dose_level: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function med(overrides: Partial<Medication>): Medication {
  return {
    drug_id: "gemcitabine",
    category: "chemo",
    dose: "1000 mg/m²",
    route: "IV",
    schedule: { kind: "cycle_linked", cycle_days: [1, 8, 15] },
    source: "protocol_agent",
    cycle_id: 7,
    active: true,
    started_on: "2026-04-01",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function gemMed(): Medication {
  return med({ drug_id: "gemcitabine" });
}
function nabMed(): Medication {
  return med({
    drug_id: "nab_paclitaxel",
    category: "chemo",
    dose: "125 mg/m²",
  });
}
function dexMed(): Medication {
  return med({
    drug_id: "dexamethasone",
    category: "steroid",
    dose: "8 mg",
    route: "PO",
    source: "protocol_supportive",
    schedule: { kind: "cycle_linked", cycle_days: [1, 2] },
  });
}

function ctxOn(
  cycle_day: number,
  active_meds: Medication[],
  protocol_id: ProtocolId = "gnp_weekly",
) {
  return {
    cycle: cycle({ protocol_id }),
    cycle_day,
    protocol_id,
    active_meds,
    drugs_by_id: DRUGS_BY_ID,
    existing_events: [],
  };
}

describe("medication prompts — gnp_d8_predose_bloods", () => {
  it("fires on D8 of GnP weekly with active gem + nab-p", () => {
    const prompts = evaluatePrompts(ctxOn(8, [gemMed(), nabMed()]));
    expect(prompts.map((p) => p.rule_id)).toContain("gnp_d8_predose_bloods");
    const p = prompts.find((p) => p.rule_id === "gnp_d8_predose_bloods")!;
    expect(p.cycle_day).toBe(8);
    expect(p.fired_for).toBe("cycle:7|day:8");
    expect(p.citations.length).toBeGreaterThan(0);
    // Primary citation is now eviQ 1375 (AU protocol); FDA label is secondary.
    const urls = p.citations.map((c) => c.url).join(" ");
    expect(urls).toContain("eviq.org.au");
    expect(urls).toContain("accessdata.fda.gov");
  });

  it("fires on D15 too", () => {
    const prompts = evaluatePrompts(ctxOn(15, [gemMed(), nabMed()]));
    const p = prompts.find((p) => p.rule_id === "gnp_d8_predose_bloods");
    expect(p).toBeTruthy();
    expect(p!.fired_for).toBe("cycle:7|day:15");
  });

  it("does not fire on D1, D9, or D22", () => {
    for (const d of [1, 9, 22]) {
      const prompts = evaluatePrompts(ctxOn(d, [gemMed(), nabMed()]));
      const ids = prompts.map((p) => p.rule_id);
      expect(ids).not.toContain("gnp_d8_predose_bloods");
    }
  });

  it("does not fire if no GnP backbone meds are active", () => {
    const prompts = evaluatePrompts(ctxOn(8, [dexMed()]));
    const ids = prompts.map((p) => p.rule_id);
    expect(ids).not.toContain("gnp_d8_predose_bloods");
  });

  it("does not fire on a non-GnP protocol", () => {
    const prompts = evaluatePrompts(ctxOn(8, [gemMed()], "mffx"));
    const ids = prompts.map((p) => p.rule_id);
    expect(ids).not.toContain("gnp_d8_predose_bloods");
  });

  it("is suppressed once acknowledged", () => {
    const baseCtx = ctxOn(8, [gemMed(), nabMed()]);
    const ctx = {
      ...baseCtx,
      existing_events: [
        {
          rule_id: "gnp_d8_predose_bloods",
          fired_for: "cycle:7|day:8",
          status: "acknowledged" as const,
          shown_at: "2026-04-08T08:00:00Z",
        },
      ],
    };
    const prompts = evaluatePrompts(ctx);
    expect(prompts.map((p) => p.rule_id)).not.toContain(
      "gnp_d8_predose_bloods",
    );
  });
});

describe("medication prompts — gnp_nadir_vigilance", () => {
  it("fires across the gemcitabine nadir window (D8–D15)", () => {
    for (const d of [8, 12, 15]) {
      const prompts = evaluatePrompts(ctxOn(d, [gemMed()]));
      const p = prompts.find((p) => p.rule_id === "gnp_nadir_vigilance");
      expect(p, `expected nadir prompt on D${d}`).toBeTruthy();
      expect(p!.severity).toBe("warning");
      expect(p!.fired_for).toBe("cycle:7|window:nadir");
    }
  });

  it("does not fire outside the nadir window", () => {
    for (const d of [1, 7, 16, 28]) {
      const prompts = evaluatePrompts(ctxOn(d, [gemMed()]));
      const ids = prompts.map((p) => p.rule_id);
      expect(ids).not.toContain("gnp_nadir_vigilance");
    }
  });

  it("dedup uses one fired_for per cycle", () => {
    const baseCtx = ctxOn(12, [gemMed()]);
    const ctx = {
      ...baseCtx,
      existing_events: [
        {
          rule_id: "gnp_nadir_vigilance",
          fired_for: "cycle:7|window:nadir",
          status: "dismissed" as const,
          shown_at: "2026-04-09T08:00:00Z",
        },
      ],
    };
    const prompts = evaluatePrompts(ctx);
    const ids = prompts.map((p) => p.rule_id);
    expect(ids).not.toContain("gnp_nadir_vigilance");
  });
});

describe("medication prompts — dex_post_pulse_mood", () => {
  it("fires on D3, D4, D5 when chemo-day dex is active", () => {
    for (const d of [3, 4, 5]) {
      const prompts = evaluatePrompts(ctxOn(d, [gemMed(), dexMed()]));
      const p = prompts.find((p) => p.rule_id === "dex_post_pulse_mood");
      expect(p, `expected dex prompt on D${d}`).toBeTruthy();
      expect(p!.fired_for).toBe(`cycle:7|day:${d}`);
      expect(p!.citations[0].url).toContain("nature.com");
    }
  });

  it("does not fire on D2 or D6", () => {
    for (const d of [2, 6]) {
      const prompts = evaluatePrompts(ctxOn(d, [gemMed(), dexMed()]));
      const ids = prompts.map((p) => p.rule_id);
      expect(ids).not.toContain("dex_post_pulse_mood");
    }
  });

  it("does not fire when dex is not in active meds", () => {
    const prompts = evaluatePrompts(ctxOn(4, [gemMed()]));
    const ids = prompts.map((p) => p.rule_id);
    expect(ids).not.toContain("dex_post_pulse_mood");
  });
});

describe("medication prompts — registry integrity (2b.0 ground truth)", () => {
  it("narmafotinib registry uses once-daily dosing (corrected from BID)", () => {
    const drug = DRUGS_BY_ID["narmafotinib"];
    expect(drug).toBeTruthy();
    expect(drug.default_schedules[0].times_per_day).toBe(1);
    expect(drug.typical_doses[0].en).toMatch(/once daily/i);
  });

  it("each drug with prompt_facts has at least one cited reference", () => {
    for (const id of [
      "gemcitabine",
      "nab_paclitaxel",
      "dexamethasone",
      "narmafotinib",
    ]) {
      const drug = DRUGS_BY_ID[id];
      expect(drug.references?.length ?? 0).toBeGreaterThan(0);
    }
    for (const [id, fact] of [
      ["gemcitabine", DRUGS_BY_ID["gemcitabine"].prompt_facts?.nadir],
      ["nab_paclitaxel", DRUGS_BY_ID["nab_paclitaxel"].prompt_facts?.nadir],
      [
        "dexamethasone",
        DRUGS_BY_ID["dexamethasone"].prompt_facts?.steroid_crash,
      ],
    ] as const) {
      expect(fact, `${id} missing prompt_fact`).toBeTruthy();
      expect(fact!.source_refs.length).toBeGreaterThan(0);
      const drug = DRUGS_BY_ID[id];
      for (const ref of fact!.source_refs) {
        expect(drug.references![ref]).toBeTruthy();
      }
    }
  });
});
