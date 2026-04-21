import type { PhaseWindow, Protocol } from "~/types/treatment";

const PHASE_GNP_WEEKLY: PhaseWindow[] = [
  {
    key: "dose_day",
    day_start: 1,
    day_end: 1,
    label: { en: "Dose day 1", zh: "第 1 次用药日" },
    description: {
      en: "Gem + nab-paclitaxel infusion. Premeds (dex, ondansetron) day of.",
      zh: "吉西他滨 + 白蛋白紫杉醇输注。当天预用药（地塞米松、昂丹司琼）。",
    },
  },
  {
    key: "post_dose",
    day_start: 2,
    day_end: 3,
    label: { en: "Early post-dose", zh: "用药后 1–2 天" },
    description: {
      en: "Steroid taper, peak nausea risk, cold dysaesthesia possible up to 72h.",
      zh: "类固醇减量期，恶心峰期，遇冷异感可能持续 72 小时。",
    },
  },
  {
    key: "dose_day",
    day_start: 8,
    day_end: 8,
    label: { en: "Dose day 8", zh: "第 8 天用药" },
    description: {
      en: "Second weekly dose.",
      zh: "每周的第二次用药。",
    },
  },
  {
    key: "post_dose",
    day_start: 9,
    day_end: 10,
    label: { en: "Post-D8", zh: "D8 之后" },
    description: { en: "Same profile as post-D1.", zh: "症状谱与 D1 相同。" },
  },
  {
    key: "dose_day",
    day_start: 15,
    day_end: 15,
    label: { en: "Dose day 15", zh: "第 15 天用药" },
    description: {
      en: "Third weekly dose — enters nadir window shortly after.",
      zh: "第 15 天给药 —— 之后进入骨髓抑制低谷。",
    },
  },
  {
    key: "nadir",
    day_start: 16,
    day_end: 21,
    label: { en: "Nadir window", zh: "骨髓抑制低谷" },
    description: {
      en: "Neutrophils at their lowest. Infection risk peak. Avoid crowds, intensify hand hygiene, twice-daily temp.",
      zh: "中性粒细胞最低。感染风险最高。避免人群、加强手卫生、一天两次测体温。",
    },
  },
  {
    key: "recovery_late",
    day_start: 22,
    day_end: 28,
    label: { en: "Recovery / rest", zh: "恢复期" },
    description: {
      en: "Counts recover. Appetite + energy return. Best window for resistance training, family events, meaningful activity.",
      zh: "血象恢复，食欲与精力回来。此时最适合阻力训练、家庭活动、有意义的事。",
    },
  },
];

const PHASE_GNP_BIWEEKLY: PhaseWindow[] = [
  {
    key: "dose_day",
    day_start: 1,
    day_end: 1,
    label: { en: "Dose day 1", zh: "第 1 天用药" },
    description: {
      en: "Gem + nab-paclitaxel infusion.",
      zh: "吉西他滨 + 白蛋白紫杉醇输注。",
    },
  },
  {
    key: "post_dose",
    day_start: 2,
    day_end: 3,
    label: { en: "Post-dose", zh: "用药后" },
    description: {
      en: "Steroid taper, peak nausea risk.",
      zh: "类固醇减量，恶心峰期。",
    },
  },
  {
    key: "recovery_early",
    day_start: 4,
    day_end: 13,
    label: { en: "Between-dose recovery", zh: "两次用药间歇" },
    description: {
      en: "Generally stable. Good for walking, light resistance, meaningful activity.",
      zh: "一般较稳定，适合步行、轻度阻力训练、有意义的活动。",
    },
  },
  {
    key: "dose_day",
    day_start: 15,
    day_end: 15,
    label: { en: "Dose day 15", zh: "第 15 天用药" },
    description: { en: "Second dose of cycle.", zh: "本周期第 2 次用药。" },
  },
  {
    key: "nadir",
    day_start: 22,
    day_end: 25,
    label: { en: "Nadir window", zh: "骨髓抑制低谷" },
    description: {
      en: "Peak infection risk. Hand hygiene, avoid sick contacts, twice-daily temp.",
      zh: "感染风险最高：手卫生、避开患病者、每日两次测体温。",
    },
  },
  {
    key: "recovery_late",
    day_start: 26,
    day_end: 28,
    label: { en: "Recovery", zh: "恢复" },
    description: {
      en: "Counts recovering before next cycle.",
      zh: "进入下一周期前血象恢复。",
    },
  },
];

