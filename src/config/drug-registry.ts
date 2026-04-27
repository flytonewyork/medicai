import type { DrugInfo, DoseSchedule } from "~/types/medication";

// Common schedule templates to reduce duplication
const SCHED_BID_MEALS: DoseSchedule = {
  kind: "with_meals",
  times_per_day: 2,
  label: { en: "Twice daily with meals", zh: "每日两次，与餐同服" },
};

const SCHED_TID_MEALS: DoseSchedule = {
  kind: "with_meals",
  times_per_day: 3,
  label: { en: "Three times daily with meals", zh: "每日三次，与餐同服" },
};

const SCHED_DAILY: DoseSchedule = {
  kind: "fixed",
  times_per_day: 1,
  clock_times: ["08:00"],
  label: { en: "Once daily morning", zh: "每日一次，早上" },
};

const SCHED_NIGHTLY: DoseSchedule = {
  kind: "fixed",
  times_per_day: 1,
  clock_times: ["20:00"],
  label: { en: "Once daily evening", zh: "每日一次，晚上" },
};

const SCHED_PRN: DoseSchedule = {
  kind: "prn",
  label: { en: "As needed", zh: "按需" },
};

// ============================================================================
// CHEMOTHERAPY & TARGETED AGENTS
// ============================================================================

const GEMCITABINE: DrugInfo = {
  id: "gemcitabine",
  name: { en: "Gemcitabine", zh: "吉西他滨" },
  aliases: ["Gemzar"],
  category: "chemo",
  default_route: "IV",
  mpdac_relevant: true,
  drug_class: {
    en: "Nucleoside analogue — antimetabolite",
    zh: "核苷类似物 —— 抗代谢药",
  },
  mechanism: {
    en: "Inhibits DNA synthesis by mimicking deoxyribose. Activates apoptosis in rapidly dividing cells. First-line backbone for mPDAC.",
    zh: "模拟脱氧核糖抑制 DNA 合成，激发快速分裂细胞凋亡。转移性胰腺癌一线骨干药物。",
  },
  typical_doses: [
    { en: "1000 mg/m² IV", zh: "1000 mg/m² 静脉注射" },
  ],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1, 8, 15],
      label: { en: "D1/D8/D15 of 28-day cycle", zh: "28 天周期的 D1/D8/D15" },
    },
  ],
  side_effects: {
    common: [
      {
        en: "Myelosuppression (neutrophils, platelets, RBC) — nadir D10–14",
        zh: "骨髓抑制（中性粒细胞、血小板、红细胞）—— D10–14 低谷",
      },
      { en: "Nausea, vomiting, loss of appetite", zh: "恶心、呕吐、食欲不振" },
      { en: "Fatigue, malaise", zh: "疲劳、不适感" },
      { en: "Flu-like syndrome (myalgia, fever)", zh: "流感样症状（肌肉痛、发热）" },
      {
        en: "Rash, mild alopecia, nail changes",
        zh: "皮疹、轻度脱发、指甲改变",
      },
    ],
    serious: [
      {
        en: "Febrile neutropenia — fever + ANC <500 is oncologic emergency",
        zh: "发热性中性粒细胞减少 —— 发热 + ANC <500 是肿瘤学急症",
      },
      { en: "Hemolytic-uremic syndrome (rare, <1%)", zh: "溶血尿毒综合征（罕见，<1%）" },
      {
        en: "Hepatotoxicity, elevated transaminases",
        zh: "肝毒性、转氨酶升高",
      },
    ],
  },
  monitoring: [
    {
      en: "FBC (CBC) before each dose; ANC <1000 → hold or delay",
      zh: "每次用药前查血常规；ANC <1000 → 暂停或延期",
    },
    {
      en: "LFTs (ALT, AST, ALP, bilirubin) — baseline and D22",
      zh: "肝功（ALT、AST、ALP、胆红素）—— 基线和 D22",
    },
    { en: "U&Es, creatinine", zh: "电解质、肌酐" },
  ],
  diet_interactions: [],
  protocol_ids: ["gnp_weekly", "gnp_biweekly", "gem_maintenance"],
  supportive_id: undefined,
  references: [
    {
      source: "eviQ",
      title:
        "eviQ Protocol 1375 — Pancreas metastatic: gemcitabine and nab-PACLitaxel (NSW Cancer Institute)",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1375-pancreas-metastatic-gemcitabine-and-nab-pacli",
      accessed: "2026-04-21",
      section: "Dose / schedule / pre-treatment assessments",
    },
    {
      source: "FDA_label",
      title:
        "GEMCITABINE for Injection — Highlights of Prescribing Information",
      publisher: "FDA",
      url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2014/020509s077lbl.pdf",
      accessed: "2026-04-21",
      section: "5.1 Schedule-dependent toxicity / 6.1 Myelosuppression",
    },
  ],
  prompt_facts: {
    nadir: {
      value: {
        // FDA label requires CBC before each dose; combination GnP literature
        // and the Abraxane label specify D8 + D15 pre-dose CBC. The post-D1
        // counts trough across this window — keep the watch window broad and
        // safety-oriented rather than asserting a single nadir day.
        start_day: 8,
        end_day: 15,
        counts: ["ANC", "platelets"],
        rationale: {
          en: "Myelosuppression is the dose-limiting toxicity. eviQ 1375 and FDA labels require pre-dose CBC on D1/D8/D15 of the 28-day cycle; dose modifications key off Day 8 ANC and platelet counts.",
          zh: "骨髓抑制为剂量限制毒性。eviQ 1375 与 FDA 标签要求 28 天周期 D1/D8/D15 化疗前查血常规；D8 的 ANC 与血小板决定剂量调整。",
        },
      },
      source_refs: [0, 1],
    },
  },
  clinical_note: {
    en: "The patient tolerates weekly GnP well. Monitor for cumulative neuropathy and declining counts. Australian protocol: eviQ 1375.",
    zh: "患者对每周 GnP 耐受良好。监测累积性神经病变和血象下降。澳洲方案：eviQ 1375。",
  },
};

const NAB_PACLITAXEL: DrugInfo = {
  id: "nab_paclitaxel",
  name: { en: "nab-Paclitaxel", zh: "白蛋白紫杉醇" },
  aliases: ["Abraxane", "albumin-bound paclitaxel"],
  category: "chemo",
  default_route: "IV",
  mpdac_relevant: true,
  drug_class: {
    en: "Taxane — microtubule stabilizer",
    zh: "紫杉烷类 —— 微管稳定剂",
  },
  mechanism: {
    en: "Binds to β-tubulin; stabilizes microtubules and inhibits mitosis. Albumin-bound formulation reduces hypersensitivity; nanoparticle delivers drug to tumor stroma.",
    zh: "结合 β-微管蛋白，稳定微管并抑制有丝分裂。白蛋白结合制剂减少过敏反应；纳米粒递送药物至肿瘤基质。",
  },
  typical_doses: [{ en: "125 mg/m² IV", zh: "125 mg/m² 静脉注射" }],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1, 8, 15],
      label: { en: "D1/D8/D15 of 28-day cycle", zh: "28 天周期的 D1/D8/D15" },
    },
  ],
  side_effects: {
    common: [
      {
        en: "Peripheral neuropathy (cumulative, dose-dependent) — paresthesia, numbness",
        zh: "周围神经病变（累积的、剂量相关的）—— 感觉异常、麻木",
      },
      { en: "Myalgia, arthralgia (joint/muscle pain)", zh: "肌痛、关节痛" },
      { en: "Fatigue", zh: "疲劳" },
      { en: "Alopecia (hair loss)", zh: "脱发" },
      {
        en: "Mild nausea, vomiting (less than gemcitabine alone)",
        zh: "轻度恶心、呕吐（轻于单用吉西他滨）",
      },
    ],
    serious: [
      {
        en: "Severe peripheral neuropathy — may be irreversible, dose-limiting",
        zh: "严重周围神经病变 —— 可能不可逆，剂量限制性",
      },
      {
        en: "Myelosuppression (less common than gemcitabine)",
        zh: "骨髓抑制（不如吉西他滨常见）",
      },
    ],
  },
  monitoring: [
    {
      en: "Neuropathy grade at each visit (CTCAE v5). Dose hold or reduce if Grade 2+.",
      zh: "每次就诊评估神经病变分级（CTCAE v5）。分级 2+ 时暂停或减量。",
    },
    { en: "FBC before each dose", zh: "每次用药前查血常规" },
  ],
  diet_interactions: [],
  protocol_ids: ["gnp_weekly", "gnp_biweekly"],
  references: [
    {
      source: "eviQ",
      title:
        "eviQ Protocol 1375 — Pancreas metastatic: gemcitabine and nab-PACLitaxel",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1375-pancreas-metastatic-gemcitabine-and-nab-pacli",
      accessed: "2026-04-21",
      section: "Nab-paclitaxel 125 mg/m² D1/D8/D15; pre-treatment CBC; ANC ≥ 1.5 × 10⁹/L, platelets ≥ 100 × 10⁹/L",
    },
    {
      source: "FDA_label",
      title:
        "ABRAXANE (paclitaxel protein-bound particles) — Highlights of Prescribing Information",
      publisher: "FDA",
      url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2020/021660s047lbl.pdf",
      accessed: "2026-04-21",
      section:
        "2.4 Dose Modifications, Pancreatic Cancer / 5.1 Hematologic effects",
    },
  ],
  prompt_facts: {
    nadir: {
      value: {
        start_day: 8,
        end_day: 15,
        counts: ["ANC", "platelets"],
        rationale: {
          en: "eviQ 1375 and the Abraxane FDA label require pre-dose CBC on D1, D8, and D15 of each 28-day cycle. ANC ≥ 1.5 × 10⁹/L and platelets ≥ 100 × 10⁹/L are the eviQ pre-treatment thresholds.",
          zh: "eviQ 1375 与 Abraxane FDA 标签要求每 28 天周期 D1、D8、D15 化疗前查血常规。eviQ 治疗前阈值：ANC ≥ 1.5 × 10⁹/L，血小板 ≥ 100 × 10⁹/L。",
        },
      },
      source_refs: [0, 1],
    },
  },
  clinical_note: {
    en: "Cumulative neuropathy is the main toxicity. Early flagging of tingling/numbness is critical to preserve function.",
    zh: "累积性神经病变是主要毒性。早期标记刺痛 / 麻木对保留功能至关重要。",
  },
};

