import { describe, it, expect } from "vitest";
import { computeRuleEngineDiff } from "~/lib/rules/diff";
import type { ZoneAlert } from "~/types/clinical";

function alert(args: {
  id: number;
  rule_id: string;
  zone: ZoneAlert["zone"];
  triggered_at: string;
}): ZoneAlert {
  return {
    id: args.id,
    rule_id: args.rule_id,
    rule_name: args.rule_id,
    zone: args.zone,
    category: "function",
    triggered_at: args.triggered_at,
    resolved: false,
    acknowledged: false,
    recommendation: "",
    recommendation_zh: "",
    suggested_levers: [],
    created_at: args.triggered_at,
    updated_at: args.triggered_at,
  };
}

const SINCE = "2026-04-01T00:00:00Z";

describe("computeRuleEngineDiff", () => {
  it("returns zero entries when V1 and V2 are identical", () => {
    const a = alert({
      id: 1,
      rule_id: "grip_decline_10_20_yellow",
      zone: "yellow",
      triggered_at: "2026-04-15T12:00:00Z",
    });
    const diff = computeRuleEngineDiff({
      v1Alerts: [a],
      v2Alerts: [
        alert({
          id: 2,
          rule_id: "grip_decline_10_20_yellow",
          zone: "yellow",
          triggered_at: "2026-04-15T12:00:00Z",
        }),
      ],
      sinceISO: SINCE,
    });
    expect(diff.entries).toEqual([]);
    expect(diff.counts.v1_only).toBe(0);
    expect(diff.counts.v2_only).toBe(0);
  });

  it("flags v1_only when V1 fires a rule V2 doesn't", () => {
    const diff = computeRuleEngineDiff({
      v1Alerts: [
        alert({
          id: 1,
          rule_id: "weight_loss_5_10_yellow",
          zone: "yellow",
          triggered_at: "2026-04-15T12:00:00Z",
        }),
      ],
      v2Alerts: [],
      sinceISO: SINCE,
    });
    expect(diff.counts.v1_only).toBe(1);
    expect(diff.entries[0]?.kind).toBe("v1_only");
    expect(diff.entries[0]?.rule_id).toBe("weight_loss_5_10_yellow");
    expect(diff.entries[0]?.v2_latest).toBeNull();
  });

  it("flags v2_only when V2 fires a rule V1 doesn't", () => {
    const diff = computeRuleEngineDiff({
      v1Alerts: [],
      v2Alerts: [
        alert({
          id: 2,
          rule_id: "grip_chronic_drift_yellow",
          zone: "yellow",
          triggered_at: "2026-04-15T12:00:00Z",
        }),
      ],
      sinceISO: SINCE,
    });
    expect(diff.counts.v2_only).toBe(1);
    expect(diff.entries[0]?.kind).toBe("v2_only");
    expect(diff.entries[0]?.v1_latest).toBeNull();
  });

  it("flags zone_differs when both fire but at different zones", () => {
    const diff = computeRuleEngineDiff({
      v1Alerts: [
        alert({
          id: 1,
          rule_id: "grip_decline_10_20_yellow",
          zone: "yellow",
          triggered_at: "2026-04-15T12:00:00Z",
        }),
      ],
      v2Alerts: [
        alert({
          id: 2,
          rule_id: "grip_decline_10_20_yellow",
          zone: "orange",
          triggered_at: "2026-04-15T12:00:00Z",
        }),
      ],
      sinceISO: SINCE,
    });
    expect(diff.counts.zone_differs).toBe(1);
    expect(diff.entries[0]?.kind).toBe("zone_differs");
  });

  it("flags v2_earlier when V2's earliest fire predates V1's", () => {
    const diff = computeRuleEngineDiff({
      v1Alerts: [
        alert({
          id: 1,
          rule_id: "steps_chronic_decline_yellow",
          zone: "yellow",
          triggered_at: "2026-04-20T12:00:00Z",
        }),
      ],
      v2Alerts: [
        alert({
          id: 2,
          rule_id: "steps_chronic_decline_yellow",
          zone: "yellow",
          triggered_at: "2026-04-12T12:00:00Z",
        }),
      ],
      sinceISO: SINCE,
    });
    expect(diff.counts.v2_earlier).toBe(1);
    expect(diff.entries[0]?.kind).toBe("v2_earlier");
  });

  it("excludes alerts triggered before sinceISO", () => {
    const diff = computeRuleEngineDiff({
      v1Alerts: [
        alert({
          id: 1,
          rule_id: "old_rule",
          zone: "yellow",
          triggered_at: "2026-03-01T00:00:00Z",
        }),
      ],
      v2Alerts: [],
      sinceISO: SINCE,
    });
    expect(diff.entries).toEqual([]);
  });

  it("uses the LATEST alert per rule for the latest fields, EARLIEST for lead/lag", () => {
    const diff = computeRuleEngineDiff({
      v1Alerts: [
        alert({
          id: 1,
          rule_id: "neuropathy_grade_2_yellow",
          zone: "yellow",
          triggered_at: "2026-04-05T00:00:00Z",
        }),
        alert({
          id: 2,
          rule_id: "neuropathy_grade_2_yellow",
          zone: "yellow",
          triggered_at: "2026-04-20T00:00:00Z",
        }),
      ],
      v2Alerts: [
        alert({
          id: 3,
          rule_id: "neuropathy_grade_2_yellow",
          zone: "yellow",
          triggered_at: "2026-04-03T00:00:00Z",
        }),
        alert({
          id: 4,
          rule_id: "neuropathy_grade_2_yellow",
          zone: "yellow",
          triggered_at: "2026-04-22T00:00:00Z",
        }),
      ],
      sinceISO: SINCE,
    });
    // V2's earliest (Apr 3) is before V1's earliest (Apr 5) → v2_earlier.
    expect(diff.counts.v2_earlier).toBe(1);
    // Latest fields point at the latest alerts in each set.
    expect(diff.entries[0]?.v1_latest?.id).toBe(2);
    expect(diff.entries[0]?.v2_latest?.id).toBe(4);
  });

  it("orders v1_only / v2_only ahead of zone_differs and lead/lag", () => {
    const diff = computeRuleEngineDiff({
      v1Alerts: [
        alert({
          id: 1,
          rule_id: "rule_lead",
          zone: "yellow",
          triggered_at: "2026-04-20T00:00:00Z",
        }),
        alert({
          id: 2,
          rule_id: "rule_zone",
          zone: "yellow",
          triggered_at: "2026-04-20T00:00:00Z",
        }),
        alert({
          id: 3,
          rule_id: "rule_v1only",
          zone: "yellow",
          triggered_at: "2026-04-20T00:00:00Z",
        }),
      ],
      v2Alerts: [
        alert({
          id: 4,
          rule_id: "rule_lead",
          zone: "yellow",
          triggered_at: "2026-04-15T00:00:00Z",
        }),
        alert({
          id: 5,
          rule_id: "rule_zone",
          zone: "orange",
          triggered_at: "2026-04-20T00:00:00Z",
        }),
      ],
      sinceISO: SINCE,
    });
    // Order: v1_only first, then zone_differs, then v2_earlier.
    const kinds = diff.entries.map((e) => e.kind);
    expect(kinds).toEqual(["v1_only", "zone_differs", "v2_earlier"]);
  });
});
