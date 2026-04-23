import { db } from "~/lib/db/dexie";
import {
  latestDailyEntries,
  latestFortnightlyAssessments,
  latestLabs,
  latestWeeklyAssessments,
} from "~/lib/db/queries";
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
    latestDailyEntries(14),
    latestFortnightlyAssessments(2),
    latestWeeklyAssessments(1),
    latestLabs(5),
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