const NARMAFOTINIB: DrugInfo = {
  id: "narmafotinib",
  name: { en: "Narmafotinib", zh: "纳马非替尼" },
  aliases: ["AMP945"],
  category: "targeted",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: {
    en: "FAK (focal adhesion kinase) inhibitor",
    zh: "FAK（黏着斑激酶）抑制剂",
  },
  mechanism: {
    en: "Inhibits focal adhesion kinase, reducing stromal fibrosis and remodeling. Hypothesized to improve gemcitabine delivery in mPDAC. Under investigation in ACCENT trial.",
    zh: "抑制黏着斑激酶，减少基质纤维化和重建。假设改善吉西他滨在转移性胰腺癌中的递送。在 ACCENT 研究中调查。",
  },
  typical_doses: [
    { en: "400 mg PO once daily (RP2D, ACCENT trial)", zh: "400 mg 口服，每日一次（RP2D，ACCENT 试验）" },
  ],
  default_schedules: [
    {
      kind: "with_meals",
      times_per_day: 1,
      label: {
        en: "400 mg once daily with food, continuous throughout 28-day cycle",
        zh: "400 mg 每日一次，与食物同服，28 天周期全程连续",
      },
    },
  ],
  side_effects: {
    common: [
      { en: "Nausea, vomiting", zh: "恶心、呕吐" },
      { en: "Fatigue", zh: "疲劳" },
      { en: "Diarrhea or loose stools", zh: "腹泻或稀便" },
    ],
    serious: [
      {
        en: "Grade 3 nausea was the dose-limiting toxicity reported at 400 mg in the ACCENT phase 1b cohort",
        zh: "在 ACCENT 1b 期 400 mg 队列中，Grade 3 恶心为剂量限制毒性",
      },
    ],
  },
  monitoring: [
    {
      en: "Adherence to once-daily dosing with food — investigational oral agent",
      zh: "与食物同服每日一次依从性 —— 试验性口服药物",
    },
    {
      en: "Standard chemotherapy laboratory monitoring per the GnP backbone (FBC, LFTs, U&Es D1/D8/D15)",
      zh: "依 GnP 骨干方案进行标准化疗实验室监测（D1/D8/D15 查血常规、肝功、电解质）",
    },
  ],
  diet_interactions: [
    {
      food: { en: "Food (any meal)", zh: "食物（任意一餐）" },
      effect: {
        en: "ACCENT protocol specifies dosing with food. Maintain consistent food intake at the dosing time.",
        zh: "ACCENT 方案规定与食物同服。在服药时间保持一致的食物摄入。",
      },
      severity: "info",
    },
  ],
  protocol_ids: ["gnp_narmafotinib"],
  references: [
    {
      source: "trial_publication",
      title:
        "Phase 1b/2a of narmafotinib (AMP945) in combination with gemcitabine and nab-paclitaxel in first-line patients with advanced pancreatic cancer (ACCENT trial): Interim analysis (JCO 2024)",
      publisher: "ASCO Publications",
      url: "https://ascopubs.org/doi/10.1200/JCO.2024.42.16_suppl.e16337",
      accessed: "2026-04-21",
      section: "Methods (RP2D, dosing); Results (DLT)",
    },
    {
      source: "trial_protocol",
      title:
        "ACCENT: AMP945 in Combination with Nab-paclitaxel and Gemcitabine in Pancreatic Cancer Patients (NCT05355298)",
      publisher: "ClinicalTrials.gov",
      url: "https://clinicaltrials.gov/study/NCT05355298",
      accessed: "2026-04-21",
      section: "Study design, dosing, eligibility",
    },
  ],
  clinical_note: {
    en: "Investigational FAK inhibitor. RP2D is 400 mg PO once daily with food in a 28-day cycle alongside D1/D8/D15 GnP. The reported DLT in the 400 mg cohort was Grade 3 nausea. No prompt-engine claim is made about narmafotinib-specific LFT monitoring beyond the standard GnP backbone.",
    zh: "试验性 FAK 抑制剂。RP2D 为 400 mg 口服每日一次与食物同服，与 D1/D8/D15 GnP 同步进行 28 天周期。400 mg 队列报告的 DLT 为 Grade 3 恶心。提示引擎对纳马非替尼的肝功监测除 GnP 骨干外不作额外声明。",
  },
};

