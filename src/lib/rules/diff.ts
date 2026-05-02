// Diff helper for the V1 ↔ V2 rule-engine shadow rollout. Compares the
// alert streams in `zone_alerts` (live, V1) and `zone_alerts_shadow`
// (V2) and groups discrepancies by rule_id so Thomas can audit them.
//
// Used by:
//  - the Phase 4 validation review (the diff dashboard he walks before
//    approving the V2 flip — built in Phase 4 atop this helper)
//  - any future regression check ("did this PR change V2 behaviour vs
//    V1 over the last cycle?")
//
// Pure over its inputs. The Dexie reads stay in the page that calls
// this helper so the function itself remains synchronously testable.
import type { ZoneAlert } from "~/types/clinical";

export interface RuleDiffEntry {
  rule_id: string;
  // Latest V1 alert for this rule (or null if V1 never fired it in
  // the window).
  v1_latest: ZoneAlert | null;
  // Latest V2 alert for this rule (or null if V2 never fired it).
  v2_latest: ZoneAlert | null;
  // Categorisation of the discrepancy:
  //   - "v1_only"  V1 fired but V2 didn't (V2 missed something — bad
  //                if it's a real signal)
  //   - "v2_only"  V2 fired but V1 didn't (V2 caught something new —
  //                good if it's real, bad if false positive)
  //   - "zone_differs"  both fired but at different zones
  //   - "v2_earlier"  both fired the same zone but V2's first
  //                triggered_at is earlier than V1's (V2 caught it
  //                sooner — usually good)
  //   - "v2_later"  reverse of above
  kind:
    | "v1_only"
    | "v2_only"
    | "zone_differs"
    | "v2_earlier"
    | "v2_later";
}

export interface RuleDiff {
  entries: RuleDiffEntry[];
  // Convenience counts for headline display.
  counts: {
    v1_only: number;
    v2_only: number;
    zone_differs: number;
    v2_earlier: number;
    v2_later: number;
  };
}

interface DiffArgs {
  v1Alerts: readonly ZoneAlert[];
  v2Alerts: readonly ZoneAlert[];
  // ISO date — alerts triggered before this are excluded. Defaults to
  // 30 days before `now` if omitted; pass an explicit date for
  // deterministic tests.
  sinceISO: string;
}

function latestByRule(alerts: readonly ZoneAlert[]): Map<string, ZoneAlert> {
  const out = new Map<string, ZoneAlert>();
  for (const a of alerts) {
    const prev = out.get(a.rule_id);
    if (!prev || Date.parse(a.triggered_at) > Date.parse(prev.triggered_at)) {
      out.set(a.rule_id, a);
    }
  }
  return out;
}

function earliestByRule(
  alerts: readonly ZoneAlert[],
): Map<string, ZoneAlert> {
  const out = new Map<string, ZoneAlert>();
  for (const a of alerts) {
    const prev = out.get(a.rule_id);
    if (!prev || Date.parse(a.triggered_at) < Date.parse(prev.triggered_at)) {
      out.set(a.rule_id, a);
    }
  }
  return out;
}

export function computeRuleEngineDiff(args: DiffArgs): RuleDiff {
  const sinceMs = Date.parse(args.sinceISO);
  const inWindow = (a: ZoneAlert) => {
    const t = Date.parse(a.triggered_at);
    return !Number.isNaN(t) && t >= sinceMs;
  };
  const v1 = args.v1Alerts.filter(inWindow);
  const v2 = args.v2Alerts.filter(inWindow);

  const v1Latest = latestByRule(v1);
  const v2Latest = latestByRule(v2);
  const v1Earliest = earliestByRule(v1);
  const v2Earliest = earliestByRule(v2);

  const ruleIds = new Set<string>([
    ...v1Latest.keys(),
    ...v2Latest.keys(),
  ]);

  const entries: RuleDiffEntry[] = [];
  const counts = {
    v1_only: 0,
    v2_only: 0,
    zone_differs: 0,
    v2_earlier: 0,
    v2_later: 0,
  };

  for (const ruleId of ruleIds) {
    const v1L = v1Latest.get(ruleId) ?? null;
    const v2L = v2Latest.get(ruleId) ?? null;

    let kind: RuleDiffEntry["kind"];
    if (v1L && !v2L) {
      kind = "v1_only";
      counts.v1_only += 1;
    } else if (!v1L && v2L) {
      kind = "v2_only";
      counts.v2_only += 1;
    } else if (v1L && v2L && v1L.zone !== v2L.zone) {
      kind = "zone_differs";
      counts.zone_differs += 1;
    } else if (v1L && v2L) {
      // Same zone — compare earliest fire times to spot lead/lag.
      const e1 = v1Earliest.get(ruleId)!;
      const e2 = v2Earliest.get(ruleId)!;
      const dt = Date.parse(e2.triggered_at) - Date.parse(e1.triggered_at);
      if (dt < 0) {
        kind = "v2_earlier";
        counts.v2_earlier += 1;
      } else if (dt > 0) {
        kind = "v2_later";
        counts.v2_later += 1;
      } else {
        // Identical first-fire — not a discrepancy worth surfacing.
        continue;
      }
    } else {
      continue;
    }

    entries.push({ rule_id: ruleId, v1_latest: v1L, v2_latest: v2L, kind });
  }

  // Sort: v1_only / v2_only first (most clinically interesting), then
  // zone_differs, then earlier/later.
  const order: Record<RuleDiffEntry["kind"], number> = {
    v1_only: 0,
    v2_only: 1,
    zone_differs: 2,
    v2_earlier: 3,
    v2_later: 4,
  };
  entries.sort((a, b) => {
    const d = order[a.kind] - order[b.kind];
    if (d !== 0) return d;
    return a.rule_id.localeCompare(b.rule_id);
  });

  return { entries, counts };
}

// Convenience: ISO date 30 days before `now`. Used as the default
// window by callers that don't want to pick an explicit `sinceISO`.
export function defaultDiffWindowStart(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString();
}
