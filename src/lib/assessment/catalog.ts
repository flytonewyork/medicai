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
  // Numbered, read-aloud-ready setup steps for the helper. Empty for
  // questionnaire tests where the on-screen form already drives the
  // patient. Tier-3-validated functional tests get explicit choreography
  // so the helper doesn't have to remember the protocol.
  instructions?: { en: string[]; zh: string[] };
  // True when the wizard offers a built-in timer / counter rather than
  // expecting the helper to bring a stopwatch.
  has_builtin_timer?: boolean;
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
    instructions: {
      en: [
        "Weigh in light clothing, no shoes, same scale as last time if possible.",
        "MUAC: tape around the bare upper arm, midway between shoulder tip and elbow. Snug, not tight.",
        "Calf: tape around the widest part of the dominant calf, foot flat on the floor.",
        "Read each tape measurement to the nearest 0.5 cm.",
      ],
      zh: [
        "穿轻便衣物、脱鞋称重；尽量用上次同一台秤。",
        "上臂围（MUAC）：把软尺绕在裸露的上臂中段（肩头到肘部的一半），贴紧但不勒。",
        "小腿围：脚平放地面，把软尺绕在惯用腿小腿最粗处。",
        "每个围度读到最接近的 0.5 厘米。",
      ],
    },
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
    instructions: {
      en: [
        "Read each level out loud. Pick the one that best describes a typical day this past week — not today specifically.",
        "0 = fully active, no restrictions. 1 = light activity OK, no heavy work. 2 = up >50% of the day, can self-care, no work. 3 = up <50% of the day, limited self-care. 4 = bedbound.",
        "If the patient is between two levels, pick the higher number (more limited).",
      ],
      zh: [
        "把每一档大声念给患者听。选最能描述「这一周里典型一天」的那一档（不是只看今天）。",
        "0 = 完全活动、无限制；1 = 可做轻活、不能干重活；2 = 白天超过一半时间在站立 / 走动、能自理、不能工作；3 = 白天一半以上时间在床或椅、自理受限；4 = 长期卧床。",
        "若介于两档之间，取较高（受限较重）的那一档。",
      ],
    },
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
    instructions: {
      en: [
        "Five quick questions about strength, walking, rising from a chair, climbing stairs, and falls.",
        "Answer about typical recent function — not the worst day, not the best day.",
        "Total ≥ 4 flags possible sarcopenia and triggers the conversation.",
      ],
      zh: [
        "五道关于力量、行走、起身、爬楼梯、跌倒的简短问题。",
        "按「最近的典型情况」回答 —— 不是最糟的一天，也不是最好的一天。",
        "总分 ≥ 4 提示可能存在肌少症，需要进一步沟通。",
      ],
    },
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
    instructions: {
      en: [
        "Sit in a chair with feet flat. Elbow bent at 90°, arm by the side, wrist neutral.",
        "Set the dynamometer to position 2 (second handle slot).",
        "On 'squeeze', squeeze as hard as possible for 3–5 seconds, then relax. No breath holding.",
        "Three squeezes per hand, with at least 30 seconds rest between. Enter the best of three for each hand.",
      ],
      zh: [
        "坐在椅子上，双脚平放；肘关节弯曲 90°，手臂自然下垂，手腕中立。",
        "把握力器调到第二档（second handle slot）。",
        "听到「抓」时，全力握紧 3–5 秒，然后放松。不要憋气。",
        "每只手做三次，每次之间至少休息 30 秒。每只手填入三次中的最大值。",
      ],
    },
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
    equipment: { en: "4 m of clear floor (built-in timer)", zh: "4 米平地（内置计时器）" },
    default_on: true,
    has_builtin_timer: true,
    instructions: {
      en: [
        "Mark a clear 4-metre path. Add a 1-metre run-up before the start line and a 1-metre slow-down after the finish.",
        "Patient stands at the start line. Cue: 'Walk at your usual pace, all the way past the finish line.'",
        "Tap Start as the patient's leading foot crosses the start line.",
        "Tap Stop as the leading foot crosses the finish line. We compute m/s automatically.",
      ],
      zh: [
        "划出 4 米直线步道；起点前留 1 米助跑、终点后留 1 米缓冲。",
        "患者站在起点线上。提示：「以平常的速度向前走，越过终点线后再停。」",
        "前脚跨过起点线时按「开始」。",
        "前脚跨过终点线时按「停止」。系统会自动算出 米/秒。",
      ],
    },
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
    equipment: { en: "Standard chair (built-in timer)", zh: "标准椅子（内置计时器）" },
    default_on: true,
    has_builtin_timer: true,
    instructions: {
      en: [
        "Use a sturdy chair without arms, against a wall. Seat ~43–45 cm tall.",
        "Patient sits with back against the chair, arms crossed over chest, feet flat.",
        "Cue: 'Stand up fully, then sit down fully — keep going as fast as you safely can.'",
        "Tap Start to begin a 30-second countdown. Tap the big counter once for every full sit→stand→sit cycle.",
        "When the timer ends, the count is saved automatically.",
      ],
      zh: [
        "用一张坚固的无扶手椅子，靠墙；座面高度约 43–45 厘米。",
        "患者背靠椅背坐下，双臂交叉抱胸，双脚平放。",
        "提示：「在能安全的速度下，尽快地完整站起、再完整坐下。」",
        "按「开始」启动 30 秒倒计时。每完成一个完整「坐→站→坐」循环，点一次大按钮。",
        "倒计时结束后，次数会自动保存。",
      ],
    },
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
    equipment: { en: "Standard chair (built-in timer)", zh: "标准椅子（内置计时器）" },
    default_on: true,
    has_builtin_timer: true,
    instructions: {
      en: [
        "Same chair as the 30-s test. Arms crossed over chest, feet flat.",
        "Cue: 'When I say go, stand up and sit down 5 times as fast as you safely can.'",
        "Tap Start. The patient performs 5 full cycles.",
        "Tap Stop the moment the patient sits down on the 5th rep. We save the elapsed seconds.",
      ],
      zh: [
        "同一张椅子。双臂交叉抱胸，双脚平放。",
        "提示：「我说『开始』后，请尽快、安全地完整站起再坐下，共 5 次。」",
        "按「开始」。患者完成 5 个完整循环。",
        "第 5 次坐下的瞬间按「停止」。系统会保存所用秒数。",
      ],
    },
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
    equipment: { en: "Chair + 3 m of space (built-in timer)", zh: "椅子 + 3 米空间（内置计时器）" },
    default_on: true,
    has_builtin_timer: true,
    instructions: {
      en: [
        "Place a chair against a wall. Mark a turnaround point exactly 3 m in front of the chair.",
        "Patient sits with back against the chair, arms on lap, feet flat.",
        "Cue: 'On go, stand up, walk to the marker, turn around, walk back, and sit down.'",
        "Tap Start at 'go'. Tap Stop the moment the patient's bottom touches the chair on return.",
      ],
      zh: [
        "椅子靠墙放好；在椅子正前方 3 米处做一个折返标记。",
        "患者背靠椅背、双手放在大腿上、双脚平放。",
        "提示：「我说『开始』后，请站起、走到标记处、转身、走回来再坐下。」",
        "听到「开始」时按「开始」键；患者回来坐到椅子那一刻按「停止」。",
      ],
    },
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
    has_builtin_timer: true,
    instructions: {
      en: [
        "Stand near a wall or a steady chair so the patient can grab if needed.",
        "Cross arms over chest. Lift one leg so the foot is just off the floor (don't rest it on the other leg).",
        "Tap Start as the foot leaves the floor. Eyes open, looking forward.",
        "Tap Stop the moment the lifted foot touches the floor, the standing foot moves, or the arms uncross. Cap at 60 s.",
      ],
      zh: [
        "在墙边或稳固椅子旁边进行，患者随时可扶。",
        "双臂交叉抱胸；抬起一只脚，使其略离地面（不要靠在另一条腿上）。",
        "脚一离地，按「开始」；睁眼、目视前方。",
        "抬起的脚落地、支撑脚移动、或双臂松开时按「停止」。最多记到 60 秒。",
      ],
    },
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
      en: "30 m corridor or treadmill (built-in timer)",
      zh: "30 米走廊或跑步机（内置计时器）",
    },
    default_on: false,
    has_builtin_timer: true,
    instructions: {
      en: [
        "Mark a 30-m straight course (or use a treadmill). Patient walks back and forth around two cones.",
        "Cue: 'Walk as far as you can in 6 minutes — you may slow or rest, but keep going if you can.'",
        "Tap Start to begin the 6:00 countdown. Tap +30m each time the patient passes the cone.",
        "When the timer ends, the total distance is saved. You can also enter a metres value directly.",
      ],
      zh: [
        "标出 30 米直线（或用跑步机）；患者绕两个标记往返行走。",
        "提示：「在 6 分钟内走得越远越好；可以放慢或休息，但请尽量持续。」",
        "按「开始」启动 6 分钟倒计时；每经过标记处点一次「+30 米」。",
        "倒计时结束后，距离自动保存。也可以直接输入米数。",
      ],
    },
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
    instructions: {
      en: [
        "Ask about each side separately: numbness, tingling, burning, pain, cold-triggered tingling.",
        "0 = none. 1 = mild, no impact. 2 = moderate, some daily-task impact (buttons, keys, balance). 3 = severe, limits self-care. 4 = disabling.",
        "If the patient describes problems doing buttons, holding keys, or feeling cold things sharply — that's at least grade 2.",
      ],
      zh: [
        "分别询问左右手、左右脚：麻木、刺痛、灼热、疼痛、遇冷加剧的针刺感。",
        "0 = 没有；1 = 轻微，不影响生活；2 = 中度，影响日常任务（扣扣子、握钥匙、平衡）；3 = 严重，影响自理；4 = 致残。",
        "若患者反映扣扣子、握钥匙困难，或对冷物有尖锐感觉 —— 至少属于 2 级。",
      ],
    },
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
