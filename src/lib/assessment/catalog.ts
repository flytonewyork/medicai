export type TestCategory =
  | "physical"
  | "symptoms"
  | "toxicity"
  | "mental"
  | "spiritual";

export type TestId =
  | "anthropometrics"
  | "vitals"
  | "ecog"
  | "sarcf"
  | "grip"
  | "gait"
  | "sts30"
  | "sts5x"
  | "tug"
  | "single_leg_stance"
  | "walk6min"
  | "pain"
  | "fatigue"
  | "gi"
  | "respiratory"
  | "constitutional"
  | "neuropathy"
  | "mucositis"
  | "cognitive"
  | "skin"
  | "phq9"
  | "gad7"
  | "distress"
  | "sleep"
  | "facitsp"
  | "values_practice";

export interface TestDef {
  id: TestId;
  category: TestCategory;
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  est_minutes: number;
  equipment?: { en: string; zh: string };
  default_on: boolean;
}

export const TEST_CATALOG: TestDef[] = [
  {
    id: "anthropometrics",
    category: "physical",
    title: { en: "Anthropometrics", zh: "人体测量" },
    description: {
      en: "Weight, height, upper-arm (MUAC) and calf circumference. Proxies for muscle mass.",
      zh: "体重、身高、上臂围（MUAC）与小腿围 —— 反映肌肉量。",
    },
    est_minutes: 4,
    equipment: { en: "Scale + soft tape measure", zh: "体重秤 + 软尺" },
    default_on: true,
  },
  {
    id: "vitals",
    category: "physical",
    title: { en: "Vital signs", zh: "生命体征" },
    description: {
      en: "Resting heart rate, blood pressure, SpO₂. Optional — only if you have a cuff / oximeter at home.",
      zh: "静息心率、血压、血氧。仅在家里有相关仪器时填写。",
    },
    est_minutes: 3,
    equipment: {
      en: "BP cuff and/or pulse oximeter (optional)",
      zh: "血压计 / 血氧仪（可选）",
    },
    default_on: false,
  },
  {
    id: "ecog",
    category: "physical",
    title: { en: "ECOG self-report", zh: "ECOG 自评" },
    description: {
      en: "One-line activity-level self-rating. The most reported functional score in oncology.",
      zh: "一行活动水平自评 —— 肿瘤学中最常用的功能评分。",
    },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "sarcf",
    category: "physical",
    title: { en: "SARC-F screen", zh: "SARC-F 筛查" },
    description: {
      en: "5-question sarcopenia screen. Needs no equipment. ≥4 flags further assessment.",
      zh: "五题肌少症筛查，无需器材。总分 ≥ 4 建议进一步评估。",
    },
    est_minutes: 2,
    default_on: true,
  },
  {
    id: "grip",
    category: "physical",
    title: { en: "Grip strength", zh: "握力" },
    description: {
      en: "Best of 3 squeezes per hand on a dynamometer. The single most predictive strength measure.",
      zh: "握力器每手三次取最大。是预测性最强的单项力量测试。",
    },
    est_minutes: 3,
    equipment: {
      en: "Jamar or Camry hand dynamometer",
      zh: "Jamar 或 Camry 握力器",
    },
    default_on: true,
  },
  {
    id: "gait",
    category: "physical",
    title: { en: "4 m gait speed", zh: "4 米步速" },
    description: {
      en: "Walk a marked 4 m at your usual pace. <0.8 m/s suggests frailty.",
      zh: "以平常速度走标出的 4 米。< 0.8 米/秒提示虚弱。",
    },
    est_minutes: 2,
    equipment: { en: "4 m of clear floor + phone stopwatch", zh: "4 米平地 + 秒表" },
    default_on: true,
  },
  {
    id: "sts30",
    category: "physical",
    title: { en: "30-s sit-to-stand", zh: "30 秒坐立" },
    description: {
      en: "Complete sit-to-stand cycles in 30 seconds, arms crossed.",
      zh: "30 秒内完成坐立循环次数，双臂交叉胸前。",
    },
    est_minutes: 2,
    equipment: { en: "Standard chair", zh: "标准椅子" },
    default_on: true,
  },
  {
    id: "sts5x",
    category: "physical",
    title: { en: "5× sit-to-stand", zh: "5 次坐立" },
    description: {
      en: "Time to complete 5 full sit-to-stand cycles. >15 s suggests low lower-body strength.",
      zh: "完成 5 次完整坐立所需时间。> 15 秒提示下肢力量较低。",
    },
    est_minutes: 2,
    equipment: { en: "Standard chair + stopwatch", zh: "标准椅子 + 秒表" },
    default_on: true,
  },
  {
    id: "tug",
    category: "physical",
    title: { en: "Timed Up-and-Go", zh: "Timed Up-and-Go" },
    description: {
      en: "Stand, walk 3 m, turn, walk back, sit down. >14 s = elevated fall risk.",
      zh: "站起，走 3 米，折返，坐下。> 14 秒提示跌倒风险升高。",
    },
    est_minutes: 2,
    equipment: { en: "Chair + 3 m of space + stopwatch", zh: "椅子 + 3 米空间 + 秒表" },
    default_on: true,
  },
  {
    id: "single_leg_stance",
    category: "physical",
    title: { en: "Single-leg stance", zh: "单腿站立" },
    description: {
      en: "Time standing on one leg. Balance + falls-risk proxy.",
      zh: "单腿站立时间 —— 平衡与跌倒风险的代用指标。",
    },
    est_minutes: 2,
    default_on: false,
  },
  {
    id: "walk6min",
    category: "physical",
    title: { en: "6-minute walk", zh: "6 分钟步行" },
    description: {
      en: "Total distance walked in 6 minutes. Aerobic capacity proxy.",
      zh: "6 分钟内累计步行距离 —— 有氧能力代用指标。",
    },
    est_minutes: 7,
    equipment: {
      en: "30 m corridor or treadmill",
      zh: "30 米走廊或跑步机",
    },
    default_on: false,
  },
  {
    id: "pain",
    category: "symptoms",
    title: { en: "Pain inventory", zh: "疼痛量表" },
    description: {
      en: "Worst / current pain, functional interference, location and character.",
      zh: "最痛 / 目前疼痛、对生活影响、部位与性质。",
    },
    est_minutes: 2,
    default_on: true,
  },
  {
    id: "fatigue",
    category: "symptoms",
    title: { en: "Fatigue", zh: "疲劳" },
    description: {
      en: "Severity and functional interference over the past week (PRO-CTCAE-aligned).",
      zh: "过去一周的严重度与功能影响（与 PRO-CTCAE 对齐）。",
    },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "gi",
    category: "symptoms",
    title: { en: "GI symptoms", zh: "消化道症状" },
    description: {
      en: "Appetite, nausea, vomiting, diarrhoea, constipation, jaundice, pruritus.",
      zh: "食欲、恶心、呕吐、腹泻、便秘、黄疸、瘙痒。",
    },
    est_minutes: 2,
    default_on: true,
  },
  {
    id: "respiratory",
    category: "symptoms",
    title: { en: "Respiratory", zh: "呼吸系统" },
    description: { en: "Dyspnoea and cough severity.", zh: "气促与咳嗽严重度。" },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "constitutional",
    category: "symptoms",
    title: { en: "Constitutional", zh: "全身症状" },
    description: {
      en: "Fever, night sweats, unintentional weight loss.",
      zh: "发热、盗汗、非意愿性体重减轻。",
    },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "neuropathy",
    category: "toxicity",
    title: { en: "Peripheral neuropathy", zh: "周围神经病变" },
    description: {
      en: "Grade hands and feet separately (CTCAE 0–4).",
      zh: "按 CTCAE 分别给手与脚打分 0–4。",
    },
    est_minutes: 2,
    default_on: true,
  },
  {
    id: "mucositis",
    category: "toxicity",
    title: { en: "Mouth / mucositis + cold dysaesthesia", zh: "口腔炎与遇冷异感" },
    description: {
      en: "Oral mucositis severity and cold dysaesthesia intensity.",
      zh: "口腔黏膜炎严重度与遇冷异感强度。",
    },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "cognitive",
    category: "toxicity",
    title: { en: "Cognitive concern", zh: "认知担忧" },
    description: {
      en: "Subjective chemo-brain rating. 0 = no concern, 10 = severely impaired.",
      zh: "主观化疗脑评分。0 = 没问题，10 = 明显受损。",
    },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "skin",
    category: "toxicity",
    title: { en: "Skin / nails / bruising", zh: "皮肤 / 指甲 / 淤青" },
    description: {
      en: "Skin changes, nail changes, easy bruising flags.",
      zh: "皮肤改变、指甲改变、易淤青。",
    },
    est_minutes: 1,
    default_on: false,
  },
  {
    id: "phq9",
    category: "mental",
    title: { en: "PHQ-9", zh: "PHQ-9 抑郁量表" },
    description: {
      en: "9-item validated depression screen. ≥10 flags clinical review.",
      zh: "9 项抑郁筛查。≥10 建议临床复核。",
    },
    est_minutes: 4,
    default_on: true,
  },
  {
    id: "gad7",
    category: "mental",
    title: { en: "GAD-7", zh: "GAD-7 焦虑量表" },
    description: {
      en: "7-item validated anxiety screen. ≥10 flags clinical review.",
      zh: "7 项焦虑筛查。≥10 建议临床复核。",
    },
    est_minutes: 3,
    default_on: true,
  },
  {
    id: "distress",
    category: "mental",
    title: { en: "Distress thermometer", zh: "痛苦温度计" },
    description: {
      en: "Single 0–10 rating covering emotional, physical, family, practical.",
      zh: "单项 0–10 评分：情绪、身体、家庭、实际。",
    },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "sleep",
    category: "mental",
    title: { en: "Sleep", zh: "睡眠" },
    description: { en: "Sleep quality 0–10 and average hours per night.", zh: "睡眠质量 0–10 与平均每晚时数。" },
    est_minutes: 1,
    default_on: true,
  },
  {
    id: "facitsp",
    category: "spiritual",
    title: { en: "FACIT-Sp subset", zh: "FACIT-Sp 子量表" },
    description: {
      en: "8 items on meaning, peace, and faith. Validated in oncology.",
      zh: "8 项关于意义、平静与信仰的问题（肿瘤学中验证）。",
    },
    est_minutes: 4,
    default_on: true,
  },
  {
    id: "values_practice",
    category: "spiritual",
    title: { en: "Values + practice", zh: "价值观与修习" },
    description: {
      en: "A few sentences on what matters this season + practice days in the past week.",
      zh: "几句话写下这阶段最看重的事 + 过去一周的修习天数。",
    },
    est_minutes: 3,
    default_on: true,
  },
];

