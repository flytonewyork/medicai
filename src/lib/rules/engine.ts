import { db, now } from "~/lib/db/dexie";
import {
  latestDailyEntries,
  latestFortnightlyAssessments,
  latestLabs,
  latestWeeklyAssessments,
} from "~/lib/db/queries";
import type { ClinicalSnapshot, ZoneRule } from "./types";
import { ZONE_RULES } from "./zone-rules";
import { ZONE_RULES_V2 } from "./zone-rules-v2";
import { buildPatientState } from "~/lib/state";
import type { Zone, ZoneAlert } from "~/types/clinical";
import type { Table } from "dexie";

export async function buildSnapshot(): Promise<ClinicalSnapshot> {
  const [
    settings,
    dailies,
    weeklies,
    fortnightlies,
    labs,
    pending,
    cycles,
  ] = await Promise.all([
    db.settings.toArray(),
    // Wider windows than the rules strictly need so the patient_state module
    // has enough history to build rolling_28d baselines and 28d slopes.
    latestDailyEntries(60),
    latestWeeklyAssessments(8),
    latestFortnightlyAssessments(6),
    latestLabs(30),
    db.pending_results.toArray(),
    db.treatment_cycles.toArray(),
  ]);

  const orderedDailies = dailies.slice().reverse();
  const orderedLabs = labs.slice().reverse();
  const orderedFortnightlies = fortnightlies.slice().reverse();
  const openPending = pending.filter((p) => !p.received);
  const asOf = new Date();
  const settingsRow = settings[0] ?? null;

  const patient_state = buildPatientState({
    as_of: asOf.toISOString(),
    settings: settingsRow,
    dailies: orderedDailies,
    fortnightlies: orderedFortnightlies,
    labs: orderedLabs,
    cycles,
  });

  return {
    settings: settingsRow,
    latestDaily: orderedDailies[orderedDailies.length - 1] ?? null,
    recentDailies: orderedDailies,
    recentWeeklies: weeklies.slice().reverse(),
    latestFortnightly: fortnightlies[0] ?? null,
    recentLabs: orderedLabs,
    openPendingResults: openPending,
    now: asOf,
    patient_state,
  };
}

export function evaluateRules(
  snapshot: ClinicalSnapshot,
  rules: readonly ZoneRule[] = ZONE_RULES,
): ZoneRule[] {
  const triggered: ZoneRule[] = [];
  for (const rule of rules) {
    try {
      if (rule.evaluator(snapshot)) triggered.push(rule);
    } catch (_err) {
      // rule evaluation must never crash the engine
    }
  }
  return triggered;
}

export function highestZone(zones: Zone[]): Zone {
  const order: Zone[] = ["red", "orange", "yellow", "green"];
  for (const z of order) {
    if (zones.includes(z)) return z;
  }
  return "green";
}

// Persist newly-triggered rules into the given table, deduped against
// the existing open alerts in that table. Used for both the live
// (`zone_alerts`) and shadow (`zone_alerts_shadow`) write paths.
async function persistTriggered(
  table: Table<ZoneAlert, number>,
  triggered: readonly ZoneRule[],
  triggeredAt: string,
): Promise<void> {
  const openAlerts = (await table.toArray()).filter((a) => !a.resolved);
  const openMap = new Map(openAlerts.map((a) => [a.rule_id, a]));
  for (const rule of triggered) {
    if (openMap.has(rule.id)) continue;
    await table.add({
      rule_id: rule.id,
      rule_name: rule.name,
      zone: rule.zone,
      category: rule.category,
      triggered_at: triggeredAt,
      resolved: false,
      acknowledged: false,
      recommendation: rule.recommendation,
      recommendation_zh: rule.recommendationZh,
      suggested_levers: rule.suggestedLevers,
      created_at: triggeredAt,
      updated_at: triggeredAt,
    });
  }
}

export async function runEngineAndPersist(): Promise<Zone> {
  const snapshot = await buildSnapshot();
  const triggered = evaluateRules(snapshot);
  const triggeredAt = now();

  await persistTriggered(db.zone_alerts, triggered, triggeredAt);

  // Shadow write — V2 rule set. Initially identical to V1 (Phase 2);
  // diverges as Phase 3 migrates individual rules to consume the
  // analytical helpers. Patient feed never reads from this table.
  // Failures are isolated: a bug in V2 must not affect the live alert
  // path that Hu Lin actually sees.
  try {
    const triggeredV2 = evaluateRules(snapshot, ZONE_RULES_V2);
    await persistTriggered(db.zone_alerts_shadow, triggeredV2, triggeredAt);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[engine] V2 shadow eval failed:", err);
  }

  const activeZones: Zone[] = triggered.map((r) => r.zone);
  return highestZone(activeZones);
}