const OXALIPLATIN: DrugInfo = {
  id: "oxaliplatin",
  name: { en: "Oxaliplatin", zh: "奥沙利铂" },
  aliases: ["Eloxatin"],
  category: "chemo",
  default_route: "IV",
  mpdac_relevant: true,
  drug_class: {
    en: "Platinum compound — DNA-crosslinking agent",
    zh: "铂化合物 —— DNA 交联剂",
  },
  mechanism: {
    en: "Forms platinum-DNA adducts causing interstrand crosslinks. Used in mFFX for mPDAC.",
    zh: "形成铂-DNA 加合体导致链间交联。用于转移性胰腺癌的 mFFX。",
  },
  typical_doses: [{ en: "85 mg/m² IV", zh: "85 mg/m² 静脉注射" }],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1],
      label: { en: "Day 1 of 14-day mFFX cycle", zh: "14 天 mFFX 周期的第 1 天" },
    },
  ],
  side_effects: {
    common: [
      {
        en: "Acute cold dysaesthesia (triggered by cold exposure) — 3–5 days post-dose",
        zh: "急性遇冷异感（遇冷触发）—— 用药后 3–5 天",
      },
      {
        en: "Chronic cold sensitivity (paresthesia in hands/feet)",
        zh: "慢性遇冷敏感（手脚感觉异常）",
      },
      { en: "Nausea, vomiting", zh: "恶心、呕吐" },
      { en: "Fatigue", zh: "疲劳" },
      {
        en: "Myelosuppression (mild compared to gemcitabine)",
        zh: "骨髓抑制（轻于吉西他滨）",
      },
    ],
    serious: [
      {
        en: "Anaphylaxis / hypersensitivity (especially after multiple cycles)",
        zh: "过敏反应 / 过敏性反应（尤其在多个周期后）",
      },
      {
        en: "Sensory neuropathy (cumulative) — can be severe and irreversible",
        zh: "感觉神经病变（累积）—— 可能严重且不可逆",
      },
      {
        en: "Acute kidney injury (rare, usually reversible with hydration)",
        zh: "急性肾损伤（罕见，通常通过补液可逆）",
      },
    ],
  },
  monitoring: [
    {
      en: "Neuropathy grade (CTCAE) — critical for mFFX continuation",
      zh: "神经病变分级（CTCAE）—— 对 mFFX 继续至关重要",
    },
    {
      en: "Premedication with dexamethasone + 5-HT3 blocker + H2 blocker for first dose",
      zh: "首次用药前给药：地塞米松 + 5-HT3 拮抗剂 + H2 受体阻滞剂",
    },
    { en: "FBC, U&Es, LFTs", zh: "血常规、电解质、肝功" },
  ],
  diet_interactions: [
    {
      food: { en: "Cold foods, cold drinks, cold air on skin", zh: "冷食、冷饮、冷空气接触皮肤" },
      effect: {
        en: "Triggers acute dysaesthesia — throat spasm, jaw pain, dysphagia (swallowing difficulty)",
        zh: "触发急性异感 —— 喉痉挛、下颌痛、吞咽困难",
      },
      severity: "warning",
    },
  ],
  protocol_ids: ["mffx"],
  references: [
    {
      source: "eviQ",
      title:
        "eviQ Protocol 1512 — Pancreas metastatic: modified FOLFIRINOX (fluorouracil, oxaliplatin, irinotecan, leucovorin)",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1512-pancreas-metastatic-folfirinox-modified-fl",
      accessed: "2026-04-21",
      section: "Oxaliplatin 85 mg/m² D1 q14d; cumulative-dose neurotoxicity monitoring",
    },
    {
      source: "FDA_label",
      title: "ELOXATIN (oxaliplatin) — Highlights of Prescribing Information",
      publisher: "FDA",
      url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2015/021759s017lbl.pdf",
      accessed: "2026-04-21",
      section: "5.1 Neuropathy; 2.4 Dose modifications",
    },
    {
      source: "review",
      title:
        "Management of oxaliplatin-induced peripheral neurotoxicity (systematic review)",
      publisher: "PMC",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1661634/",
      accessed: "2026-04-21",
      section: "Acute vs chronic CIPN; cumulative-dose thresholds",
    },
  ],
  clinical_note: {
    en: "Oxaliplatin's cold sensitivity is the most distinctive toxicity. Patients must avoid cold exposure for 3–5 days post-dose. Dose-limiting sensory neurotoxicity typically emerges at cumulative 780–850 mg/m² (~9–10 cycles); symptoms between cycles persist beyond ~1000 mg/m² cumulative. Stop-and-go strategy per eviQ 1512.",
    zh: "奥沙利铂的遇冷敏感性是最独特的毒性。用药后 3–5 天必须避免冷接触。剂量限制性感觉神经毒性通常在累积剂量 780–850 mg/m²（约 9–10 周期）出现；累积 > 1000 mg/m² 后周期间症状持续。eviQ 1512 建议 stop-and-go 策略。",
  },
};

const IRINOTECAN: DrugInfo = {
  id: "irinotecan",
  name: { en: "Irinotecan", zh: "伊立替康" },
  aliases: ["Camptosar"],
  category: "chemo",
  default_route: "IV",
  mpdac_relevant: true,
  drug_class: {
    en: "Topoisomerase I inhibitor",
    zh: "拓扑异构酶 I 抑制剂",
  },
  mechanism: {
    en: "Inhibits topoisomerase I, preventing DNA religation. Used in mFFX.",
    zh: "抑制拓扑异构酶 I，阻止 DNA 重链接。用于 mFFX。",
  },
  typical_doses: [{ en: "150 mg/m² IV", zh: "150 mg/m² 静脉注射" }],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1],
      label: { en: "Day 1 of 14-day mFFX cycle", zh: "14 天 mFFX 周期的第 1 天" },
    },
  ],
  side_effects: {
    common: [
      {
        en: "Acute cholinergic syndrome (0–24h post-dose): salivation, lacrimation, sweating, cramping, diarrhea",
        zh: "急性胆碱能综合征（用药后 0–24 小时）：流涎、泪液、出汗、腹部痉挛、腹泻",
      },
      {
        en: "Delayed diarrhea (D3–7) — can be severe, requiring loperamide",
        zh: "迟发腹泻（D3–7）—— 可能严重，需要洛哌丁胺",
      },
      { en: "Nausea, vomiting", zh: "恶心、呕吐" },
      { en: "Fatigue, weakness", zh: "疲劳、虚弱" },
      { en: "Alopecia", zh: "脱发" },
    ],
    serious: [
      {
        en: "Severe delayed diarrhea Grade 3+ (≥7 stools/day) — dehydration risk",
        zh: "严重迟发腹泻 Grade 3+（≥7 次 / 天）—— 脱水风险",
      },
      {
        en: "Neutropenic enterocolitis (febrile neutropenia + diarrhea) — medical emergency",
        zh: "中性粒细胞减少症肠结肠炎（发热性中性粒细胞减少 + 腹泻）—— 医学急症",
      },
    ],
  },
  monitoring: [
    {
      en: "Atropine IM at first sign of acute cholinergic symptoms (within 24h of dose)",
      zh: "首次出现急性胆碱能症状迹象时肌内注射阿托品（用药后 24 小时内）",
    },
    {
      en: "Loperamide at onset of loose stool; escalate if ≥4 stools/day",
      zh: "稀便开始时用洛哌丁胺；若 ≥4 次 / 天则增加剂量",
    },
    { en: "FBC, U&Es, LFTs", zh: "血常规、电解质、肝功" },
  ],
  diet_interactions: [
    {
      food: { en: "Alcohol", zh: "酒精" },
      effect: {
        en: "Increases risk of diarrhea and GI upset",
        zh: "增加腹泻和胃肠不适的风险",
      },
      severity: "caution",
    },
  ],
  protocol_ids: ["mffx"],
  references: [
    {
      source: "eviQ",
      title:
        "eviQ Protocol 1512 — Pancreas metastatic: modified FOLFIRINOX (fluorouracil, oxaliplatin, irinotecan, leucovorin)",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1512-pancreas-metastatic-folfirinox-modified-fl",
      accessed: "2026-04-21",
      section: "Irinotecan 150 mg/m² D1 q14d (mFFX); UGT1A1 genotype + diarrhoea management",
    },
    {
      source: "BC_cancer",
      title:
        "BC Cancer — Guidelines for the Management of Cancer / Chemotherapy-induced Diarrhea",
      publisher: "BC Cancer Agency",
      url: "https://www.bccancer.bc.ca/nursing-site/documents/guidelinesformanagementofcid.pdf",
      accessed: "2026-04-21",
      section: "High-dose loperamide titration + octreotide escalation",
    },
    {
      source: "review",
      title: "StatPearls — Irinotecan",
      publisher: "NCBI Bookshelf",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK554441/",
      accessed: "2026-04-21",
      section: "UGT1A1 polymorphism + dose reductions",
    },
  ],
  clinical_note: {
    en: "Irinotecan's cholinergic and diarrheal toxicity requires close GI monitoring. Patients must have rescue loperamide on hand. UGT1A1*28 homozygotes need dose reduction from the outset.",
    zh: "伊立替康的胆碱能和腹泻毒性需要密切胃肠监测。患者必须备好救援洛哌丁胺。UGT1A1*28 纯合型需一开始即减量。",
  },
};

// ============================================================================
// ANTIEMETICS
// ============================================================================