const PHASE_GEM_MAINT: PhaseWindow[] = [
  {
    key: "dose_day",
    day_start: 1,
    day_end: 1,
    label: { en: "D1 gem only", zh: "第 1 天：仅吉西他滨" },
    description: {
      en: "Gem monotherapy infusion — lower toxicity than GnP.",
      zh: "吉西他滨单药输注 —— 毒性较 GnP 低。",
    },
  },
  {
    key: "dose_day",
    day_start: 8,
    day_end: 8,
    label: { en: "D8 gem", zh: "第 8 天：吉西他滨" },
    description: { en: "", zh: "" },
  },
  {
    key: "dose_day",
    day_start: 15,
    day_end: 15,
    label: { en: "D15 gem", zh: "第 15 天：吉西他滨" },
    description: { en: "", zh: "" },
  },
  {
    key: "nadir",
    day_start: 16,
    day_end: 21,
    label: { en: "Nadir", zh: "低谷" },
    description: {
      en: "Milder than GnP but still real — maintain hygiene.",
      zh: "比 GnP 轻但仍真实 —— 继续注意卫生。",
    },
  },
  {
    key: "recovery_late",
    day_start: 22,
    day_end: 28,
    label: { en: "Recovery", zh: "恢复" },
    description: { en: "", zh: "" },
  },
];

const PHASE_MFFX: PhaseWindow[] = [
  {
    key: "dose_day",
    day_start: 1,
    day_end: 1,
    label: { en: "Dose day (46h infusion start)", zh: "用药日（46 小时泵启动）" },
    description: {
      en: "Ox + irinotecan + leucovorin + 5-FU bolus, then 46h 5-FU via pump.",
      zh: "奥沙利铂 + 伊立替康 + 甲酰四氢叶酸 + 5-FU 推注，随后 46 小时 5-FU 持续泵注。",
    },
  },
  {
    key: "post_dose",
    day_start: 2,
    day_end: 3,
    label: { en: "Pump days", zh: "带泵天" },
    description: {
      en: "Cold sensitivity high — avoid cold foods, drinks, or air on skin.",
      zh: "对冷极度敏感 —— 避免冷饮、冷食、冷空气吹到皮肤。",
    },
  },
  {
    key: "post_dose",
    day_start: 3,
    day_end: 5,
    label: { en: "Post-pump", zh: "撤泵后" },
    description: {
      en: "Pump removed (usually D3). Fatigue, GI symptoms peak next 48–72h.",
      zh: "通常第 3 天撤泵。疲劳与消化道症状在随后 48–72 小时达峰。",
    },
  },
  {
    key: "nadir",
    day_start: 10,
    day_end: 14,
    label: { en: "Nadir", zh: "低谷" },
    description: {
      en: "Neutrophil nadir. Same precautions as GnP nadir.",
      zh: "中性粒细胞低谷 —— 注意事项同 GnP 低谷。",
    },
  },
  {
    key: "recovery_late",
    day_start: 10,
    day_end: 14,
    label: { en: "Recovery", zh: "恢复" },
    description: { en: "", zh: "" },
  },
];

