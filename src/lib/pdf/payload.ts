import { db } from "~/lib/db/dexie";
import { buildSnapshot, highestZone } from "~/lib/rules/engine";
import { assessSarcopenia } from "~/lib/calculations/sarcopenia";
import type { ReportPayload } from "./pre-clinic-report";

export async function buildReportPayload(): Promise<ReportPayload> {
  const [
    settings,
    dailies,
    fortnightlies,
    weeklies,
    labs,
    alerts,
  ] = await Promise.all([
    db.settings.toArray(),
    db.daily_entries.orderBy("date").reverse().limit(14).toArray(),
    db.fortnightly_assessments.orderBy("assessment_date").reverse().limit(2).toArray(),
    db.weekly_assessments.orderBy("week_start").reverse().limit(1).toArray(),
    db.labs.orderBy("date").reverse().limit(5).toArray(),
    db.zone_alerts.toArray(),
  ]);

  const orderedDailies = dailies.slice().reverse();
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const snapshot = await buildSnapshot();
  const currentZone = highestZone(activeAlerts.map((a) => a.zone));
  const sarcopenia = assessSarcopenia(snapshot.latestFortnightly, settings[0] ?? null);

  const autoQuestions: string[] = [];
  for (const a of activeAlerts) {
    autoQuestions.push(`${a.rule_name} — ${a.recommendation}`);
  }

  return {
    generatedAt: new Date(),
    settings: settings[0] ?? null,
    currentZone,
    activeAlerts,
    last14Dailies: orderedDailies,
    latestFortnightly: fortnightlies[0] ?? null,
    priorFortnightly: fortnightlies[1] ?? null,
    latestWeekly: weeklies[0] ?? null,
    recentLabs: labs.slice().reverse(),
    sarcopenia,
    autoQuestions,
  };
}
