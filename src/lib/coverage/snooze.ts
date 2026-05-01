import { db, now } from "~/lib/db/dexie";
import { TRACKED_FIELDS } from "~/config/tracked-fields";

// Snooze durations per tracked-field freshness band. The brief was
// "3d daily / 7d weekly / 14d fortnightly" — we map each tracked
// field's freshness window onto one of those buckets so the dismiss
// behaviour always feels proportionate.
function snoozeDaysFor(fieldKey: string): number {
  const f = TRACKED_FIELDS.find((tf) => tf.key === fieldKey);
  if (!f) return 3;
  if (f.freshness_days <= 1) return 3;
  if (f.freshness_days <= 7) return 7;
  return 14;
}

// Record a dismiss. Creates one new row per dismiss (history is
// preserved for audit / future engagement-aware tuning); the detector
// only cares about the most recent unexpired row per field_key.
export async function snoozeCoverageField(
  fieldKey: string,
  todayISO: string,
): Promise<void> {
  const days = snoozeDaysFor(fieldKey);
  const until = isoDaysAfter(todayISO, days);
  await db.coverage_snoozes.add({
    field_key: fieldKey,
    snoozed_at: now(),
    snoozed_until: until,
  });
}

function isoDaysAfter(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