export type PresetId = "comprehensive" | "quick" | "function" | "custom";

export const PRESETS: Record<
  PresetId,
  { title: { en: string; zh: string }; description: { en: string; zh: string }; tests: TestId[] }
> = {
  comprehensive: {
    title: { en: "Comprehensive baseline", zh: "完整基线" },
    description: {
      en: "Every default-on test. Recommended for your first baseline or a quarterly review.",
      zh: "全部默认启用的测试。首次基线或每季复评推荐。",
    },
    tests: TEST_CATALOG.filter((t) => t.default_on).map((t) => t.id),
  },
  quick: {
    title: { en: "Quick check (≈15 min)", zh: "快速检查（约 15 分钟）" },
    description: {
      en: "Essentials only — ECOG, SARC-F, grip, gait, pain, fatigue, distress, sleep.",
      zh: "仅基本项 —— ECOG、SARC-F、握力、步速、疼痛、疲劳、痛苦、睡眠。",
    },
    tests: [
      "ecog",
      "sarcf",
      "grip",
      "gait",
      "pain",
      "fatigue",
      "distress",
      "sleep",
    ],
  },
  function: {
    title: { en: "Function-only", zh: "仅功能" },
    description: {
      en: "All physical tests, no symptom / mental / spiritual modules.",
      zh: "仅物理功能测试，不含症状 / 心理 / 灵性模块。",
    },
    tests: [
      "anthropometrics",
      "ecog",
      "sarcf",
      "grip",
      "gait",
      "sts30",
      "sts5x",
      "tug",
    ],
  },
  custom: {
    title: { en: "Custom", zh: "自定义" },
    description: {
      en: "Start with nothing selected and pick your own.",
      zh: "从零开始自行选择。",
    },
    tests: [],
  },
};

export function totalMinutes(tests: TestId[]): number {
  const set = new Set(tests);
  return TEST_CATALOG.filter((t) => set.has(t.id)).reduce(
    (a, t) => a + t.est_minutes,
    0,
  );
}

export function testById(id: TestId): TestDef | undefined {
  return TEST_CATALOG.find((t) => t.id === id);
}
