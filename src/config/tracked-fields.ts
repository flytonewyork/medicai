import type { DailyEntry } from "~/types/clinical";
import type { LocalizedText } from "~/types/localized";

// Curated list of fields the coverage engine watches. Each entry is a
// pure record — no Dexie reads, no UI side effects — that the engine
// joins against recent dailies, settings, and the cycle context to
// compute whether to surface a coverage card today.
//
// Calm-engagement rules live alongside the field:
//   - `freshness_days`     how many days an entry counts as "fresh".
//                          1 = today only; 7 = current week, etc.
//   - `cta_step`           wizard step to deep-link into. Routes to
//                          /daily/new?step=<cta_step>.
//   - `voice`              which AI voice owns this prompt — drives
//                          card title and icon via AGENT_VOICES.
//   - `eligibility`        when the engine is allowed to surface it:
//                            "default"          always-eligible core fields
//                            "tracked_symptoms" only if listed in
//                                                settings.tracked_symptoms
//                            "history_only"     only if the field has
//                                                been filled at least
//                                                once in the last 60 d
//                            "nadir_only"       only when the patient is
//                                                in the chemo nadir window
//
// The "don't pull on strings that aren't there" rule from the design
// brief: anything outside `default` is suppressed unless its specific
// eligibility check passes.

export type FieldEligibility =
  | "default"
  | "tracked_symptoms"
  | "history_only"
  | "nadir_only";

export type FieldVoice = "nutrition" | "toxicity" | "rehabilitation";

export interface TrackedField {
  key: string;
  // The DailyEntry column(s) we read to decide if it's been logged.
  // Multiple keys mean "any of these counts as logged" — e.g. the
  // digestion card resolves on either stool_count or stool_bristol.
  daily_keys: ReadonlyArray<keyof DailyEntry>;
  freshness_days: number;
  cta_step: string;
  voice: FieldVoice;
  eligibility: FieldEligibility;
  prompt: LocalizedText;
}

// Order shapes the default priority order when more than one gap is
// eligible after engagement-state filtering. The list is intentionally
// short — coverage prompts are rationed.
export const TRACKED_FIELDS: TrackedField[] = [
  {
    key: "digestion",
    daily_keys: ["stool_count", "stool_bristol"],
    freshness_days: 1,
    cta_step: "digestion",
    voice: "nutrition",
    eligibility: "default",
    prompt: {
      en: "A quick digestion log helps the dietician track PERT — count and Bristol type take a few seconds.",
      zh: "简短记录今日排便有助于营养师跟踪胰酶剂量 —— 仅需填次数和 Bristol 类型。",
    },
  },
  {
    key: "pert_with_meals",
    daily_keys: ["pert_with_meals_today"],
    freshness_days: 1,
    cta_step: "digestion",
    voice: "nutrition",
    eligibility: "history_only",
    prompt: {
      en: "Did Creon land with today's meals? One tap to log.",
      zh: "今天 Creon 是否随餐服用？一键记录。",
    },
  },
  {
    key: "weight",
    daily_keys: ["weight_kg"],
    freshness_days: 3,
    cta_step: "weight",
    voice: "nutrition",
    eligibility: "default",
    prompt: {
      en: "Weight hasn't been logged in a few days. Worth a quick weigh-in if convenient.",
      zh: "体重已数日未记录。方便时简短称重一下。",
    },
  },
  {
    key: "fluids",
    daily_keys: ["fluids_ml"],
    freshness_days: 1,
    cta_step: "food",
    voice: "nutrition",
    eligibility: "history_only",
    prompt: {
      en: "Fluid intake not yet logged today.",
      zh: "今日饮水尚未记录。",
    },
  },
  {
    key: "protein",
    daily_keys: ["protein_grams"],
    freshness_days: 1,
    cta_step: "food",
    voice: "nutrition",
    eligibility: "history_only",
    prompt: {
      en: "Protein not yet logged today.",
      zh: "今日蛋白质摄入尚未记录。",
    },
  },
  {
    key: "energy",
    daily_keys: ["energy", "sleep_quality"],
    freshness_days: 1,
    cta_step: "feelings",
    voice: "rehabilitation",
    eligibility: "default",
    prompt: {
      en: "Brief check-in on how today felt — energy and sleep.",
      zh: "简短记录今日感受 —— 精力与睡眠。",
    },
  },
  {
    key: "appetite",
    daily_keys: ["appetite", "nausea"],
    freshness_days: 1,
    cta_step: "feelings",
    voice: "nutrition",
    eligibility: "history_only",
    prompt: {
      en: "Appetite and nausea not yet logged today.",
      zh: "今日食欲与恶心尚未记录。",
    },
  },
  {
    key: "walking",
    daily_keys: ["walking_minutes", "steps"],
    freshness_days: 1,
    cta_step: "movement",
    voice: "rehabilitation",
    eligibility: "history_only",
    prompt: {
      en: "Movement not yet logged today.",
      zh: "今日活动尚未记录。",
    },
  },
  {
    key: "temperature_nadir",
    daily_keys: ["fever", "fever_temp"],
    freshness_days: 1,
    cta_step: "symptoms",
    voice: "toxicity",
    eligibility: "nadir_only",
    prompt: {
      en: "Temperature check during the nadir window — even a quick reading helps.",
      zh: "化疗低谷期建议每日测温 —— 简短一次即可。",
    },
  },
];
