import type { TaskPreset } from "~/types/task";

export const TASK_PRESETS: readonly TaskPreset[] = [
  // Environmental / household
  {
    id: "aircon_filter",
    title: {
      en: "Change airconditioner / HVAC filters",
      zh: "更换空调 / 新风系统滤网",
    },
    category: "environmental",
    schedule_kind: "recurring",
    recurrence_interval_days: 90,
    lead_time_days: 7,
    priority: "normal",
    default_due_offset_days: 0,
    rationale: {
      en: "Clean filters reduce airborne pathogens and dust exposure — matters most during nadir windows.",
      zh: "干净的滤网减少空气中的病原体与灰尘 —— 在骨髓抑制低谷期尤其重要。",
    },
  },
  {
    id: "water_filter",
    title: {
      en: "Replace water filter cartridge",
      zh: "更换净水器滤芯",
    },
    category: "environmental",
    schedule_kind: "recurring",
    recurrence_interval_days: 90,
    lead_time_days: 7,
    priority: "normal",
    rationale: {
      en: "Tap water via a tested carbon + reverse osmosis filter is safer than unfiltered during treatment.",
      zh: "经过活性炭 + 反渗透的自来水在治疗期间更安全。",
    },
  },
  {
    id: "toothbrush_swap",
    title: {
      en: "Replace toothbrush (soft)",
      zh: "更换软毛牙刷",
    },
    category: "dental",
    schedule_kind: "recurring",
    recurrence_interval_days: 28,
    lead_time_days: 3,
    priority: "normal",
    rationale: {
      en: "After each chemotherapy cycle — fresh soft bristles reduce mucositis and bleeding gums risk.",
      zh: "每个化疗周期后更换 —— 新的软毛减少口腔炎与牙龈出血。",
    },
  },
  {
    id: "bed_linen_weekly",
    title: {
      en: "Change bed linen (weekly; daily during nadir)",
      zh: "更换床单（每周一次；低谷期每日）",
    },
    category: "household",
    schedule_kind: "recurring",
    recurrence_interval_days: 7,
    lead_time_days: 0,
    priority: "normal",
    rationale: {
      en: "Regular linen change lowers skin infection risk. During nadir (D16–21 GnP weekly), change daily.",
      zh: "定期更换降低皮肤感染风险。GnP 每周方案的低谷期（D16–21）改为每日更换。",
    },
  },
  {
    id: "vacuum_damp_mop",
    title: {
      en: "Vacuum + damp mop living spaces",
      zh: "吸尘并湿拖起居空间",
    },
    category: "household",
    schedule_kind: "recurring",
    recurrence_interval_days: 7,
    lead_time_days: 0,
    priority: "low",
    rationale: {
      en: "Someone other than the patient does this — reduces dust and mould exposure.",
      zh: "由其他家人完成 —— 减少灰尘和霉菌暴露。",
    },
  },
  // Dental + clinical periphery
  {
    id: "dental_clean",
    title: { en: "Dental cleaning + check", zh: "洗牙 + 牙科检查" },
    category: "dental",
    schedule_kind: "recurring",
    recurrence_interval_days: 180,
    lead_time_days: 21,
    priority: "high",
    rationale: {
      en: "Every 6 months. Always disclose chemo regimen + last neutrophil count. Ask about antibiotic prophylaxis.",
      zh: "每 6 个月。告知化疗方案与最近中性粒细胞；询问是否需要抗生素预防。",
    },
  },
  {
    id: "nutrition_review",
    title: { en: "Dietitian review", zh: "营养师复查" },
    category: "nutrition",
    schedule_kind: "recurring",
    recurrence_interval_days: 90,
    lead_time_days: 14,
    priority: "high",
    rationale: {
      en: "Quarterly with an oncology dietitian. Reviews weight trajectory, protein intake, PERT dose, symptom-specific eating strategies.",
      zh: "每季度与肿瘤营养师复查：体重轨迹、蛋白摄入、胰酶替代剂量、针对症状的饮食策略。",
    },
  },
  {
    id: "exercise_physiology",
    title: {
      en: "Exercise physiology session",
      zh: "运动生理学 / 康复",
    },
    category: "physio",
    schedule_kind: "recurring",
    recurrence_interval_days: 28,
    lead_time_days: 7,
    priority: "high",
    rationale: {
      en: "Monthly with a cancer-trained exercise physiologist. Key lever against sarcopenia.",
      zh: "每月一次，由肿瘤方向的运动生理学家指导 —— 是抗肌少症最有效的手段。",
    },
  },
  {
    id: "pert_refill",
    title: {
      en: "PERT (Creon) refill",
      zh: "胰酶替代剂（Creon）补药",
    },
    category: "pharmacy",
    schedule_kind: "recurring",
    recurrence_interval_days: 60,
    lead_time_days: 10,
    priority: "high",
    rationale: {
      en: "Never run out — ordering takes time. 25 000 u with meals, 10 000 u with snacks.",
      zh: "不要断药 —— 订药需时。正餐 25 000 单位，加餐 10 000 单位。",
    },
  },
  {
    id: "antiemetic_refill",
    title: {
      en: "Antiemetic + supportive med refill",
      zh: "止吐与辅助药补药",
    },
    category: "pharmacy",
    schedule_kind: "recurring",
    recurrence_interval_days: 60,
    lead_time_days: 10,
    priority: "high",
    rationale: {
      en: "Check ondansetron, olanzapine, dexamethasone, loperamide stock before each cycle.",
      zh: "每周期前检查昂丹司琼、奥氮平、地塞米松、洛哌丁胺库存。",
    },
  },
  // Vaccines + preventive
  {
    id: "flu_vaccine",
    title: {
      en: "Influenza vaccine (annual)",
      zh: "流感疫苗（每年）",
    },
    category: "vaccine",
    schedule_kind: "recurring",
    recurrence_interval_days: 365,
    lead_time_days: 30,
    priority: "high",
    rationale: {
      en: "Ideally in Autumn before flu season. Get it with oncologist timing — avoid dose days.",
      zh: "最佳时间是秋季、流感季之前。与主诊协调时间 —— 避开用药日。",
    },
  },
  {
    id: "covid_booster",
    title: { en: "COVID-19 booster review", zh: "新冠疫苗加强针评估" },
    category: "vaccine",
    schedule_kind: "recurring",
    recurrence_interval_days: 180,
    lead_time_days: 14,
    priority: "normal",
    rationale: {
      en: "Every 6 months, check current immunocompromised-specific recommendations with GP or oncology.",
      zh: "每 6 个月一次，与家庭医师 / 肿瘤科核对免疫抑制相关的最新建议。",
    },
  },
  {
    id: "skin_check",
    title: {
      en: "Skin cancer check (dermatology)",
      zh: "皮肤癌筛查（皮肤科）",
    },
    category: "clinical",
    schedule_kind: "recurring",
    recurrence_interval_days: 365,
    lead_time_days: 30,
    priority: "normal",
    rationale: {
      en: "Annual. Increased skin cancer risk with immunosuppression + sun exposure in Australia.",
      zh: "每年一次。免疫抑制加澳洲日照环境下皮肤癌风险升高。",
    },
  },
  {
    id: "eye_check",
    title: { en: "Optometry / eye check", zh: "验光 / 眼科检查" },
    category: "clinical",
    schedule_kind: "recurring",
    recurrence_interval_days: 365,
    lead_time_days: 30,
    priority: "low",
    rationale: {
      en: "Annual. Some chemo affects tear film; good visual function supports independence.",
      zh: "每年一次。部分化疗影响泪膜；视力良好有助保持独立。",
    },
  },
  {
    id: "gp_review",
    title: { en: "GP health review", zh: "家庭医师综合复查" },
    category: "clinical",
    schedule_kind: "recurring",
    recurrence_interval_days: 90,
    lead_time_days: 14,
    priority: "normal",
    rationale: {
      en: "Quarterly — BP, weight, medication reconciliation, anything non-oncology.",
      zh: "每季度 —— 血压、体重、用药整理、与肿瘤无关的问题。",
    },
  },
  {
    id: "advance_care_review",
    title: {
      en: "Advance care directive review",
      zh: "预立医疗指示复查",
    },
    category: "admin",
    schedule_kind: "recurring",
    recurrence_interval_days: 180,
    lead_time_days: 30,
    priority: "high",
    rationale: {
      en: "Every 6 months, or after any significant change. Review with family; update with GP.",
      zh: "每 6 个月或出现重大变化后复查。与家人讨论，由家庭医师更新。",
    },
  },
  {
    id: "will_review",
    title: {
      en: "Will / estate document review",
      zh: "遗嘱 / 财产文件复查",
    },
    category: "admin",
    schedule_kind: "recurring",
    recurrence_interval_days: 365,
    lead_time_days: 30,
    priority: "normal",
    rationale: {
      en: "Annual review. Check executors, beneficiaries, powers of attorney are current.",
      zh: "每年复查。确认遗嘱执行人、受益人、授权书仍为最新。",
    },
  },
  // Cycle-relative tasks
  {
    id: "nadir_hygiene_check",
    title: {
      en: "Intensive hygiene — start of nadir",
      zh: "加强手卫生 —— 进入低谷期",
    },
    category: "self_care",
    schedule_kind: "cycle_phase",
    cycle_phase: "nadir",
    lead_time_days: 0,
    priority: "high",
    rationale: {
      en: "Hand sanitiser at every door, avoid sick contacts, temp twice daily, fresh linen daily, no raw food.",
      zh: "每个门口放手部消毒剂、远离患病者、一天两次测体温、每日换床品、不吃生食。",
    },
  },
  {
    id: "pet_care_handoff",
    title: {
      en: "Pet care handoff — no litter / cage cleaning",
      zh: "宠物护理移交 —— 不清理猫砂 / 鸟笼",
    },
    category: "self_care",
    schedule_kind: "cycle_phase",
    cycle_phase: "nadir",
    lead_time_days: 1,
    priority: "normal",
    rationale: {
      en: "Another household member handles litter / cage / fish tank during nadir to avoid zoonotic infection.",
      zh: "低谷期由其他家人清理猫砂 / 鸟笼 / 鱼缸以避免人畜共患感染。",
    },
  },
  {
    id: "pre_cycle_labs",
    title: {
      en: "Pre-treatment labs (CBC + LFT)",
      zh: "用药前化验（血常规 + 肝功能）",
    },
    category: "clinical",
    schedule_kind: "cycle_phase",
    cycle_phase: "pre_dose",
    lead_time_days: 1,
    priority: "high",
    rationale: {
      en: "24–48 h before each dose day. Needed for dose decision.",
      zh: "每个用药日前 24–48 小时。剂量决定需要此化验。",
    },
  },
];

export const TASK_PRESET_BY_ID: Record<string, TaskPreset> = Object.fromEntries(
  TASK_PRESETS.map((p) => [p.id, p]),
);
