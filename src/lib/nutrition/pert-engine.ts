import type { MealType } from "~/types/nutrition";
import type { Citation } from "./sources";

// JPCC PERT decision rules (Jreissati Family Pancreatic Centre at
// Epworth, 2021, p. 19).
//
// 1. Take with all main meals AND any snack containing protein or fat.
// 2. Take with the FIRST mouthful of food (capsules must travel with
//    food to the gut to work).
// 3. Split the dose if the meal lasts > 30 minutes.
// 4. Forgot at the start? Take it halfway through. Remembered after?
//    Skip until the next meal.
// 5. NO PERT needed for: fruit, jelly, soft drink, juice, water, black
//    tea, black coffee (no protein, no fat).
// 6. Storage: out of direct sunlight, away from heat (ovens).
//
// `evaluatePert` is a pure function over the meal's items + meta. It
// is the single source of truth that the food picker hint, the meal
// preview's PERT prompt, and the meal-list "PERT not taken" badge
// should consult.

export const PERT_NO_DOSE_TAGS = [
  "fruit",
  "jelly",
  "soft_drink",
  "juice",
  "water",
  "black_tea",
  "black_coffee",
] as const;

export type PertNoDoseTag = (typeof PERT_NO_DOSE_TAGS)[number];

export type PertDoseRecommendation =
  | "skip"
  | "standard"
  | "half"
  | "split";

export interface PertEvaluationItem {
  food_name?: string;
  protein_g?: number;
  fat_g?: number;
  tags?: string[];
}

export interface PertEvaluationInput {
  items: PertEvaluationItem[];
  meal_type?: MealType;
  duration_min?: number;
}

export interface PertEvaluation {
  required: boolean;
  recommendation: PertDoseRecommendation;
  reason: { en: string; zh: string };
  citations: Citation[];
}

const JPCC_PERT_CITE: Citation = { source_id: "jpcc_2021", page: 19 };

const SPLIT_DOSE_MIN_DURATION = 30;

export function evaluatePert(input: PertEvaluationInput): PertEvaluation {
  const items = input.items ?? [];

  // Empty meal — nothing to evaluate.
  if (items.length === 0) {
    return {
      required: false,
      recommendation: "skip",
      reason: {
        en: "No items logged yet.",
        zh: "尚未记录任何食物。",
      },
      citations: [JPCC_PERT_CITE],
    };
  }

  // ── Skip path: every item is on the JPCC no-dose list ────────────
  const allNoDose = items.every((it) => isNoDoseItem(it));
  if (allNoDose) {
    return {
      required: false,
      recommendation: "skip",
      reason: {
        en: "No protein or fat in this meal — JPCC says no PERT needed (fruit, jelly, soft drink, juice, water, black tea/coffee).",
        zh: "此餐无蛋白或脂肪 —— 按 JPCC 不需要补酶（水果、果冻、汽水、果汁、水、清茶/咖啡均无需）。",
      },
      citations: [JPCC_PERT_CITE],
    };
  }

  // ── Required path: at least one item has protein or fat ──────────
  const hasProtein = items.some((it) => num(it.protein_g) > 0);
  const hasFat = items.some((it) => num(it.fat_g) > 0);
  if (!hasProtein && !hasFat) {
    // Items aren't on the no-dose list but also report 0 protein/fat
    // (e.g. plain rice, plain toast). Prefer the safe default — JPCC
    // says PERT goes with main meals "regardless of the foods you
    // choose to eat", so we err on required.
    return {
      required: true,
      recommendation: input.meal_type === "snack" ? "half" : "standard",
      reason: {
        en: "Main meals always get PERT, even without obvious protein or fat (JPCC).",
        zh: "正餐都需补酶，即使没有明显蛋白或脂肪（JPCC）。",
      },
      citations: [JPCC_PERT_CITE],
    };
  }

  // ── Split priority: long meal overrides snack/half ───────────────
  if (
    typeof input.duration_min === "number" &&
    input.duration_min > SPLIT_DOSE_MIN_DURATION
  ) {
    return {
      required: true,
      recommendation: "split",
      reason: {
        en: `Meal lasts ${input.duration_min} min — split the PERT dose across the meal (JPCC: > 30 min meals).`,
        zh: `此餐持续 ${input.duration_min} 分钟 —— 分次服用胰酶（JPCC：超过 30 分钟分次）。`,
      },
      citations: [JPCC_PERT_CITE],
    };
  }

  // ── Snack → half dose ────────────────────────────────────────────
  if (input.meal_type === "snack") {
    return {
      required: true,
      recommendation: "half",
      reason: {
        en: "Snack with protein or fat — JPCC suggests half the main-meal dose.",
        zh: "含蛋白/脂肪的加餐 —— JPCC 建议主餐剂量的一半。",
      },
      citations: [JPCC_PERT_CITE],
    };
  }

  // ── Default: standard dose with first bite ───────────────────────
  return {
    required: true,
    recommendation: "standard",
    reason: {
      en: "Take PERT with the first mouthful of this meal.",
      zh: "进餐第一口时服用胰酶。",
    },
    citations: [JPCC_PERT_CITE],
  };
}

// ─── helpers ─────────────────────────────────────────────────────────

function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function isNoDoseItem(item: PertEvaluationItem): boolean {
  const tags = (item.tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => (PERT_NO_DOSE_TAGS as readonly string[]).includes(t))) {
    return num(item.protein_g) === 0 && num(item.fat_g) === 0;
  }
  return false;
}
