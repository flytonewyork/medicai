import type { DailyEntry, Settings } from "~/types/clinical";
import type { FeedItem } from "~/types/feed";
import { evaluateNutritionPolicy } from "~/lib/nutrition/policy";

// Surfaces the active nutrition-policy state as a feed item. Keeps
// the patient (and family) aware of *which* dietary playbook is
// currently in force and why — the JPCC energy-dense pattern when
// cachexia is the threat, the relaxed-keto pattern when stable.
//
// Priority sits below safety/checkin (≥ 60) and above weather/memory
// (≤ 25) — same lane as trend nudges.

export interface NutritionNudgeInputs {
  settings: Settings | null;
  recentDailies: DailyEntry[]; // chronological asc
  todayISO: string;
}

export function computeNutritionNudges(
  inputs: NutritionNudgeInputs,
): FeedItem[] {
  const policy = evaluateNutritionPolicy(inputs);
  const out: FeedItem[] = [];

  const id = `nutrition_policy_${policy.mode}_${inputs.todayISO}`;

  if (policy.mode === "energy_dense") {
    out.push({
      id,
      priority: 45,
      category: "nutrition",
      tone: "caution",
      title: {
        en: "Energy-dense mode is active",
        zh: "已切换为高能量密度模式",
      },
      body: {
        en: policy.rationale.en,
        zh: policy.rationale.zh,
      },
      cta: {
        href: "/nutrition/guide",
        label: { en: "Why this changed", zh: "为什么调整" },
      },
      icon: "salad",
      source: "nutrition_policy",
    });
    return out;
  }

  if (policy.mode === "low_carb") {
    out.push({
      id,
      priority: 30,
      category: "nutrition",
      tone: "positive",
      title: {
        en: "Low-carb pattern: stay the course",
        zh: "保持低碳水模式",
      },
      body: {
        en: policy.rationale.en,
        zh: policy.rationale.zh,
      },
      cta: {
        href: "/nutrition/guide",
        label: { en: "What this looks like", zh: "实际怎么吃" },
      },
      icon: "salad",
      source: "nutrition_policy",
    });
    return out;
  }

  // transitional
  out.push({
    id,
    priority: 32,
    category: "nutrition",
    tone: "info",
    title: {
      en: "Holding the low-carb baseline",
      zh: "暂维持低碳水基线",
    },
    body: {
      en: policy.rationale.en,
      zh: policy.rationale.zh,
    },
    cta: {
      href: "/nutrition/guide",
      label: { en: "Diet strategy", zh: "饮食策略" },
    },
    icon: "salad",
    source: "nutrition_policy",
  });
  return out;
}
