import type { CycleContext } from "~/types/treatment";
import type { FeedItem } from "~/types/feed";

// JPCC food safety / low immunity playbook (p. 17–18). Surfaces
// during the treatment phases when the patient is most immune-
// suppressed — nadir and early recovery on GnP. Outside those
// windows the avoid-list is still in the diet guide for reference;
// the feed nudge fires only when it's clinically time-relevant.
//
// Avoid list (per JPCC p. 18):
//   - Raw eggs
//   - Unpasteurised dairy
//   - Soft cheeses
//   - Undercooked meats
//   - Fermented beverages
// Temperature rules:
//   - Hot food > 60 °C
//   - Cold food < 5 °C
//   - Reheat to 60 °C+, never reheat more than once

export interface FoodSafetyAvoidItem {
  en: string;
  zh: string;
}

export const FOOD_SAFETY_AVOID: FoodSafetyAvoidItem[] = [
  { en: "Raw eggs", zh: "生蛋" },
  { en: "Unpasteurised dairy", zh: "未经巴氏消毒的奶制品" },
  { en: "Soft cheeses (brie, camembert, ricotta)", zh: "软奶酪（布里、卡门贝尔、里科塔）" },
  { en: "Undercooked meats", zh: "未充分煮熟的肉" },
  { en: "Fermented beverages (kombucha, kefir)", zh: "发酵饮品（康普茶、克菲尔）" },
];

export interface FoodSafetyInputs {
  cycleContext: CycleContext | null;
  todayISO: string;
}

export function computeFoodSafetyNudges(
  inputs: FoodSafetyInputs,
): FeedItem[] {
  const phase = inputs.cycleContext?.phase?.key;
  if (phase !== "nadir" && phase !== "recovery_early") {
    return [];
  }

  const idDate = inputs.todayISO;
  return [
    {
      id: `food_safety_nadir_${idDate}`,
      priority: 40,
      category: "nutrition",
      tone: "caution",
      title: {
        en: "Immunity is low — extra food-safety care",
        zh: "免疫力较弱 —— 注意饮食安全",
      },
      body: {
        en: "Hot food > 60 °C, cold food < 5 °C, reheat once only. Avoid raw eggs, unpasteurised dairy, soft cheeses, undercooked meats, fermented drinks.",
        zh: "热食 > 60 °C，冷食 < 5 °C，只可加热一次。避免生蛋、未经巴氏消毒奶制品、软奶酪、未熟肉、发酵饮品。",
      },
      cta: {
        href: "/nutrition/guide#food-safety",
        label: { en: "See full list", zh: "完整清单" },
      },
      icon: "shield",
      source: "food_safety",
    },
  ];
}