const FLUOROURACIL: DrugInfo = {
  id: "fluorouracil",
  name: { en: "Fluorouracil (5-FU)", zh: "氟尿嘧啶（5-FU）" },
  aliases: ["5-FU", "Adrucil", "Efudex"],
  category: "chemo",
  default_route: "IV",
  mpdac_relevant: true,
  drug_class: {
    en: "Pyrimidine antimetabolite",
    zh: "嘧啶类抗代谢药",
  },
  mechanism: {
    en: "Converted intracellularly to FdUMP, which inhibits thymidylate synthase; metabolites are also incorporated into RNA/DNA. Backbone drug of FOLFIRINOX / mFFX.",
    zh: "胞内转化为 FdUMP，抑制胸苷酸合成酶；代谢物也整合入 RNA/DNA。是 FOLFIRINOX / mFFX 的骨干药物。",
  },
  typical_doses: [
    { en: "400 mg/m² IV bolus D1", zh: "D1 静脉推注 400 mg/m²" },
    {
      en: "2400 mg/m² continuous infusion over 46 h",
      zh: "46 小时持续输注 2400 mg/m²",
    },
  ],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1, 2],
      label: {
        en: "D1 bolus + 46 h pump (mFFX, 14-day cycle)",
        zh: "D1 推注 + 46 小时泵注（mFFX，14 天周期）",
      },
    },
  ],
  side_effects: {
    common: [
      { en: "Mucositis (mouth sores)", zh: "口腔黏膜炎" },
      { en: "Diarrhoea", zh: "腹泻" },
      { en: "Nausea, vomiting", zh: "恶心、呕吐" },
      { en: "Myelosuppression", zh: "骨髓抑制" },
      {
        en: "Hand-foot syndrome (palmar-plantar erythrodysaesthesia)",
        zh: "手足综合征（掌跖红斑感觉障碍）",
      },
    ],
    serious: [
      {
        en: "Severe diarrhoea / dehydration — rapidly life-threatening if untreated",
        zh: "严重腹泻 / 脱水 —— 如未治疗可快速危及生命",
      },
      {
        en: "Cardiotoxicity (coronary vasospasm) — rare, higher with continuous infusion",
        zh: "心脏毒性（冠状动脉痉挛）—— 罕见，持续输注时更高",
      },
      {
        en: "DPD deficiency — severe, potentially fatal toxicity; test if suggestive family/personal history",
        zh: "DPD 酶缺陷 —— 可致严重乃至致命毒性；家族 / 个人史可疑时应检测",
      },
    ],
  },
  monitoring: [
    { en: "FBC before each cycle", zh: "每周期前查血常规" },
    { en: "Renal function — eGFR affects clearance", zh: "肾功能 —— eGFR 影响清除" },
    {
      en: "Oral mucosa check / diarrhoea grade each visit",
      zh: "每次就诊检查口腔黏膜 / 腹泻分级",
    },
  ],
  diet_interactions: [],
  protocol_ids: ["mffx"],
  references: [
    {
      source: "eviQ",
      title:
        "eviQ Protocol 1512 — Pancreas metastatic modified FOLFIRINOX (fluorouracil, oxaliplatin, irinotecan, leucovorin)",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1512-pancreas-metastatic-folfirinox-modified-fl",
      accessed: "2026-04-21",
      section: "5-FU 400 mg/m² bolus + 2400 mg/m² over 46 h infusion",
    },
    {
      source: "review",
      title: "StatPearls — Fluorouracil",
      publisher: "NCBI Bookshelf",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK549808/",
      accessed: "2026-04-21",
      section: "Mechanism, dosing, toxicities",
    },
  ],
  clinical_note: {
    en: "Bolus omitted in some modified FOLFIRINOX variants. eGFR reduction → 25–50% dose reduction. DPD screening worth raising with oncology if any history of severe fluoropyrimidine toxicity.",
    zh: "部分 mFFX 方案省略推注剂。eGFR 降低 → 减量 25–50%。如有严重氟嘧啶毒性病史，与肿瘤科讨论 DPD 检测。",
  },
};

const LEUCOVORIN: DrugInfo = {
  id: "leucovorin",
  name: { en: "Leucovorin (calcium folinate)", zh: "甲酰四氢叶酸钙" },
  aliases: ["folinic acid", "calcium folinate"],
  category: "supplement",
  default_route: "IV",
  mpdac_relevant: true,
  drug_class: {
    en: "Reduced folate cofactor (5-FU potentiator)",
    zh: "还原叶酸（5-FU 增效剂）",
  },
  mechanism: {
    en: "Stabilises the ternary complex of FdUMP with thymidylate synthase, potentiating 5-FU cytotoxicity. Given immediately before 5-FU in FOLFIRINOX / mFFX.",
    zh: "稳定 FdUMP 与胸苷酸合成酶三元复合物，增强 5-FU 细胞毒性。在 FOLFIRINOX / mFFX 中于 5-FU 前给药。",
  },
  typical_doses: [
    {
      en: "400 mg/m² IV over 2 h (standard FFX); eviQ 1512 reduces to 50 mg",
      zh: "2 小时静脉输注 400 mg/m²（标准 FFX）；eviQ 1512 减至 50 mg",
    },
  ],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1],
      label: {
        en: "D1 of 14-day mFFX cycle",
        zh: "14 天 mFFX 周期的第 1 天",
      },
    },
  ],
  side_effects: {
    common: [],
    serious: [
      {
        en: "No direct toxicity at usual doses; occasional rash / allergic reaction",
        zh: "常规剂量下无直接毒性；偶见皮疹 / 过敏反应",
      },
    ],
  },
  monitoring: [],
  diet_interactions: [],
  protocol_ids: ["mffx"],
  references: [
    {
      source: "eviQ",
      title:
        "eviQ Protocol 1512 — Pancreas metastatic modified FOLFIRINOX",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1512-pancreas-metastatic-folfirinox-modified-fl",
      accessed: "2026-04-21",
      section: "Leucovorin / calcium folinate dose and sequence",
    },
    {
      source: "review",
      title: "StatPearls — Leucovorin",
      publisher: "NCBI Bookshelf",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK553114/",
      accessed: "2026-04-21",
    },
  ],
  clinical_note: {
    en: "Biochemistry matters: leucovorin must precede 5-FU by a sufficient interval for ternary-complex formation. Verify dose per institutional protocol (eviQ 1512 uses 50 mg; original FFX uses 400 mg/m²).",
    zh: "生物化学顺序关键：甲酰四氢叶酸须先于 5-FU 给药以形成三元复合物。请按本地方案核对剂量（eviQ 1512 用 50 mg；原始 FFX 用 400 mg/m²）。",
  },
};

const APREPITANT: DrugInfo = {
  id: "aprepitant",
  name: { en: "Aprepitant", zh: "阿瑞匹坦" },
  aliases: ["Emend", "fosaprepitant"],
  category: "antiemetic",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: {
    en: "NK1 receptor antagonist",
    zh: "NK1 受体拮抗剂",
  },
  mechanism: {
    en: "Blocks substance P at NK1 receptors in the chemoreceptor trigger zone. Adds to the 5-HT3 antagonist + dexamethasone backbone for highly emetogenic chemotherapy (HEC).",
    zh: "阻断化学感受器触发区中 NK1 受体的 P 物质。在高致吐方案中叠加于 5-HT3 拮抗剂 + 地塞米松骨干之上。",
  },
  typical_doses: [
    { en: "125 mg PO 1 h before chemo, D1", zh: "化疗前 1 小时口服 125 mg，D1" },
    { en: "80 mg PO D2 + D3", zh: "D2 + D3 口服 80 mg" },
    {
      en: "Fosaprepitant 150 mg IV single dose D1 (alternative)",
      zh: "或替代：D1 福沙匹坦 150 mg 静脉注射",
    },
  ],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1, 2, 3],
      label: {
        en: "D1–D3 of HEC cycle (mFFX); D1 only for MEC",
        zh: "高致吐方案 D1–D3（mFFX）；中致吐方案仅 D1",
      },
    },
  ],
  side_effects: {
    common: [
      { en: "Fatigue / asthenia", zh: "疲劳 / 乏力" },
      { en: "Constipation, diarrhoea", zh: "便秘、腹泻" },
      { en: "Headache, hiccups", zh: "头痛、呃逆" },
    ],
    serious: [
      {
        en: "CYP3A4 inhibition — interaction with dexamethasone, warfarin, midazolam, oral contraceptives",
        zh: "抑制 CYP3A4 —— 与地塞米松、华法林、咪达唑仑、口服避孕药相互作用",
      },
      { en: "Rare hepatotoxicity — monitor LFTs", zh: "罕见肝毒性 —— 监测肝功能" },
    ],
  },
  monitoring: [
    {
      en: "Review concurrent CYP3A4 substrates — may need dose adjustments",
      zh: "核对合用 CYP3A4 底物 —— 可能需要调整剂量",
    },
  ],
  diet_interactions: [],
  protocol_ids: ["mffx"],
  references: [
    {
      source: "guideline",
      title:
        "MASCC/ESMO 2023 Antiemetic Guideline Update — NK1 antagonist in HEC prophylaxis",
      publisher: "MASCC / ESMO",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10937211/",
      accessed: "2026-04-21",
      section: "HEC triple therapy (5-HT3 + NK1 + dexamethasone)",
    },
    {
      source: "CCO_protocol",
      title:
        "Cancer Care Ontario — Antiemetic Recommendations for Chemotherapy-Induced Nausea and Vomiting (2019)",
      publisher: "Cancer Care Ontario",
      url: "https://www.cancercareontario.ca/sites/ccocancercare/files/guidelines/full/2019AntiemeticRecommendationsChemotherapyInducedNauseaVomiting.pdf",
      accessed: "2026-04-21",
      section: "NK1 antagonist dosing for HEC",
    },
  ],
  clinical_note: {
    en: "Strong CYP3A4 inhibitor on D1 (moderate D2–D3). Dose-adjust concurrent dexamethasone per guideline (usually 50% reduction when combined). Especially relevant for mFFX regimens.",
    zh: "D1 为强效 CYP3A4 抑制剂（D2–D3 为中度）。合用地塞米松时按指南减量（通常减半）。与 mFFX 方案关系最密切。",
  },
};

