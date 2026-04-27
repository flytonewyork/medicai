// Reference ranges and display metadata for lab analytes. Keep one source of
// truth — dashboard tiles, lab list, TestView, ingest schema, zone rules, and
// the pre-clinic report should all key off this config.
//
// Ranges reflect standard adult Australian pathology reference intervals
// (Epworth / Sonic). They are a display and flagging aid; clinical decisions
// remain with Dr Lee.

import type { LabResult } from "~/types/clinical";

export type AnalyteKey = Exclude<
  keyof LabResult,
  "id" | "date" | "source" | "notes" | "created_at" | "updated_at"
>;

export type AnalyteGroup =
  | "tumour_marker"
  | "nutrition"
  | "haematology"
  | "liver"
  | "renal"
  | "metabolic"
  | "micronutrient"
  | "other";

export interface AnalyteDef {
  key: AnalyteKey;
  label: { en: string; zh: string };
  short: string; // short label for pills / calendar dots
  unit: string;
  /** Reference range [low, high]. `null` means no standard range (e.g. CA19-9 uses upper-bound only). */
  ref?: [number, number];
  /** Hard-flag threshold for explicit "derangement" badges. */
  highFlag?: number;
  lowFlag?: number;
  /** Direction considered "favourable" — used to colour trend arrows. */
  preferred?: "high" | "low" | "stable";
  group: AnalyteGroup;
  /** How many decimal places to display in tables. */
  decimals?: number;
  /** Short 1-line clinical note shown in TestView. */
  note?: { en: string; zh: string };
}

