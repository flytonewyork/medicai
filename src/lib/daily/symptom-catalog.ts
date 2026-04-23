import type { DailyEntry } from "~/types/clinical";

// The curated PDAC / GnP symptom catalog. Each entry is one checkable
// item on the daily-wizard "Symptoms" step. The catalog is the single
// source of truth — both the wizard UI and the Settings customiser read
// from it, so adding a new symptom is a one-line change here.
//
// Design notes
// ------------
// - `scale` drives the input widget: boolean toggle, count input,
//   0–10 slider, CTCAE 0–4 chip row, or 0–5 half-scale.
// - `tags` drive context-aware surfacing (see `shouldHighlight()`):
//   `gnp` = gemcitabine + nab-paclitaxel specific toxicity
//   `chemo` = generic chemotherapy side effect
//   `pdac` = pancreatic-cancer specific complaint
//   `pert` = signals PERT (Creon) dose issue
//   `safety` = sentinel that may warrant urgent review
// - `dailyEntryField` maps to the existing column on daily_entries when
//   there is one. For new symptoms (fatigue, anorexia, abdominal_pain,
//   steatorrhoea, taste_changes) the field is added in this PR.
// - `defaultTracked` is whether a brand-new user sees this symptom in
//   their daily list. Keep this tight — we want ~8 defaults, not 15.

export type SymptomScale =
  | "boolean"
  | "count"
  | "0_to_5"
  | "0_to_10"
  | "ctcae_0_4";

export type SymptomTag =
  | "pdac"
  | "chemo"
  | "gnp"
  | "pert"
  | "safety";

export interface SymptomDefinition {
  id: string;
  label: { en: string; zh: string };
  hint?: { en: string; zh: string };
  scale: SymptomScale;
  tags: readonly SymptomTag[];
  defaultTracked: boolean;
  // Column on daily_entries this symptom writes to, if one already
  // exists. New additions use their own column.
  dailyEntryField: keyof DailyEntry;
}