const ONDANSETRON: DrugInfo = {
  id: "ondansetron",
  name: { en: "Ondansetron", zh: "昂丹司琼" },
  aliases: ["Zofran", "Ondansetrona"],
  category: "antiemetic",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: { en: "5-HT3 antagonist", zh: "5-HT3 拮抗剂" },
  mechanism: {
    en: "Blocks serotonin (5-HT3) receptors in the chemoreceptor trigger zone. Prevents both acute and delayed nausea/vomiting.",
    zh: "阻断化学感受器触发区的血清素（5-HT3）受体。预防急性和迟发恶心 / 呕吐。",
  },
  typical_doses: [
    { en: "4–8 mg PO BD–TID", zh: "4–8 mg 口服，每日两到三次" },
    { en: "8 mg IV on chemo day", zh: "化疗日 8 mg 静脉注射" },
  ],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1, 2, 3],
      label: { en: "D1–D3 of chemo cycle (scheduled, not PRN)", zh: "化疗周期 D1–D3（按时，非按需）" },
    },
  ],
  side_effects: {
    common: [
      { en: "Headache", zh: "头痛" },
      { en: "Constipation (opioid-like effect on bowel)", zh: "便秘（类鸦片对肠道的影响）" },
      { en: "Dizziness, lightheadedness", zh: "头晕、晕眩" },
    ],
    serious: [
      { en: "QT prolongation (rare, usually benign)", zh: "QT 间期延长（罕见，通常无害）" },
    ],
  },
  monitoring: [],
  diet_interactions: [],
  supportive_id: undefined,
  references: [
    {
      source: "CCO_protocol",
      title:
        "Cancer Care Ontario — Antiemetic Recommendations for Chemotherapy-Induced Nausea and Vomiting (2019)",
      publisher: "Cancer Care Ontario",
      url: "https://www.cancercareontario.ca/sites/ccocancercare/files/guidelines/full/2019AntiemeticRecommendationsChemotherapyInducedNauseaVomiting.pdf",
      accessed: "2026-04-21",
      section: "5-HT3 antagonist dosing and combination regimens for HEC",
    },
    {
      source: "guideline",
      title:
        "MASCC/ESMO 2023 Antiemetic Guideline Update — 5-HT3 antagonist + dexamethasone + NK1 for HEC",
      publisher: "MASCC / ESMO",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10937211/",
      accessed: "2026-04-21",
      section: "HEC triple therapy",
    },
  ],
  clinical_note: {
    en: "Backbone antiemetic for chemo. Give on schedule (not as-needed) for best efficacy. Max 8 mg per dose (QT risk at > 16 mg/day). Add olanzapine or aprepitant for breakthrough nausea per MASCC/ESMO 2023.",
    zh: "化疗的骨干止吐药。按时给药以获得最佳疗效。单次最大 8 mg（> 16 mg / 天有 QT 风险）。MASCC/ESMO 2023 建议突破性恶心时添加奥氮平或阿瑞匹坦。",
  },
};

const OLANZAPINE: DrugInfo = {
  id: "olanzapine",
  name: { en: "Olanzapine", zh: "奥氮平" },
  aliases: ["Zyprexa"],
  category: "antiemetic",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: { en: "Atypical antipsychotic (anti-nausea mechanism unclear)", zh: "非典型抗精神病药（抗恶心机制不清楚）" },
  mechanism: {
    en: "Dopamine antagonist; extremely effective for chemotherapy-induced nausea refractory to standard antiemetics.",
    zh: "多巴胺拮抗剂；对难治性化疗诱发恶心极其有效。",
  },
  typical_doses: [{ en: "2.5–5 mg PO nocte", zh: "2.5–5 mg 口服，晚上一次" }],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1, 2, 3],
      label: { en: "D1–D3 evening (nocte) for nausea prevention", zh: "D1–D3 晚上（晚上一次）用于恶心预防" },
    },
  ],
  side_effects: {
    common: [
      { en: "Sedation, somnolence", zh: "镇静、嗜睡" },
      { en: "Weight gain, increased appetite", zh: "体重增加、食欲增加" },
      { en: "Dizziness", zh: "头晕" },
    ],
    serious: [
      { en: "Metabolic syndrome risk (hyperglycemia, dyslipidemia)", zh: "代谢综合征风险（高血糖、血脂异常）" },
    ],
  },
  monitoring: [
    { en: "Blood glucose, lipid panel if on long-term olanzapine", zh: "长期用奥氮平时血糖、血脂检查" },
  ],
  diet_interactions: [],
  supportive_id: "supportive.olanzapine",
  references: [
    {
      source: "guideline",
      title:
        "MASCC/ESMO 2023 Antiemetic Guideline Update — olanzapine 5–10 mg for HEC prophylaxis and breakthrough CINV",
      publisher: "MASCC / ESMO",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10937211/",
      accessed: "2026-04-21",
      section: "Olanzapine in HEC",
    },
  ],
  clinical_note: {
    en: "Gold standard for breakthrough chemo nausea (MASCC/ESMO 2023 & ASCO 2020). 5–10 mg for 3 days in HEC; consider 2.5 mg in older / sedation-sensitive patients. Sedate effect useful for sleep. Weight gain manageable with dietitian support.",
    zh: "突破性化疗恶心的金标准（MASCC/ESMO 2023 与 ASCO 2020）。高致吐方案：5–10 mg 连用 3 天；年长或易镇静者可考虑 2.5 mg。镇静作用有助睡眠，体重增加可由营养师协助管理。",
  },
};

const DEXAMETHASONE: DrugInfo = {
  id: "dexamethasone",
  name: { en: "Dexamethasone", zh: "地塞米松" },
  aliases: ["Decadron", "Dex"],
  category: "steroid",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: { en: "Glucocorticoid", zh: "糖皮质激素" },
  mechanism: {
    en: "Potent anti-inflammatory and anti-emetic. Used as premedication before chemo to reduce infusion reactions and nausea.",
    zh: "强效抗炎和止吐。用作化疗前预用药以减少输注反应和恶心。",
  },
  typical_doses: [
    { en: "8 mg on chemo day (BD)", zh: "化疗日 8 mg（一日两次）" },
    { en: "4 mg BD D1–D3", zh: "D1–D3 4 mg，一日两次" },
  ],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [1, 2],
      label: { en: "D1–D2 of cycle (tapered by D3)", zh: "周期 D1–D2（D3 开始减量）" },
    },
  ],
  side_effects: {
    common: [
      { en: "Insomnia (if given in evening)", zh: "失眠（如晚上给药）" },
      { en: "Increased appetite, mood elevation", zh: "食欲增加、情绪提升" },
      { en: "Hyperglycemia (especially in diabetics)", zh: "高血糖（尤其在糖尿病患者中）" },
      { en: "Mild gastric upset", zh: "轻度胃部不适" },
    ],
    serious: [
      { en: "Steroid crash (D3–D5): depression, tearfulness, irritability", zh: "类固醇撤药反应（D3–D5）：抑郁、流泪、烦躁" },
      { en: "Long-term use: osteoporosis, immunosuppression, muscle wasting", zh: "长期使用：骨质疏松、免疫抑制、肌肉萎缩" },
    ],
  },
  monitoring: [
    { en: "Give in morning (08:00) to avoid evening insomnia", zh: "早上给药（08:00）以避免晚间失眠" },
    { en: "Taper rather than stop abruptly (adrenal suppression risk)", zh: "逐渐减量而非突然停用（肾上腺抑制风险）" },
  ],
  diet_interactions: [],
  references: [
    {
      source: "trial_publication",
      title:
        "Vardy J, Chiew KS, Galica J, Pond GR, Tannock IF. Side effects associated with the use of dexamethasone for prophylaxis of delayed emesis after moderately emetogenic chemotherapy. Br J Cancer. 2006;94(7):1011–1015.",
      publisher: "British Journal of Cancer (Nature)",
      url: "https://www.nature.com/articles/6603048",
      accessed: "2026-04-21",
      section: "Results: symptom incidence in the week post-chemotherapy",
    },
    {
      source: "eviQ",
      title:
        "eviQ 1375 GnP protocol — dexamethasone premedication for nab-paclitaxel",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1375-pancreas-metastatic-gemcitabine-and-nab-pacli",
      accessed: "2026-04-21",
      section: "Premedication regimen",
    },
  ],
  prompt_facts: {
    steroid_crash: {
      value: {
        // Vardy 2006 reports moderate-severe symptoms (insomnia 45%, agitation
        // 27%, indigestion 27%) in the week after chemo. The crash itself is
        // most commonly described in the post-pulse window once dex is stopped
        // — surface a check-in across days 3-5 post-pulse.
        start_day_post_dose: 3,
        end_day_post_dose: 5,
        rationale: {
          en: "Vardy et al (BJC 2006) documented moderate-severe insomnia (45%), agitation (27%), and dyspepsia (27%) in the week after chemo dex. Patients commonly report a mood/energy drop in the post-pulse D3–D5 window.",
          zh: "Vardy 等（BJC 2006）记录化疗后地塞米松一周内中-重度失眠（45%）、激越（27%）、消化不良（27%）。患者常在 D3–D5 后撤药期反映情绪/精力下降。",
        },
      },
      source_refs: [0],
    },
  },
  clinical_note: {
    en: "Prophylactic dex is standard on chemo days. The post-pulse symptom window — most commonly D3-D5 — is well documented (Vardy 2006: 45% insomnia, 27% agitation, 27% dyspepsia). Normalize it; surface a mood check-in.",
    zh: "化疗日预防性地塞米松是标准。撤药后症状窗口（最常见 D3-D5）有充分记录（Vardy 2006：失眠 45%、激越 27%、消化不良 27%）。标准化它；浮现情绪自查。",
  },
};