export const ANALYTES: AnalyteDef[] = [
  // ── Tumour markers ────────────────────────────────────────────────
  {
    key: "ca199",
    label: { en: "CA 19-9", zh: "CA 19-9" },
    short: "CA19-9",
    unit: "U/mL",
    ref: [0, 37],
    preferred: "low",
    group: "tumour_marker",
    note: {
      en: "Primary pancreatic-cancer tumour marker. Trend matters more than any single value.",
      zh: "胰腺癌主要肿瘤标志物。趋势比单次数值更重要。",
    },
  },
  {
    key: "cea",
    label: { en: "CEA", zh: "癌胚抗原" },
    short: "CEA",
    unit: "µg/L",
    ref: [0, 5],
    preferred: "low",
    group: "tumour_marker",
    note: {
      en: "Secondary marker — useful when CA 19-9 is Lewis-negative or discordant.",
      zh: "次要肿瘤标志物 — 若 CA 19-9 Lewis 阴性或不一致时有帮助。",
    },
  },
  {
    key: "ldh",
    label: { en: "LDH", zh: "乳酸脱氢酶" },
    short: "LDH",
    unit: "U/L",
    ref: [120, 250],
    highFlag: 500,
    preferred: "low",
    group: "tumour_marker",
    note: {
      en: "Surrogate for tumour burden and turnover. Rising values warrant review.",
      zh: "反映肿瘤负担与代谢。升高值得关注。",
    },
  },

  // ── Nutrition / inflammation ─────────────────────────────────────
  {
    key: "albumin",
    label: { en: "Albumin", zh: "白蛋白" },
    short: "Alb",
    unit: "g/L",
    ref: [35, 50],
    lowFlag: 30,
    preferred: "high",
    group: "nutrition",
    note: {
      en: "Nutritional and inflammatory status. < 30 g/L is a yellow-zone flag.",
      zh: "营养和炎症状态。< 30 g/L 为黄色区间警示。",
    },
  },
  {
    key: "prealbumin",
    label: { en: "Prealbumin", zh: "前白蛋白" },
    short: "Prealb",
    unit: "mg/L",
    ref: [200, 400],
    preferred: "high",
    group: "nutrition",
    note: {
      en: "Sensitive to recent nutrition (~2-day half-life).",
      zh: "对近期营养变化敏感（半衰期约 2 天）。",
    },
  },
  {
    key: "crp",
    label: { en: "CRP", zh: "C-反应蛋白" },
    short: "CRP",
    unit: "mg/L",
    ref: [0, 5],
    highFlag: 50,
    preferred: "low",
    group: "nutrition",
    note: {
      en: "Acute-phase inflammation. Persistent elevation drives cachexia.",
      zh: "急性期炎症。持续升高会加重恶病质。",
    },
  },

  // ── Haematology ──────────────────────────────────────────────────
  {
    key: "hemoglobin",
    label: { en: "Haemoglobin", zh: "血红蛋白" },
    short: "Hb",
    unit: "g/L",
    ref: [120, 160],
    lowFlag: 100,
    preferred: "high",
    group: "haematology",
  },
  {
    key: "hematocrit",
    label: { en: "Haematocrit", zh: "红细胞比容" },
    short: "Hct",
    unit: "%",
    ref: [36, 48],
    preferred: "high",
    group: "haematology",
    decimals: 1,
  },
  {
    key: "wbc",
    label: { en: "White cells", zh: "白细胞" },
    short: "WBC",
    unit: "×10⁹/L",
    ref: [4, 11],
    preferred: "stable",
    group: "haematology",
    decimals: 1,
  },
  {
    key: "neutrophils",
    label: { en: "Neutrophils", zh: "中性粒细胞" },
    short: "Neut",
    unit: "×10⁹/L",
    ref: [1.5, 7],
    lowFlag: 1.0,
    preferred: "stable",
    group: "haematology",
    decimals: 1,
    note: {
      en: "< 1.0 = neutropenia. < 0.5 = severe, hold chemo.",
      zh: "< 1.0 为粒细胞减少；< 0.5 为严重减少，暂停化疗。",
    },
  },
  {
    key: "lymphocytes",
    label: { en: "Lymphocytes", zh: "淋巴细胞" },
    short: "Lymph",
    unit: "×10⁹/L",
    ref: [1.0, 4.0],
    preferred: "high",
    group: "haematology",
    decimals: 1,
  },
  {
    key: "platelets",
    label: { en: "Platelets", zh: "血小板" },
    short: "Plt",
    unit: "×10⁹/L",
    ref: [150, 450],
    lowFlag: 100,
    preferred: "high",
    group: "haematology",
    note: {
      en: "< 100 holds gemcitabine; < 50 is a transfusion threshold.",
      zh: "< 100 暂停吉西他滨；< 50 可考虑输注。",
    },
  },

  // ── Liver panel ──────────────────────────────────────────────────
  {
    key: "alt",
    label: { en: "ALT", zh: "谷丙转氨酶" },
    short: "ALT",
    unit: "U/L",
    ref: [5, 40],
    highFlag: 100,
    preferred: "low",
    group: "liver",
  },
  {
    key: "ast",
    label: { en: "AST", zh: "谷草转氨酶" },
    short: "AST",
    unit: "U/L",
    ref: [5, 40],
    highFlag: 100,
    preferred: "low",
    group: "liver",
  },
  {
    key: "ggt",
    label: { en: "GGT", zh: "γ-GT" },
    short: "GGT",
    unit: "U/L",
    ref: [5, 50],
    highFlag: 150,
    preferred: "low",
    group: "liver",
  },
  {
    key: "alp",
    label: { en: "ALP", zh: "碱性磷酸酶" },
    short: "ALP",
    unit: "U/L",
    ref: [40, 130],
    highFlag: 300,
    preferred: "low",
    group: "liver",
    note: {
      en: "Biliary obstruction or bone turnover marker.",
      zh: "胆道梗阻或骨代谢标志物。",
    },
  },
  {
    key: "bilirubin",
    label: { en: "Bilirubin", zh: "胆红素" },
    short: "Bili",
    unit: "µmol/L",
    ref: [2, 21],
    highFlag: 34,
    preferred: "low",
    group: "liver",
    note: {
      en: "> 34 µmol/L (≈ 2× ULN) triggers dose review.",
      zh: "> 34 µmol/L（约 2× 上限）需考虑减量。",
    },
  },

  // ── Renal / electrolytes ─────────────────────────────────────────
  {
    key: "creatinine",
    label: { en: "Creatinine", zh: "肌酐" },
    short: "Cr",
    unit: "µmol/L",
    ref: [60, 110],
    preferred: "low",
    group: "renal",
  },
  {
    key: "urea",
    label: { en: "Urea", zh: "尿素氮" },
    short: "Urea",
    unit: "mmol/L",
    ref: [2.5, 7.5],
    preferred: "low",
    group: "renal",
  },
  {
    key: "sodium",
    label: { en: "Sodium", zh: "钠" },
    short: "Na",
    unit: "mmol/L",
    ref: [135, 145],
    preferred: "stable",
    group: "renal",
  },
  {
    key: "potassium",
    label: { en: "Potassium", zh: "钾" },
    short: "K",
    unit: "mmol/L",
    ref: [3.5, 5.0],
    preferred: "stable",
    group: "renal",
    decimals: 1,
  },
  {
    key: "calcium",
    label: { en: "Calcium", zh: "钙" },
    short: "Ca",
    unit: "mmol/L",
    ref: [2.15, 2.6],
    preferred: "stable",
    group: "renal",
    decimals: 2,
  },
  {
    key: "magnesium",
    label: { en: "Magnesium", zh: "镁" },
    short: "Mg",
    unit: "mmol/L",
    ref: [0.7, 1.0],
    preferred: "stable",
    group: "renal",
    decimals: 2,
  },
  {
    key: "phosphate",
    label: { en: "Phosphate", zh: "磷" },
    short: "PO₄",
    unit: "mmol/L",
    ref: [0.8, 1.5],
    preferred: "stable",
    group: "renal",
    decimals: 2,
  },

  // ── Metabolic ────────────────────────────────────────────────────
  {
    key: "glucose",
    label: { en: "Glucose", zh: "血糖" },
    short: "Glu",
    unit: "mmol/L",
    ref: [4, 7.8],
    highFlag: 11,
    preferred: "stable",
    group: "metabolic",
    decimals: 1,
    note: {
      en: "PDAC-related diabetes is common. Track fasting values.",
      zh: "胰腺癌相关糖尿病常见，关注空腹血糖。",
    },
  },
  {
    key: "hba1c",
    label: { en: "HbA1c", zh: "糖化血红蛋白" },
    short: "HbA1c",
    unit: "%",
    ref: [4, 6],
    highFlag: 7,
    preferred: "stable",
    group: "metabolic",
    decimals: 1,
  },

  // ── Micronutrients ──────────────────────────────────────────────
  {
    key: "ferritin",
    label: { en: "Ferritin", zh: "铁蛋白" },
    short: "Ferr",
    unit: "µg/L",
    ref: [30, 400],
    preferred: "stable",
    group: "micronutrient",
  },
  {
    key: "vit_d",
    label: { en: "Vitamin D", zh: "维生素 D" },
    short: "Vit D",
    unit: "nmol/L",
    ref: [50, 150],
    lowFlag: 30,
    preferred: "high",
    group: "micronutrient",
  },
  {
    key: "b12",
    label: { en: "B12", zh: "维生素 B12" },
    short: "B12",
    unit: "pmol/L",
    ref: [150, 700],
    lowFlag: 100,
    preferred: "high",
    group: "micronutrient",
  },
  {
    key: "folate",
    label: { en: "Folate", zh: "叶酸" },
    short: "Folate",
    unit: "nmol/L",
    ref: [7, 40],
    preferred: "high",
    group: "micronutrient",
  },

  // ── Coag / endocrine ─────────────────────────────────────────────
  {
    key: "inr",
    label: { en: "INR", zh: "国际标准化比值" },
    short: "INR",
    unit: "",
    ref: [0.9, 1.2],
    preferred: "stable",
    group: "other",
    decimals: 2,
  },
  {
    key: "tsh",
    label: { en: "TSH", zh: "促甲状腺激素" },
    short: "TSH",
    unit: "mIU/L",
    ref: [0.4, 4.0],
    preferred: "stable",
    group: "other",
    decimals: 2,
  },
];

