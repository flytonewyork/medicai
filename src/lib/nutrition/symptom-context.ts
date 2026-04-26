import { db } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import type { DailyEntry } from "~/types/clinical";

// Symptom-aware context for the food picker and JPCC playbooks.
// Reads today's DailyEntry (and yesterday's as a fallback so a
// freshly-loaded picker before the morning check-in still has
// signal) and decides whether to bias picker results toward
// easy-digest options. Also exposes the active taste-issue so the
// taste-tweak suggester can render the right quadrant.
//
// The bar is intentionally permissive — we recommend the easy-digest
// filter rather than enforce it, because the patient may want to log
// what they actually ate even on a bad day.

export type SymptomFlag =
  | "nausea"
  | "mucositis"
  | "diarrhoea"
  | "low_appetite"
  | "dry_mouth"
  | "early_satiety"
  | "taste_change";

export type TasteIssue =
  | "too_sweet"
  | "too_salty"
  | "too_bland"
  | "metallic"
  | "normal";

export interface NutritionSymptomContext {
  flags: SymptomFlag[];
  source_date?: string;
  recommendEasyDigest: boolean;
  taste_issue?: TasteIssue;
}

const NAUSEA_THRESHOLD = 4;
const APPETITE_LOW_THRESHOLD = 4;
const DIARRHOEA_THRESHOLD = 2;
const TASTE_CHANGES_THRESHOLD = 3;

export async function loadSymptomContext(
  date = todayISO(),
): Promise<NutritionSymptomContext> {
  const today = await loadDayEntry(date);
  const fallback = today ? null : await loadDayEntry(daysAgo(date, 1));
  const entry = today ?? fallback;
  if (!entry) {
    return { flags: [], recommendEasyDigest: false };
  }
  const flags = deriveFlags(entry);
  return {
    flags,
    source_date: entry.date,
    recommendEasyDigest: flags.length > 0,
    taste_issue: entry.taste_issue,
  };
}

export function deriveFlags(entry: DailyEntry): SymptomFlag[] {
  const flags: SymptomFlag[] = [];
  if ((entry.nausea ?? 0) >= NAUSEA_THRESHOLD) flags.push("nausea");
  if (entry.mouth_sores) flags.push("mucositis");
  if ((entry.diarrhoea_count ?? 0) >= DIARRHOEA_THRESHOLD) flags.push("diarrhoea");
  if (
    typeof entry.appetite === "number" &&
    entry.appetite <= APPETITE_LOW_THRESHOLD
  ) {
    flags.push("low_appetite");
  }
  if (entry.dry_mouth) flags.push("dry_mouth");
  if (entry.early_satiety) flags.push("early_satiety");
  if (
    (entry.taste_issue && entry.taste_issue !== "normal") ||
    (typeof entry.taste_changes === "number" &&
      entry.taste_changes >= TASTE_CHANGES_THRESHOLD)
  ) {
    flags.push("taste_change");
  }
  return flags;
}

async function loadDayEntry(date: string): Promise<DailyEntry | undefined> {
  return db.daily_entries.where("date").equals(date).first();
}

function daysAgo(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const SYMPTOM_LABEL: Record<
  SymptomFlag,
  { en: string; zh: string }
> = {
  nausea: { en: "nausea", zh: "恶心" },
  mucositis: { en: "mouth sores", zh: "口腔溃疡" },
  diarrhoea: { en: "diarrhoea", zh: "腹泻" },
  low_appetite: { en: "low appetite", zh: "食欲不振" },
  dry_mouth: { en: "dry mouth", zh: "口干" },
  early_satiety: { en: "early satiety", zh: "易饱" },
  taste_change: { en: "taste change", zh: "味觉改变" },
};