const DULOXETINE: DrugInfo = {
  id: "duloxetine",
  name: { en: "Duloxetine", zh: "度洛西汀" },
  aliases: ["Cymbalta"],
  category: "neuropathy",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: {
    en: "SNRI (serotonin-norepinephrine reuptake inhibitor)",
    zh: "SNRI（血清素去甲肾上腺素再摄取抑制剂）",
  },
  mechanism: {
    en: "Inhibits reuptake of serotonin and norepinephrine. First-line for chemotherapy-induced peripheral neuropathy (CIPN).",
    zh: "抑制血清素和去甲肾上腺素再摄取。化疗诱发周围神经病变（CIPN）的一线治疗。",
  },
  typical_doses: [
    { en: "30–60 mg PO daily", zh: "30–60 mg 口服，每日一次" },
  ],
  default_schedules: [SCHED_DAILY],
  side_effects: {
    common: [
      { en: "Nausea (usually resolves in 1–2 weeks)", zh: "恶心（通常 1–2 周内缓解）" },
      { en: "Dry mouth, sweating", zh: "口干、出汗" },
      { en: "Dizziness, drowsiness", zh: "头晕、困倦" },
    ],
    serious: [
      { en: "Serotonin syndrome (with SSRIs or other serotonergic agents)", zh: "血清素综合征（与 SSRI 或其他血清素能药物合用时）" },
    ],
  },
  monitoring: [
    { en: "Neuropathy grade monthly — efficacy takes 2–4 weeks", zh: "每月评估神经病变分级 —— 疗效需 2–4 周" },
  ],
  diet_interactions: [],
  supportive_id: "supportive.duloxetine",
  references: [
    {
      source: "guideline",
      title:
        "ASCO 2020 Guideline Update — Prevention and Management of Chemotherapy-Induced Peripheral Neuropathy",
      publisher: "Journal of Clinical Oncology",
      url: "https://ascopubs.org/doi/10.1200/JCO.20.01399",
      accessed: "2026-04-21",
      section: "Duloxetine — recommendation for established painful CIPN",
    },
  ],
  clinical_note: {
    en: "ASCO 2020 recommends duloxetine for established painful CIPN (Level 2 evidence) — NOT for prophylaxis. Start 30 mg daily, titrate to 60 mg over 1–2 weeks. Reduce to 30 mg/day if eGFR 30–50; avoid if eGFR < 30.",
    zh: "ASCO 2020 推荐度洛西汀用于已建立的疼痛性 CIPN（二级证据）—— 不用于预防。起始 30 mg 每日，1–2 周内上调至 60 mg。eGFR 30–50 时减至 30 mg / 天；eGFR < 30 避免使用。",
  },
};

const PANCRELIPASE: DrugInfo = {
  id: "pancrelipase",
  name: { en: "Pancrelipase (PERT)", zh: "胰酶替代疗法（PERT）" },
  aliases: ["Creon", "Zenpep", "Pancreaze"],
  category: "supplement",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: { en: "Pancreatic enzyme replacement", zh: "胰酶替代品" },
  mechanism: {
    en: "Replaces pancreatic lipase, amylase, and protease. Essential for nutrient absorption in pancreatic insufficiency.",
    zh: "替代胰脂肪酶、淀粉酶和蛋白酶。对胰腺功能不全患者营养吸收必需。",
  },
  typical_doses: [
    { en: "Creon 25 000–50 000 units with meals", zh: "Creon 25 000–50 000 单位，与正餐同服" },
    { en: "Creon 10 000 units with snacks", zh: "Creon 10 000 单位，与加餐同服" },
  ],
  default_schedules: [
    {
      kind: "with_meals",
      times_per_day: 3,
      label: { en: "With every meal and snack", zh: "每餐和加餐时服用" },
    },
  ],
  side_effects: {
    common: [],
    serious: [
      {
        en: "Fibrosing colonopathy (rare, with very high doses >25 000 units/kg/day)",
        zh: "纤维化肠病（罕见，用于极高剂量 >25 000 单位 / 千克 / 天）",
      },
    ],
  },
  monitoring: [
    { en: "Stool consistency, bloating, gas — signs of under-replacement", zh: "大便性状、腹胀、胀气 —— 替代不足的迹象" },
    { en: "Weight trends — malabsorption if failing to maintain weight", zh: "体重趋势 —— 若无法维持体重则提示吸收不良" },
  ],
  diet_interactions: [],
  supportive_id: "supportive.pert",
  references: [
    {
      source: "TGA_PI",
      title: "TGA Australian Public Assessment Report — CREON (pancrelipase)",
      publisher: "Therapeutic Goods Administration (Australia)",
      url: "https://www.tga.gov.au/sites/default/files/auspar-creon.pdf",
      accessed: "2026-04-21",
      section: "Indications / dosing",
    },
    {
      source: "FDA_label",
      title: "CREON (pancrelipase) — Highlights of Prescribing Information",
      publisher: "FDA",
      url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2024/020725s031lbl.pdf",
      accessed: "2026-04-21",
      section: "Dosage and Administration — titration",
    },
  ],
  clinical_note: {
    en: "PERT adherence is foundational for weight + function. TGA/FDA dose: start ~500 lipase units/kg/meal, titrate to response; max 2 500 units/kg/meal or 10 000 units/kg/day. Emphasise: EVERY meal and snack.",
    zh: "PERT 依从性是维持体重与功能的基础。TGA/FDA 剂量：起始约 500 脂肪酶单位 / 千克 / 餐，按反应调整；最大 2 500 单位 / 千克 / 餐或 10 000 单位 / 千克 / 天。强调：每一餐与加餐。",
  },
};

