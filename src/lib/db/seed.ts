import { db, now } from "./dexie";
import trialWatchlist from "~/config/trial-watchlist.json";

export async function ensureSeeded(): Promise<void> {
  // Settings row is created by the onboarding wizard on first run.
  // We don't auto-seed a placeholder — "no settings row (or onboarded_at
  // missing)" is what triggers the onboarding gate on the dashboard.

  const trialsCount = await db.trials.count();
  if (trialsCount === 0) {
    const all = [
      ...trialWatchlist.primary_trials,
      ...trialWatchlist.secondary_trials,
    ];
    for (const t of all) {
      await db.trials.add({
        trial_id: t.trial_id,
        name: t.name,
        sponsor: "sponsor" in t ? t.sponsor : undefined,
        phase: "phase" in t ? t.phase : undefined,
        line: "line" in t ? t.line : undefined,
        drug: "drug" in t ? t.drug : undefined,
        status: ("status" in t ? t.status : "pending") as
          | "enrolling"
          | "closed"
          | "pending"
          | "active"
          | "completed",
        site: "site" in t ? t.site : undefined,
        eligibility_summary:
          "eligibility_summary" in t ? t.eligibility_summary : undefined,
        disqualifying_events:
          "disqualifying_events" in t ? t.disqualifying_events : undefined,
        priority: t.priority,
        created_at: now(),
        updated_at: now(),
      });
    }
  }
}