export const ANALYTE_BY_KEY: Record<AnalyteKey, AnalyteDef> = Object.fromEntries(
  ANALYTES.map((a) => [a.key, a]),
) as Record<AnalyteKey, AnalyteDef>;

export const GROUP_LABEL: Record<AnalyteGroup, { en: string; zh: string }> = {
  tumour_marker: { en: "Tumour markers", zh: "肿瘤标志物" },
  nutrition: { en: "Nutrition & inflammation", zh: "营养与炎症" },
  haematology: { en: "Blood count", zh: "血常规" },
  liver: { en: "Liver panel", zh: "肝功能" },
  renal: { en: "Renal & electrolytes", zh: "肾功能与电解质" },
  metabolic: { en: "Metabolic", zh: "代谢" },
  micronutrient: { en: "Micronutrients", zh: "微量营养素" },
  other: { en: "Other", zh: "其他" },
};

export function flagStatus(
  key: AnalyteKey,
  value: number,
): "low" | "high" | "normal" {
  const def = ANALYTE_BY_KEY[key];
  if (!def) return "normal";
  if (def.highFlag !== undefined && value >= def.highFlag) return "high";
  if (def.lowFlag !== undefined && value <= def.lowFlag) return "low";
  if (def.ref) {
    if (value < def.ref[0]) return "low";
    if (value > def.ref[1]) return "high";
  }
  return "normal";
}

export function formatAnalyte(key: AnalyteKey, value: number): string {
  const def = ANALYTE_BY_KEY[key];
  const dp = def?.decimals ?? 0;
  return dp > 0 ? value.toFixed(dp) : Math.round(value).toString();
}