export const SYMPTOM_CATALOG: readonly SymptomDefinition[] = [
  // --- Top-10 defaults (tracked on first install) ----------------------
  {
    id: "fatigue",
    label: { en: "Fatigue", zh: "疲乏" },
    hint: {
      en: "How heavy or drained does today feel?",
      zh: "今天身体有多沉重或疲乏？",
    },
    scale: "0_to_10",
    tags: ["chemo", "pdac"],
    defaultTracked: true,
    dailyEntryField: "fatigue",
  },
  {
    id: "nausea",
    label: { en: "Nausea", zh: "恶心" },
    scale: "0_to_10",
    tags: ["chemo"],
    defaultTracked: true,
    dailyEntryField: "nausea",
  },
  {
    id: "anorexia",
    label: { en: "Appetite loss", zh: "食欲减退" },
    hint: {
      en: "0 = normal appetite · 10 = can't eat.",
      zh: "0 = 食欲正常 · 10 = 难以进食。",
    },
    scale: "0_to_10",
    tags: ["pdac", "chemo"],
    defaultTracked: true,
    dailyEntryField: "anorexia",
  },
  {
    id: "diarrhoea_count",
    label: { en: "Loose stools today", zh: "今日稀便次数" },
    scale: "count",
    tags: ["chemo", "pert"],
    defaultTracked: true,
    dailyEntryField: "diarrhoea_count",
  },
  {
    id: "neuropathy_feet",
    label: { en: "Foot neuropathy", zh: "足部神经病变" },
    hint: {
      en: "CTCAE 0–4. 1 = mild tingling, 2 = interferes with fine tasks, 3 = limits self-care.",
      zh: "CTCAE 0–4。1 = 轻微麻痛，2 = 影响精细动作，3 = 影响日常自理。",
    },
    scale: "ctcae_0_4",
    tags: ["gnp"],
    defaultTracked: true,
    dailyEntryField: "neuropathy_feet",
  },
  {
    id: "neuropathy_hands",
    label: { en: "Hand neuropathy", zh: "手部神经病变" },
    scale: "ctcae_0_4",
    tags: ["gnp"],
    defaultTracked: true,
    dailyEntryField: "neuropathy_hands",
  },
  {
    id: "abdominal_pain",
    label: { en: "Abdominal pain", zh: "腹痛" },
    scale: "0_to_10",
    tags: ["pdac"],
    defaultTracked: true,
    dailyEntryField: "abdominal_pain",
  },
  {
    id: "mouth_sores",
    label: { en: "Mouth sores", zh: "口腔溃疡" },
    scale: "boolean",
    tags: ["chemo"],
    defaultTracked: true,
    dailyEntryField: "mouth_sores",
  },
  {
    id: "fever",
    label: { en: "Fever", zh: "发热" },
    hint: {
      en: "≥ 38 °C on chemo = hospital assessment. Temperature is captured separately.",
      zh: "化疗期间体温 ≥ 38 °C = 需到医院评估。体温另行录入。",
    },
    scale: "boolean",
    tags: ["safety", "chemo"],
    defaultTracked: true,
    dailyEntryField: "fever",
  },
  {
    id: "steatorrhoea",
    label: { en: "Greasy / floating stools", zh: "油便 / 浮便" },
    hint: {
      en: "Suggests PERT (Creon) dose is too low.",
      zh: "提示可能需要增加胰酶剂量。",
    },
    scale: "boolean",
    tags: ["pert", "pdac"],
    defaultTracked: true,
    dailyEntryField: "steatorrhoea",
  },

  // --- Optional (user can enable) --------------------------------------
  {
    id: "cold_dysaesthesia",
    label: { en: "Cold-triggered tingling", zh: "遇冷异感" },
    scale: "boolean",
    tags: ["gnp"],
    defaultTracked: false,
    dailyEntryField: "cold_dysaesthesia",
  },
  {
    id: "new_bruising",
    label: { en: "New bruising / bleeding", zh: "新淤青 / 出血" },
    hint: {
      en: "Can signal low platelets — worth flagging.",
      zh: "可能提示血小板偏低 —— 请记录。",
    },
    scale: "boolean",
    tags: ["safety", "chemo"],
    defaultTracked: false,
    dailyEntryField: "new_bruising",
  },
  {
    id: "dyspnoea",
    label: { en: "Breathlessness", zh: "气促" },
    scale: "boolean",
    tags: ["safety"],
    defaultTracked: false,
    dailyEntryField: "dyspnoea",
  },
  {
    id: "taste_changes",
    label: { en: "Taste changes", zh: "味觉改变" },
    scale: "0_to_5",
    tags: ["chemo"],
    defaultTracked: false,
    dailyEntryField: "taste_changes",
  },
];

export function symptomById(id: string): SymptomDefinition | undefined {
  return SYMPTOM_CATALOG.find((s) => s.id === id);
}

export function defaultTrackedSymptomIds(): string[] {
  return SYMPTOM_CATALOG.filter((s) => s.defaultTracked).map((s) => s.id);
}

// Pre-select the symptoms step when the patient is inside a chemo
// window. Called with the date of the nearest chemo appointment (past
// or future); returns true if that date is within ±3 days of `now`.
export function isInChemoWindow(
  nearestChemoAt: string | null,
  now: Date = new Date(),
  windowDays = 3,
): boolean {
  if (!nearestChemoAt) return false;
  const t = new Date(nearestChemoAt).getTime();
  if (!Number.isFinite(t)) return false;
  const diffMs = Math.abs(t - now.getTime());
  return diffMs <= windowDays * 24 * 60 * 60 * 1000;
}

// Given a list of tracked ids + whether the patient is in a chemo
// window, return the ids sorted so the most context-relevant items
// float to the top. In the chemo window, `gnp` and `chemo` items come
// first; otherwise the catalog's declaration order wins.
export function rankTrackedSymptoms(
  trackedIds: readonly string[],
  options: { inChemoWindow: boolean } = { inChemoWindow: false },
): SymptomDefinition[] {
  const ids = new Set(trackedIds);
  const rows = SYMPTOM_CATALOG.filter((s) => ids.has(s.id));
  if (!options.inChemoWindow) return rows;
  return [...rows].sort((a, b) => {
    const aChemo = a.tags.includes("gnp") || a.tags.includes("chemo") ? 0 : 1;
    const bChemo = b.tags.includes("gnp") || b.tags.includes("chemo") ? 0 : 1;
    return aChemo - bChemo;
  });
}