const APIXABAN: DrugInfo = {
  id: "apixaban",
  name: { en: "Apixaban", zh: "阿比班" },
  aliases: ["Eliquat"],
  category: "anticoagulant",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: { en: "DOAC (direct oral anticoagulant) — Factor Xa inhibitor", zh: "直接口服抗凝药 —— X 因子抑制剂" },
  mechanism: {
    en: "Inhibits Factor Xa in the intrinsic and extrinsic pathways. Standard VTE prophylaxis in ambulatory mPDAC.",
    zh: "抑制内源和外源途径中的 X 因子。门诊转移性胰腺癌的标准静脉血栓栓塞预防。",
  },
  typical_doses: [
    { en: "2.5 mg PO BD", zh: "2.5 mg 口服，每日两次" },
  ],
  default_schedules: [
    {
      kind: "fixed",
      times_per_day: 2,
      clock_times: ["08:00", "20:00"],
      label: { en: "Twice daily morning and evening", zh: "早晚各一次" },
    },
  ],
  side_effects: {
    common: [
      { en: "Bleeding (minor: bruising, epistaxis, GI bleed)", zh: "出血（轻微：淤青、鼻衄、胃肠道出血）" },
      { en: "Anemia from occult bleeding", zh: "隐性出血导致贫血" },
    ],
    serious: [
      {
        en: "Major bleeding (ICH, GI bleed >500 mL, retroperitoneal bleed)",
        zh: "大出血（颅内出血、胃肠道出血 >500 mL、腹膜后出血）",
      },
    ],
  },
  monitoring: [
    { en: "CBC monthly (watch for Hb drop)", zh: "每月血常规（注意血红蛋白下降）" },
    { en: "Avoid NSAIDs; use paracetamol for pain", zh: "避免 NSAIDs；疼痛用扑热息痛" },
    { en: "Counsel on signs of bleeding", zh: "告知出血迹象" },
  ],
  diet_interactions: [
    {
      food: { en: "Cranberry juice", zh: "蔓越莓汁" },
      effect: {
        en: "May increase anticoagulant effect — avoid excessive intake",
        zh: "可能增加抗凝效果 —— 避免过量摄入",
      },
      severity: "info",
    },
  ],
  supportive_id: "supportive.vte_prophylaxis",
  references: [
    {
      source: "trial_publication",
      title:
        "Carrier M et al. Apixaban to prevent venous thromboembolism in patients with cancer (AVERT). N Engl J Med. 2019;380:711–719.",
      publisher: "NEJM",
      url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1814468",
      accessed: "2026-04-21",
      section: "Primary analysis — apixaban 2.5 mg BD × 6 months in Khorana ≥ 2",
    },
    {
      source: "review",
      title:
        "Primary thromboprophylaxis in pancreatic cancer — narrative review",
      publisher: "Cancers (MDPI)",
      url: "https://www.mdpi.com/2072-6694/15/14/3546",
      accessed: "2026-04-21",
      section: "Pancreatic-cancer-specific bleeding vs. thrombosis trade-offs",
    },
  ],
  clinical_note: {
    en: "AVERT trial (NEJM 2019) supports apixaban 2.5 mg BD for primary VTE prophylaxis in ambulatory cancer patients with Khorana score ≥ 2 — pancreatic cancer qualifies. Major bleeding HR 2.00 vs placebo — weigh bleeding risk (GI involvement, low platelets) carefully. Fixed dose; no adjustment for renal function until eGFR < 15.",
    zh: "AVERT 研究（NEJM 2019）支持阿哌沙班 2.5 mg 每日两次用于 Khorana ≥ 2 的门诊癌症患者一级 VTE 预防 —— 胰腺癌符合标准。大出血相对风险是安慰剂的 2 倍 —— 需权衡出血风险（胃肠受累、血小板低）。eGFR < 15 前无需调整剂量。",
  },
};

const PEGFILGRASTIM: DrugInfo = {
  id: "pegfilgrastim",
  name: { en: "Pegfilgrastim", zh: "培非格司亭" },
  aliases: ["Neulasta", "G-CSF"],
  category: "gcsf",
  default_route: "SC",
  mpdac_relevant: true,
  drug_class: { en: "Granulocyte colony-stimulating factor (pegylated)", zh: "粒细胞集落刺激因子（聚乙二醇化）" },
  mechanism: {
    en: "Stimulates neutrophil production. Given prophylactically after high-risk chemo (GnP, mFFX) to reduce febrile neutropenia.",
    zh: "刺激中性粒细胞产生。在高风险化疗（GnP、mFFX）后预防性给药以减少发热性中性粒细胞减少。",
  },
  typical_doses: [
    { en: "6 mg SC once per cycle (24–72h after chemo)", zh: "6 mg 皮下注射，每周期一次（化疗后 24–72 小时）" },
  ],
  default_schedules: [
    {
      kind: "cycle_linked",
      cycle_days: [2],
      label: { en: "D2 of cycle (day after last chemo dose)", zh: "周期 D2（最后化疗后一天）" },
    },
  ],
  side_effects: {
    common: [
      { en: "Bone pain (myalgia, lower back), usually D3–D5", zh: "骨痛（肌肉痛、下背痛），通常 D3–D5" },
      { en: "Injection site reaction (soreness, erythema)", zh: "注射部位反应（酸痛、红斑）" },
    ],
    serious: [
      { en: "Splenic rupture (extremely rare)", zh: "脾脏破裂（极其罕见）" },
      { en: "ARDS (acute respiratory distress syndrome, very rare)", zh: "ARDS（成人呼吸窘迫综合征，极其罕见）" },
    ],
  },
  monitoring: [
    { en: "Counsel on bone pain — usually resolves with acetaminophen", zh: "告知骨痛 —— 通常用对乙酰氨基酚可缓解" },
    { en: "FBC at D10–14 to confirm neutrophil recovery", zh: "D10–14 血常规以确认中性粒细胞恢复" },
  ],
  diet_interactions: [],
  supportive_id: "supportive.gcsf_prophylaxis",
  references: [
    {
      source: "guideline",
      title:
        "ASCO / NCCN — Recommendations for Myeloid Growth Factors (primary prophylaxis when FN risk ≥ 20%)",
      publisher: "ASCO / NCCN",
      url: "https://pubmed.ncbi.nlm.nih.gov/30422488/",
      accessed: "2026-04-21",
      section: "Primary prophylaxis criteria for high-FN-risk regimens",
    },
    {
      source: "review",
      title: "StatPearls — Pegfilgrastim",
      publisher: "NCBI Bookshelf",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK532893/",
      accessed: "2026-04-21",
      section: "Indications, dosing, bone-pain management",
    },
  ],
  clinical_note: {
    en: "Fixed dose 6 mg SC ≥ 24 h after chemo. Both mFFX and GnP carry > 20% FN risk and qualify for ASCO/NCCN primary prophylaxis. Bone pain typically D3–D5 — normalise and treat symptomatically with paracetamol.",
    zh: "固定剂量 6 mg 皮下注射，化疗结束至少 24 小时后。mFFX 与 GnP 均属 FN 风险 > 20% 的方案，符合 ASCO/NCCN 一级预防指征。骨痛常见于 D3–D5 —— 说明并以扑热息痛对症处理。",
  },
};

const PARACETAMOL: DrugInfo = {
  id: "paracetamol",
  name: { en: "Paracetamol (Acetaminophen)", zh: "对乙酰氨基酚" },
  aliases: ["Tylenol", "APAP"],
  category: "analgesic",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: { en: "Analgesic / antipyretic", zh: "止痛 / 退热药" },
  mechanism: {
    en: "Exact mechanism unknown; hypothesized to inhibit COX in CNS. Weak anti-inflammatory; safe in cancer.",
    zh: "确切机制未知；假设抑制 CNS 中的 COX。弱抗炎；在癌症中安全。",
  },
  typical_doses: [
    { en: "500–1000 mg PO Q6H (max 4 g/day)", zh: "500–1000 mg 口服，每 6 小时一次（最大 4 g / 天）" },
  ],
  default_schedules: [SCHED_PRN],
  side_effects: {
    common: [],
    serious: [
      {
        en: "Hepatotoxicity (overdose >4 g/day or chronic use in liver disease)",
        zh: "肝毒性（过量 >4 g / 天或肝病患者长期使用）",
      },
    ],
  },
  monitoring: [],
  diet_interactions: [],
  references: [
    {
      source: "FDA_label",
      title: "Acetaminophen — Highlights of Prescribing Information",
      publisher: "FDA",
      url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2015/204767s000lbl.pdf",
      accessed: "2026-04-21",
      section: "Dosage and Administration; Hepatotoxicity warning",
    },
  ],
  clinical_note: {
    en: "Safe, gentle analgesic. Preferred over NSAIDs in cancer (bleeding + renal risk). Max 4 g/day — reduce to 2–3 g/day in hepatic impairment, chronic alcohol use, or concurrent hepatotoxic chemotherapy (gemcitabine, 5-FU). Check total daily intake including OTC combination products.",
    zh: "安全、温和的止痛药。在癌症中优于 NSAIDs（出血与肾脏风险）。最大 4 g / 天 —— 肝功能损害、慢性饮酒或与肝毒性化疗药（吉西他滨、5-FU）合用时减至 2–3 g / 天。核对每日总摄入量（含非处方复方制剂）。",
  },
};

// ============================================================================
// GI SUPPORT
// ============================================================================

