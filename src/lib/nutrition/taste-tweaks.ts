import type { Citation } from "./sources";
import type { LocalizedText } from "~/types/localized";

// JPCC nutrition guide p. 16: four taste-issue quadrants and a
// remedy list for each. Common during chemotherapy (especially
// nab-paclitaxel + gemcitabine) — tongue maps shift, food tastes
// "wrong", and the patient stops eating. The right tweak makes
// food edible again before nutrition deteriorates.
//
// `suggestTasteTweaks` is a pure function. The UI consumes it from
// the daily check-in (when `taste_changes >= 3`) and from the food
// picker hint when the patient has a taste flag in symptom-context.

export type TasteIssue =
  | "too_sweet"
  | "too_salty"
  | "too_bland"
  | "metallic"
  | "normal";

export const TASTE_ISSUES: TasteIssue[] = [
  "too_sweet",
  "too_salty",
  "too_bland",
  "metallic",
  "normal",
];

export interface TasteTweak {
  issue: TasteIssue;
  suggestions: LocalizedText[];
  citations: Citation[];
}

const JPCC_TASTE_CITE: Citation = { source_id: "jpcc_2021", page: 16 };

const TWEAKS: Record<TasteIssue, LocalizedText[]> = {
  too_sweet: [
    {
      en: "Eat the food cool — lower temperatures reduce sweetness.",
      zh: "稍凉再吃 —— 温度低能降低甜味感。",
    },
    {
      en: "Add a pinch of salt or a splash of vinegar to tone the sweetness down.",
      zh: "加一点盐或一点醋，能压住甜味。",
    },
    {
      en: "Add pureed fruit or a squeeze of lemon juice.",
      zh: "加一些果泥或挤几滴柠檬汁。",
    },
    {
      en: "Snack on savoury, salty foods — cheese, nuts, dry biscuits with peanut butter.",
      zh: "选咸味零食 —— 奶酪、坚果、配花生酱的咸饼干。",
    },
  ],
  too_salty: [
    {
      en: "Add a pinch of sugar.",
      zh: "加一小撮糖。",
    },
    {
      en: "Add herbs and spices instead of salt-heavy seasonings.",
      zh: "改用香草和香料调味，少用咸味调料。",
    },
    {
      en: "Avoid pre-prepared sauces — they're usually salt-heavy.",
      zh: "避免成品酱料 —— 一般含盐很高。",
    },
    {
      en: "Stir milk, coconut milk or cream into soups and casseroles to soften the saltiness.",
      zh: "在汤或炖菜里加入牛奶、椰奶或奶油来缓和咸味。",
    },
  ],
  too_bland: [
    {
      en: "Add stronger flavours — mustards, pickles, herbs and spices.",
      zh: "用更浓烈的味道 —— 芥末、泡菜、香草、香料。",
    },
    {
      en: "Add extra salt and pepper.",
      zh: "多加一些盐和胡椒。",
    },
    {
      en: "Add salty foods like parmesan cheese or chopped bacon.",
      zh: "加咸味食物如帕玛森奶酪或培根碎。",
    },
    {
      en: "Add bitter foods such as natural yoghurt and lemon sorbet.",
      zh: "搭配苦/酸味食物，如原味酸奶或柠檬冰沙。",
    },
    {
      en: "Marinate meats, fish, chicken and tofu before cooking.",
      zh: "肉类、鱼、鸡、豆腐在烹调前先腌一下。",
    },
  ],
  metallic: [
    {
      en: "Eat fresh fruits or suck on hard lollies to cover a metallic taste.",
      zh: "吃新鲜水果或含一颗硬糖压住金属味。",
    },
    {
      en: "Use plastic cutlery — metal cutlery makes it worse.",
      zh: "改用塑料餐具 —— 金属餐具会让金属味更重。",
    },
    {
      en: "Marinate meats; the acid + flavour mask the off-taste.",
      zh: "肉类先腌制 —— 酸和香料能盖住怪味。",
    },
    {
      en: "Rinse with mouthwash or brush teeth before meals.",
      zh: "饭前用漱口水漱口或刷牙。",
    },
  ],
  normal: [],
};

export function suggestTasteTweaks(issue: TasteIssue): TasteTweak {
  return {
    issue,
    suggestions: TWEAKS[issue] ?? [],
    citations: issue === "normal" ? [] : [JPCC_TASTE_CITE],
  };
}
