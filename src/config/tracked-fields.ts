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
  // One-line patient-facing rationale, surfaced behind the small
  // "Why?" affordance on coverage cards. Bilingual; calm tone matching
  // the rest of the coverage copy. Kept short — aim for one sentence,
  // no more than ~120 characters.
  why: LocalizedText;
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
    why: {
      en: "Stool form is the most useful PERT-titration signal — a quick log helps the dietician spot under-dosing early.",
      zh: "排便形态是胰酶剂量调整最敏感的指标 —— 简短记录可帮助营养师早期发现剂量不足。",
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
    why: {
      en: "You've been tracking Creon coverage; the dietician watches the weekly rate for under-titration.",
      zh: "你一直在记录胰酶覆盖率；营养师据此评估剂量是否充分。",
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
    why: {
      en: "A weigh-in every few days catches sarcopenia drift early — function preservation depends on it.",
      zh: "数日称一次体重可早期发现肌少倾向 —— 功能保留依赖于此。",
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
    why: {
      en: "You've logged fluids before; we keep the prompt light, but it matters most after infusions.",
      zh: "你之前记录过饮水；提示保持简洁，但化疗后最重要。",
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
    why: {
      en: "Protein around 1.2 g/kg/day is the function-preservation target — even a rough estimate helps.",
      zh: "每日 1.2 g/kg 蛋白质是功能保留目标 —— 大致估计也有帮助。",
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
    why: {
      en: "Energy and sleep are the simplest read on how you're doing today; the trend matters more than any one day.",
      zh: "精力与睡眠是了解今日状态最简单的方式；趋势比单日数值更重要。",
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
    why: {
      en: "Appetite shifts often arrive before weight does — a quick number gives an early signal.",
      zh: "食欲变化往往早于体重 —— 简单的评分能提前给出信号。",
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
    why: {
      en: "You've been logging movement; short days still count. The physio watches the 28-day floor, not any one day.",
      zh: "你一直在记录活动；偶有少日子也算数。物理治疗师关注的是 28 天的整体水平。",
    },
  },
  {
    key: "resistance_training",
    daily_keys: ["resistance_training"],
    freshness_days: 1,
    cta_step: "movement",
    voice: "rehabilitation",
    eligibility: "history_only",
    prompt: {
      en: "Any resistance work today? A yes/no log keeps the weekly count honest.",
      zh: "今天有阻力训练吗？简单的「是/否」即可保持每周记录准确。",
    },
    why: {
      en: "Two to three resistance sessions a week is the sarcopenia-prevention target — the count needs each day's yes/no.",
      zh: "每周两到三次阻力训练是预防肌少症的目标 —— 这一计数依赖每日的「是/否」。",
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
    why: {
      en: "You're in the chemo nadir window. Even a normal reading rules out the febrile-neutropenia concern.",
      zh: "目前处于化疗低谷期。一次正常体温即可排除发热性中性粒细胞减少的担忧。",
    },
  },
];
