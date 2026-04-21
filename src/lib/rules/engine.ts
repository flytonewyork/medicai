import { db, now } from "~/lib/db/dexie";
import type { ClinicalSnapshot, ZoneRule } from "./types";
import { ZONE_RULES } from "./zone-rules";
import type { Zone } from "~/types/clinical";

export async function buildSnapshot(): Promise<ClinicalSnapshot> {
  const [
    settings,
    dailies,
    weeklies,
    fortnightlies,
    labs,
    pending,
  ] = await Promise.all([
    db.settings.toArray(),
    db.daily_entries.orderBy("date").reverse().limit(30).toArray(),
    db.weekly_assessments.orderBy("week_start").reverse().limit(8).toArray(),
    db.fortnightly_assessments.orderBy("assessment_date").reverse().limit(4).toArray(),
    db.labs.orderBy("date").limit(12).toArray(),
    db.pending_results.toArray(),
  ]);

  const orderedDailies = dailies.slice().reverse();
  const openPending = pending.filter((p) => !p.received);

  return {
    settings: settings[0] ?? null,
    latestDaily: orderedDailies[orderedDailies.length - 1] ?? null,
    recentDailies: orderedDailies,
    recentWeeklies: weeklies.slice().reverse(),
    latestFortnightly: fortnightlies[0] ?? null,
    recentLabs: labs,
    openPendingResults: openPending,
    now: new Date(),
  };
}

export function evaluateRules(
  snapshot: ClinicalSnapshot,
  rules: ZoneRule[] = ZONE_RULES,
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

export async function runEngineAndPersist(): Promise<Zone> {
  const snapshot = await buildSnapshot();
  const triggered = evaluateRules(snapshot);
  const triggeredAt = now();

  const openAlerts = (await db.zone_alerts.toArray()).filter((a) => !a.resolved);
  const openMap = new Map(openAlerts.map((a) => [a.rule_id, a]));

  for (const rule of triggered) {
    if (openMap.has(rule.id)) continue;
    await db.zone_alerts.add({
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

  const activeZones: Zone[] = triggered.map((r) => r.zone);
  return highestZone(activeZones);
}