export const PROTOCOL_LIBRARY: readonly Protocol[] = [
  {
    id: "gnp_weekly",
    short_name: "GnP weekly",
    name: { en: "Gemcitabine + nab-paclitaxel (weekly)", zh: "吉西他滨 + 白蛋白紫杉醇（每周）" },
    description: {
      en: "28-day cycle, doses on D1, D8, D15. D22 is rest. First-line standard for mPDAC.",
      zh: "28 天周期，第 1、8、15 天用药，第 22 天休息。转移性胰腺癌一线标准方案。",
    },
    cycle_length_days: 28,
    dose_days: [1, 8, 15],
    agents: [
      {
        id: "gemcitabine",
        name: "Gemcitabine",
        display: { en: "Gemcitabine", zh: "吉西他滨" },
        typical_dose: "1000 mg/m²",
        infusion_time_min: 30,
        dose_days: [1, 8, 15],
        route: "IV",
      },
      {
        id: "nab_paclitaxel",
        name: "nab-Paclitaxel",
        display: { en: "nab-Paclitaxel (Abraxane)", zh: "白蛋白紫杉醇（Abraxane）" },
        typical_dose: "125 mg/m²",
        infusion_time_min: 30,
        dose_days: [1, 8, 15],
        route: "IV",
      },
    ],
    premeds: {
      en: "Dexamethasone + 5-HT3 antagonist (e.g. ondansetron). Consider olanzapine for nausea coverage.",
      zh: "地塞米松 + 5-HT3 拮抗剂（如昂丹司琼）。恶心可酌情加用奥氮平。",
    },
    phase_windows: PHASE_GNP_WEEKLY,
    side_effect_profile: {
      en: "Myelosuppression (esp. neutrophils, peak D16–21), peripheral neuropathy (cumulative), fatigue, cold dysaesthesia acutely, nausea, alopecia, LFT derangement, rash.",
      zh: "骨髓抑制（尤其中性粒细胞，D16–21 峰），周围神经病变（累积），疲劳，急性遇冷异感，恶心，脱发，肝酶异常，皮疹。",
    },
    typical_supportive: [
      "supportive.gcsf_prophylaxis",
      "supportive.olanzapine",
      "supportive.duloxetine",
      "supportive.pert",
      "supportive.vte_prophylaxis",
    ],
  },
  {
    id: "gnp_biweekly",
    short_name: "GnP biweekly",
    name: { en: "Gemcitabine + nab-paclitaxel (D1 + D15)", zh: "吉西他滨 + 白蛋白紫杉醇（D1 + D15）" },
    description: {
      en: "28-day cycle, doses D1 and D15 only. Dose-sparing schedule for function preservation.",
      zh: "28 天周期，仅 D1 与 D15 用药。功能保留的减量方案。",
    },
    cycle_length_days: 28,
    dose_days: [1, 15],
    agents: [
      {
        id: "gemcitabine",
        name: "Gemcitabine",
        display: { en: "Gemcitabine", zh: "吉西他滨" },
        typical_dose: "1000 mg/m²",
        infusion_time_min: 30,
        dose_days: [1, 15],
        route: "IV",
      },
      {
        id: "nab_paclitaxel",
        name: "nab-Paclitaxel",
        display: { en: "nab-Paclitaxel (Abraxane)", zh: "白蛋白紫杉醇（Abraxane）" },
        typical_dose: "125 mg/m²",
        infusion_time_min: 30,
        dose_days: [1, 15],
        route: "IV",
      },
    ],
    premeds: {
      en: "Dexamethasone + ondansetron on dose days.",
      zh: "用药日：地塞米松 + 昂丹司琼。",
    },
    phase_windows: PHASE_GNP_BIWEEKLY,
    side_effect_profile: {
      en: "Similar profile to weekly GnP, with more recovery between doses. Neutrophil nadir still real; neuropathy accumulates slower.",
      zh: "毒性谱与每周方案相似但间歇更长。中性粒细胞低谷仍真实；神经病变累积更慢。",
    },
    typical_supportive: [
      "supportive.olanzapine",
      "supportive.duloxetine",
      "supportive.pert",
    ],
  },
  {
    id: "gem_maintenance",
    short_name: "Gem-only",
    name: { en: "Gemcitabine monotherapy (maintenance)", zh: "吉西他滨单药（维持）" },
    description: {
      en: "Weekly 3-on 1-off after response plateau. Lower toxicity than GnP; preserves function.",
      zh: "应答平台期后每周 3 次 1 周休息。毒性低于 GnP，更易保留功能。",
    },
    cycle_length_days: 28,
    dose_days: [1, 8, 15],
    agents: [
      {
        id: "gemcitabine",
        name: "Gemcitabine",
        display: { en: "Gemcitabine", zh: "吉西他滨" },
        typical_dose: "1000 mg/m²",
        infusion_time_min: 30,
        dose_days: [1, 8, 15],
        route: "IV",
      },
    ],
    premeds: {
      en: "Ondansetron prn. Dex often tapered off in maintenance.",
      zh: "按需昂丹司琼。维持期常可减停地塞米松。",
    },
    phase_windows: PHASE_GEM_MAINT,
    side_effect_profile: {
      en: "Flu-like symptoms, mild cytopenia, LFT derangement. No cold dysaesthesia. Less neuropathy.",
      zh: "流感样症状、轻度血象抑制、肝酶异常。无遇冷异感，神经病变较少。",
    },
    typical_supportive: ["supportive.pert"],
  },
  {
    id: "mffx",
    short_name: "mFFX",
    name: { en: "Modified FOLFIRINOX", zh: "改良 FOLFIRINOX" },
    description: {
      en: "14-day cycle. Day 1 infusion + 46h 5-FU pump. Higher response rate but more toxicity than GnP.",
      zh: "14 天周期。第 1 天输注 + 46 小时 5-FU 泵注。缓解率高，但毒性重于 GnP。",
    },
    cycle_length_days: 14,
    dose_days: [1, 2],
    agents: [
      {
        id: "oxaliplatin",
        name: "Oxaliplatin",
        display: { en: "Oxaliplatin", zh: "奥沙利铂" },
        typical_dose: "85 mg/m²",
        infusion_time_min: 120,
        dose_days: [1],
        route: "IV",
      },
      {
        id: "irinotecan",
        name: "Irinotecan",
        display: { en: "Irinotecan", zh: "伊立替康" },
        typical_dose: "150 mg/m²",
        infusion_time_min: 90,
        dose_days: [1],
        route: "IV",
      },
      {
        id: "leucovorin",
        name: "Leucovorin",
        display: { en: "Leucovorin", zh: "甲酰四氢叶酸" },
        typical_dose: "400 mg/m²",
        infusion_time_min: 30,
        dose_days: [1],
        route: "IV",
      },
      {
        id: "fluorouracil",
        name: "5-FU",
        display: { en: "5-FU (bolus + 46h pump)", zh: "5-FU（推注 + 46 小时泵）" },
        typical_dose: "2400 mg/m² over 46 h",
        dose_days: [1, 2],
        route: "IV",
      },
    ],
    premeds: {
      en: "Dex, ondansetron, aprepitant, atropine for irinotecan cholinergic syndrome.",
      zh: "地塞米松、昂丹司琼、阿瑞匹坦；阿托品用于伊立替康胆碱能综合征。",
    },
    phase_windows: PHASE_MFFX,
    side_effect_profile: {
      en: "Severe cold dysaesthesia (oxaliplatin), neutropenia, diarrhoea (irinotecan — acute cholinergic + delayed), fatigue, mucositis, neuropathy cumulative.",
      zh: "严重遇冷异感（奥沙利铂）、中性粒细胞减少、腹泻（伊立替康 —— 急性胆碱能 + 迟发）、疲劳、口腔炎、累积性神经病变。",
    },
    typical_supportive: [
      "supportive.gcsf_prophylaxis",
      "supportive.olanzapine",
      "supportive.duloxetine",
    ],
  },
  {
    id: "gnp_narmafotinib",
    short_name: "GnP + narmafotinib",
    name: {
      en: "Gemcitabine + nab-paclitaxel + narmafotinib",
      zh: "吉西他滨 + 白蛋白紫杉醇 + 纳马非替尼",
    },
    description: {
      en: "28-day GnP backbone (D1/D8/D15 infusions) plus continuous oral narmafotinib (AMP945) — an investigational FAK inhibitor studied in the ACCENT trial in mPDAC (NCT05355298). Hypothesis: disrupting stromal fibrosis improves chemo delivery. Standard GnP backbone monitoring (FBC, LFTs, U&Es D1/D8/D15) applies; oral adherence is critical.",
      zh: "28 天 GnP 框架（D1/D8/D15 输注）+ 每日连续口服纳马非替尼（AMP945）—— ACCENT 研究（NCT05355298）中用于转移性胰腺癌的试验性 FAK 抑制剂。设想：通过破坏肿瘤基质纤维化来提升化疗药物递送。沿用 GnP 骨干监测（D1/D8/D15 血常规、肝功、电解质）；口服依从性至关重要。",
    },
    cycle_length_days: 28,
    dose_days: [1, 8, 15],
    agents: [
      {
        id: "gemcitabine",
        name: "Gemcitabine",
        display: { en: "Gemcitabine", zh: "吉西他滨" },
        typical_dose: "1000 mg/m²",
        infusion_time_min: 30,
        dose_days: [1, 8, 15],
        route: "IV",
      },
      {
        id: "nab_paclitaxel",
        name: "nab-Paclitaxel",
        display: { en: "nab-Paclitaxel (Abraxane)", zh: "白蛋白紫杉醇（Abraxane）" },
        typical_dose: "125 mg/m²",
        infusion_time_min: 30,
        dose_days: [1, 8, 15],
        route: "IV",
      },
      {
        id: "narmafotinib",
        name: "Narmafotinib",
        display: { en: "Narmafotinib (AMP945)", zh: "纳马非替尼（AMP945）" },
        typical_dose: "400 mg PO once daily (continuous, ACCENT RP2D)",
        dose_days: [1],
        route: "PO",
        notes: {
          en: "Oral FAK (focal adhesion kinase) inhibitor. ACCENT trial RP2D is 400 mg once daily with food, continuous through the 28-day cycle. The reported DLT in the 400 mg cohort was Grade 3 nausea. Confirm hold-on-infusion-day policy with Dr Lee.",
          zh: "口服 FAK（黏着斑激酶）抑制剂。ACCENT 研究 RP2D 为 400 mg 每日一次与食物同服，28 天周期连续服用。400 mg 队列报告的 DLT 为 Grade 3 恶心。输液日是否暂停请与 Dr Lee 确认。",
        },
      },
    ],
    premeds: {
      en: "GnP premeds as usual on infusion days (dex + ondansetron). Narmafotinib itself: take with food; antiemetic cover for the first week is reasonable.",
      zh: "输液日 GnP 常规预用药（地塞米松 + 昂丹司琼）。纳马非替尼本身：与餐同服；第一周常规止吐覆盖合理。",
    },
    phase_windows: PHASE_GNP_WEEKLY,
    side_effect_profile: {
      en: "GnP toxicities (myelosuppression esp. D16–21, peripheral neuropathy, fatigue, cold dysaesthesia, alopecia) plus narmafotinib-specific signals: nausea (Grade 3 nausea was the reported DLT in the ACCENT 400 mg cohort), diarrhoea, fatigue. Oral adherence burden on top of IV cycle.",
      zh: "GnP 毒性（D16–21 骨髓抑制、周围神经病变、疲劳、遇冷异感、脱发）叠加纳马非替尼特有信号：恶心（ACCENT 400 mg 队列报告的 DLT 为 Grade 3 恶心）、腹泻、疲劳。在输注方案之外还有口服依从负担。",
    },
    typical_supportive: [
      "supportive.gcsf_prophylaxis",
      "supportive.olanzapine",
      "supportive.duloxetine",
      "supportive.pert",
      "supportive.vte_prophylaxis",
    ],
  },
];

export const PROTOCOL_BY_ID: Record<string, Protocol> = Object.fromEntries(
  PROTOCOL_LIBRARY.map((p) => [p.id, p]),
);
