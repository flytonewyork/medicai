import type { DailyEntry, Settings } from "~/types/clinical";
import type { Citation } from "./sources";
import type { LocalizedText } from "~/types/localized";

// Carb-policy state machine. The /nutrition/guide page in Anchor
// historically advocated relaxed-keto (≤ 50 g net carbs/day) per the
// patient's chosen low-carb strategy (Wolpin 2009 / Liao 2019 /
// Cohen 2018). The JPCC nutrition guide (Surace 2021) instead
// recommends energy density via cream, milk, sugar, supplements when
// cachexia is the threat. Both are right at different times — keto
// when stable, energy-dense when losing.
//
// This selector picks one of three modes from the patient's recent
// trajectory. Triggers are exposed (with citations) so the feed
// nudge can explain *why* the policy shifted.

export type NutritionMode = "low_carb" | "energy_dense" | "transitional";

export type PolicyTriggerKind =
  | "weight_loss"
  | "appetite_low"
  | "appetite_recovered"
  | "stable"
  | "default";

export interface PolicyTrigger {
  kind: PolicyTriggerKind;
  detail: LocalizedText;
  citations: Citation[];
}

export interface NutritionPolicyState {
  mode: NutritionMode;
  triggers: PolicyTrigger[];
  rationale: LocalizedText;
}

export interface PolicyInputs {
  settings: Settings | null;
  recentDailies: DailyEntry[]; // chronological asc
  todayISO: string;
}

const WEIGHT_LOSS_TRIGGER_PCT = 5;          // ≥ 5% from baseline → flip
const APPETITE_LOW_THRESHOLD = 4;           // 0–10 mean over window
const APPETITE_LOW_WINDOW_DAYS = 7;
const APPETITE_RECOVERED_THRESHOLD = 6;
const APPETITE_MIN_ENTRIES = 3;             // ignore mean if < 3 entries
const WEIGHT_STABLE_PCT = 2;                // ±2% of baseline = stable

export function evaluateNutritionPolicy(
  inputs: PolicyInputs,
): NutritionPolicyState {
  const { settings, recentDailies } = inputs;
  const triggers: PolicyTrigger[] = [];

  // ── No data → default to low_carb (per CLAUDE.md baseline) ───────
  if (!settings || recentDailies.length === 0) {
    triggers.push({
      kind: "default",
      detail: {
        en: "Not enough data yet — defaulting to the low-carb baseline.",
        zh: "数据尚不足 —— 默认采用低碳水基线。",
      },
      citations: [],
    });
    return {
      mode: "low_carb",
      triggers,
      rationale: {
        en:
          "Following the patient's chosen relaxed-keto strategy until data shows otherwise.",
        zh: "按照患者选定的宽松生酮策略执行，直到数据出现变化。",
      },
    };
  }

  // ── Weight loss vs baseline ──────────────────────────────────────
  const baseline = settings.baseline_weight_kg;
  const latestWeight = lastWeight(recentDailies);
  if (baseline && latestWeight !== null) {
    const lossPct = ((baseline - latestWeight) / baseline) * 100;
    if (lossPct >= WEIGHT_LOSS_TRIGGER_PCT) {
      triggers.push({
        kind: "weight_loss",
        detail: {
          en: `Weight is ${lossPct.toFixed(1)}% below baseline — switching to energy-dense mode.`,
          zh: `体重比基线低 ${lossPct.toFixed(1)}% —— 切换到高能量密度模式。`,
        },
        citations: [
          { source_id: "jpcc_2021", page: 9 },
          { source_id: "hendifar_2019" },
        ],
      });
    }
  }

  // ── Recent low appetite ──────────────────────────────────────────
  const last7 = recentDailies.slice(-APPETITE_LOW_WINDOW_DAYS);
  const apMean = mean(last7.map((d) => d.appetite));
  const apEntries = last7.filter((d) => typeof d.appetite === "number").length;
  if (apMean !== null && apEntries >= APPETITE_MIN_ENTRIES) {
    if (apMean <= APPETITE_LOW_THRESHOLD) {
      triggers.push({
        kind: "appetite_low",
        detail: {
          en: `7-day mean appetite is ${apMean.toFixed(1)}/10 — energy-dense foods help when nothing tastes right.`,
          zh: `近 7 日食欲均值 ${apMean.toFixed(1)}/10 —— 食欲差时优先高热量密度食物。`,
        },
        citations: [{ source_id: "jpcc_2021", page: 14 }],
      });
    } else if (apMean >= APPETITE_RECOVERED_THRESHOLD) {
      triggers.push({
        kind: "appetite_recovered",
        detail: {
          en: `Appetite is back to ${apMean.toFixed(1)}/10 — can return to the low-carb pattern.`,
          zh: `食欲已恢复到 ${apMean.toFixed(1)}/10 —— 可以回到低碳水模式。`,
        },
        citations: [{ source_id: "wolpin_2009" }],
      });
    }
  }

  const wantsEnergyDense = triggers.some(
    (t) => t.kind === "weight_loss" || t.kind === "appetite_low",
  );

  if (wantsEnergyDense) {
    return {
      mode: "energy_dense",
      triggers,
      rationale: {
        en:
          "Cachexia is the bigger threat than glycaemia right now — calories first, composition second. JPCC adding-principle: full-cream milk, cream, supplements, milky desserts.",
        zh:
          "目前\"消瘦\"比血糖更危险 —— 先保证热量，其次再讲配比。JPCC 加料原则：全脂奶、奶油、营养奶昔、奶制甜品。",
      },
    };
  }

  // ── Stable: weight near baseline AND appetite recovered ──────────
  const stable =
    baseline !== undefined &&
    latestWeight !== null &&
    Math.abs(((latestWeight - baseline) / baseline) * 100) <= WEIGHT_STABLE_PCT &&
    apMean !== null &&
    apMean >= APPETITE_RECOVERED_THRESHOLD;

  if (stable) {
    triggers.push({
      kind: "stable",
      detail: {
        en: "Weight near baseline and appetite is good — maintaining low-carb pattern.",
        zh: "体重接近基线，食欲良好 —— 保持低碳水模式。",
      },
      citations: [{ source_id: "wolpin_2009" }, { source_id: "cohen_2018" }],
    });
    return {
      mode: "low_carb",
      triggers,
      rationale: {
        en:
          "Stable weight + good appetite — keep the protein-first, low-carb pattern that protects lean mass.",
        zh:
          "体重稳定 + 食欲良好 —— 维持\"蛋白优先、低碳水\"以保护瘦肉量。",
      },
    };
  }

  // ── Transitional (some signal but ambiguous) ─────────────────────
  if (triggers.length === 0) {
    triggers.push({
      kind: "default",
      detail: {
        en: "Holding the low-carb baseline — not enough evidence to change.",
        zh: "维持低碳水基线 —— 暂无足够证据改变策略。",
      },
      citations: [],
    });
  }
  return {
    mode: "transitional",
    triggers,
    rationale: {
      en:
        "Trajectory is mixed. Holding the low-carb baseline; will re-evaluate as more daily entries arrive.",
      zh: "趋势不明。继续低碳水基线，待更多每日数据到达后再评估。",
    },
  };
}

// ─── helpers ─────────────────────────────────────────────────────────

function lastWeight(rows: DailyEntry[]): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const w = rows[i]?.weight_kg;
    if (typeof w === "number" && Number.isFinite(w)) return w;
  }
  return null;
}

function mean(nums: Array<number | undefined>): number | null {
  const vs = nums.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (vs.length === 0) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}