const LOPERAMIDE: DrugInfo = {
  id: "loperamide",
  name: { en: "Loperamide", zh: "洛哌丁胺" },
  aliases: ["Imodium"],
  category: "gi",
  default_route: "PO",
  mpdac_relevant: true,
  drug_class: {
    en: "μ-opioid receptor agonist (peripheral, non-CNS)",
    zh: "外周 μ 阿片受体激动剂（不入中枢）",
  },
  mechanism: {
    en: "Slows intestinal motility and increases fluid/electrolyte absorption. First-line rescue for irinotecan-induced and mFFX delayed diarrhoea.",
    zh: "减慢肠蠕动并增加液体 / 电解质吸收。伊立替康诱发及 mFFX 迟发腹泻的一线救援药。",
  },
  typical_doses: [
    {
      en: "Standard: 4 mg at onset, then 2 mg every 4 h or after each loose stool (max 16 mg/day)",
      zh: "常规：腹泻开始 4 mg，之后每 4 小时或每次稀便后 2 mg（最大 16 mg / 天）",
    },
    {
      en: "High-dose for irinotecan: 4 mg at onset, then 2 mg every 2 h until diarrhoea-free 12 h",
      zh: "伊立替康高剂量：开始 4 mg，之后每 2 小时 2 mg，直至无腹泻 12 小时",
    },
  ],
  default_schedules: [SCHED_PRN],
  side_effects: {
    common: [
      { en: "Constipation (rebound)", zh: "便秘（反跳）" },
      { en: "Abdominal cramping, distension", zh: "腹部绞痛、腹胀" },
    ],
    serious: [
      {
        en: "Toxic megacolon — rare but life-threatening; watch for distension, fever, ileus",
        zh: "中毒性巨结肠 —— 罕见但可致命；注意腹胀、发热、肠梗阻",
      },
      {
        en: "Dehydration + electrolyte loss if diarrhoea severe (pre-loperamide risk)",
        zh: "严重腹泻下脱水 + 电解质丢失（在使用前即已存在的风险）",
      },
      {
        en: "QT prolongation / cardiotoxicity at very high unsupervised doses",
        zh: "在极高无监督剂量下有 QT 延长 / 心脏毒性",
      },
    ],
  },
  monitoring: [
    {
      en: "Stool frequency + consistency; escalate to octreotide if Grade ≥3 diarrhoea > 24 h on loperamide + atropine-diphenoxylate",
      zh: "排便频率 + 性状；在洛哌丁胺 + 地芬诺酯基础上 Grade ≥3 腹泻 > 24 小时时升级至奥曲肽",
    },
    {
      en: "FBC — exclude neutropenic enterocolitis (febrile neutropenia + diarrhoea is an emergency)",
      zh: "血常规 —— 排除中性粒细胞减少性肠结肠炎（发热性中性粒细胞减少 + 腹泻为急症）",
    },
  ],
  diet_interactions: [],
  protocol_ids: ["mffx"],
  references: [
    {
      source: "BC_cancer",
      title:
        "BC Cancer — Guidelines for the Management of Chemotherapy-Induced Diarrhea",
      publisher: "BC Cancer Agency",
      url: "https://www.bccancer.bc.ca/nursing-site/documents/guidelinesformanagementofcid.pdf",
      accessed: "2026-04-21",
      section: "Loperamide titration + escalation pathway",
    },
    {
      source: "eviQ",
      title:
        "eviQ Protocol 1512 — Pancreas metastatic modified FOLFIRINOX (rescue loperamide)",
      publisher: "NSW Cancer Institute — eviQ",
      url: "https://www.eviq.org.au/medical-oncology/upper-gastrointestinal/pancreas-and-biliary/1512-pancreas-metastatic-folfirinox-modified-fl",
      accessed: "2026-04-21",
    },
  ],
  clinical_note: {
    en: "Rescue medication for irinotecan / mFFX diarrhoea — every mFFX patient should have loperamide on hand from cycle 1. Fever + diarrhoea at any time is a medical emergency (neutropenic enterocolitis); call oncology or attend ED immediately.",
    zh: "伊立替康 / mFFX 腹泻的救援药 —— 每位 mFFX 患者从第 1 周期起应常备洛哌丁胺。发热 + 腹泻随时出现即为医学急症（中性粒细胞减少性肠结肠炎）；立即联系肿瘤科或前往急诊。",
  },
};

// ============================================================================
// BEHAVIOURAL INTERVENTIONS
// ============================================================================

const QIGONG: DrugInfo = {
  id: "qigong",
  name: { en: "Qigong practice", zh: "气功修习" },
  aliases: ["Tai Chi", "mind-body"],
  category: "behavioural",
  default_route: "practice",
  mpdac_relevant: true,
  drug_class: { en: "Mind-body medicine", zh: "身心医学" },
  mechanism: {
    en: "Ancient Chinese mind-body cultivation. Gentle movement + breathing + meditation. Improves ECOG PS, reduces fatigue, stabilizes mood, lowers stress hormones.",
    zh: "古代中国身心修养。温和运动 + 呼吸 + 冥想。改善 ECOG PS，减少疲劳，稳定情绪，降低压力激素。",
  },
  typical_doses: [
    { en: "15–30 min session", zh: "15–30 分钟课程" },
  ],
  default_schedules: [
    {
      kind: "custom",
      rrule: "FREQ=DAILY;INTERVAL=1",
      label: { en: "Daily, ideally morning", zh: "每日，最好早上" },
    },
  ],
  side_effects: {
    common: [],
    serious: [],
  },
  monitoring: [],
  diet_interactions: [],
  clinical_note: {
    en: "Central to the patient's functional preservation strategy. Practice rhythm (even 10 min) matters more than intensity. Spiritual practice aligned with their values.",
    zh: "患者功能保留策略的核心。修习节奏（即使 10 分钟）比强度更重要。与他们的价值观相符的精神修习。",
  },
};

const RESISTANCE_TRAINING: DrugInfo = {
  id: "resistance_training",
  name: { en: "Resistance training", zh: "阻力训练" },
  aliases: ["strength training", "weight training"],
  category: "behavioural",
  default_route: "practice",
  mpdac_relevant: true,
  drug_class: { en: "Functional exercise", zh: "功能性锻炼" },
  mechanism: {
    en: "Structured bodyweight, band, or light weights. Preserves muscle mass, grip strength, gait speed — the true measures of ECOG PS.",
    zh: "结构化的体重、弹力带或轻哑铃训练。保留肌肉质量、握力、步速 —— ECOG PS 的真正衡量指标。",
  },
  typical_doses: [
    { en: "2–3 sessions per week, 20–30 min", zh: "每周 2–3 次，20–30 分钟" },
  ],
  default_schedules: [
    {
      kind: "custom",
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
      label: { en: "MWF during recovery window (D4–D7, D22–D28)", zh: "恢复窗口期间周一、三、五（D4–D7、D22–D28）" },
    },
  ],
  side_effects: {
    common: [],
    serious: [],
  },
  monitoring: [
    { en: "Grip strength monthly", zh: "每月握力检查" },
    { en: "10m walk test every 2 weeks", zh: "每两周 10 米步行测试" },
  ],
  diet_interactions: [],
  clinical_note: {
    en: "THE intervention for ECOG PS preservation. Timing: Days 4–7 (early recovery) and D22–28 (late recovery) are optimal. Avoid nadir (D16–21).",
    zh: "ECOG PS 保留的最重要干预。时间：D4–7（早期恢复）和 D22–28（晚期恢复）最佳。避开低谷（D16–21）。",
  },
};

export const DRUG_REGISTRY: readonly DrugInfo[] = [
  GEMCITABINE,
  NAB_PACLITAXEL,
  NARMAFOTINIB,
  OXALIPLATIN,
  IRINOTECAN,
  FLUOROURACIL,
  LEUCOVORIN,
  APREPITANT,
  ONDANSETRON,
  OLANZAPINE,
  DEXAMETHASONE,
  DULOXETINE,
  PANCRELIPASE,
  APIXABAN,
  PEGFILGRASTIM,
  LOPERAMIDE,
  PARACETAMOL,
  QIGONG,
  RESISTANCE_TRAINING,
];

export const DRUGS_BY_ID: Record<string, DrugInfo> = Object.fromEntries(
  DRUG_REGISTRY.map((d) => [d.id, d]),
);

export function getDrugsByCategory(
  category: string,
): DrugInfo[] {
  return DRUG_REGISTRY.filter((d) => d.category === category);
}
