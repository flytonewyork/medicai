import type { NudgeTemplate } from "~/types/treatment";

// Nudges are protocol-keyed and day-banded. Day numbers are 1-indexed relative
// to cycle start. A nudge fires when today's cycle day falls inside the range.

export const NUDGE_LIBRARY: readonly NudgeTemplate[] = [
  // ======================================================================
  // GnP weekly — dose day (D1, D8, D15)
  // ======================================================================
  {
    id: "gnp_dose_day_hydration",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "gem_maintenance"],
    day_range: [1, 1],
    category: "diet",
    severity: "info",
    title: {
      en: "Hydrate early today",
      zh: "今天早点补水",
    },
    body: {
      en: "Aim for 2 L of fluids through the day. Water, broth, diluted juice — whatever stays down. Easier IV access and smoother infusion.",
      zh: "今天目标补液 2 升：水、清汤、稀释果汁，能喝下即可。方便输液，也让化疗更顺。",
    },
  },
  {
    id: "gnp_dose_day_cold_warning",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly"],
    day_range: [1, 3],
    category: "diet",
    severity: "warning",
    title: {
      en: "No cold drinks or food for 72 h",
      zh: "72 小时内避免冷饮 / 冷食",
    },
    body: {
      en: "Cold can trigger sharp throat or mouth spasm (cold dysaesthesia). Room-temp or warm only. No ice cream, iced tea, cold water, even chilled fruit. This window runs D1 → D3 after each dose.",
      zh: "冷会触发咽喉或口腔痉挛（遇冷异感）。只喝室温或温热的：不要冰淇淋、冰茶、冷水，甚至冰过的水果。每次用药后 D1–D3 都要注意。",
    },
  },
  {
    id: "gnp_dose_day_activity",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [1, 2],
    category: "activity",
    severity: "caution",
    title: {
      en: "Light activity only today",
      zh: "今天只做轻度活动",
    },
    body: {
      en: "Gentle walks are fine. No resistance training for 48 h. Plan quiet evening — sleep may be disrupted by dex.",
      zh: "可以散步。48 小时内不要做阻力训练。安排安静的傍晚 —— 地塞米松可能影响睡眠。",
    },
  },
  {
    id: "gnp_dex_sleep",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [1, 2],
    category: "sleep",
    severity: "caution",
    title: {
      en: "Dex may keep you up tonight",
      zh: "地塞米松可能影响今晚睡眠",
    },
    body: {
      en: "Take dex in the morning, not evening. If wired, try a warm shower, avoid screens after 9pm, low-dose melatonin is usually OK (check with Dr Lee).",
      zh: "地塞米松早上服，勿晚上。若兴奋难眠：温水澡、9 点后不看屏幕、低剂量褪黑素通常可以（请与 Dr Lee 确认）。",
    },
  },
  {
    id: "gnp_dose_day_nausea",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [1, 3],
    category: "meds",
    severity: "info",
    title: {
      en: "Antiemetic schedule — don't wait",
      zh: "止吐药按时服 —— 别等到吐才吃",
    },
    body: {
      en: "Take scheduled ondansetron / prochlorperazine on schedule for 48–72 h, even without nausea. Prevention beats rescue.",
      zh: "昂丹司琼 / 普鲁氯嗪按时服 48–72 小时，哪怕没吐。预防比补救更有效。",
    },
  },
  {
    id: "gnp_d1_bowels",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly"],
    day_range: [1, 5],
    category: "diet",
    severity: "info",
    title: {
      en: "Small frequent meals",
      zh: "少量多餐",
    },
    body: {
      en: "Ginger tea, toast, rice porridge, plain chicken. Avoid greasy, spicy, heavily scented foods that can trigger nausea.",
      zh: "姜茶、吐司、白粥、白肉。避免油腻、辛辣、气味重的食物。",
    },
  },

  // ======================================================================
  // GnP weekly — post-dose early recovery (D2-D7, D9-D14)
  // ======================================================================
  {
    id: "gnp_post_dose_protein",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "gem_maintenance"],
    day_range: [4, 13],
    category: "diet",
    severity: "info",
    title: {
      en: "Protein window — prioritise now",
      zh: "蛋白窗口 —— 现在最该吃蛋白",
    },
    body: {
      en: "Target 1.2–1.5 g/kg/day. Eggs, fish, tofu, whey, lean meat. Muscle you build here protects you through nadir and the next cycle.",
      zh: "目标每公斤 1.2–1.5 克。鸡蛋、鱼、豆腐、乳清、瘦肉。现在攒下的肌肉帮你撑过低谷和下一周期。",
    },
  },
  {
    id: "gnp_resistance_window",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "gem_maintenance"],
    day_range: [4, 7],
    category: "exercise",
    severity: "info",
    title: {
      en: "Best window for resistance training",
      zh: "阻力训练的最佳窗口",
    },
    body: {
      en: "If energy is decent, do 2–3 short sessions (chair squats, wall push-ups, bands). Protects grip, gait, and dose eligibility.",
      zh: "若精力尚可，做 2–3 次短组（靠椅深蹲、墙壁俯卧撑、弹力带）。保护握力、步速、保证下次能如期用药。",
    },
  },
  {
    id: "gnp_pert_reminder",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "gem_maintenance", "mffx"],
    day_range: [1, 28],
    category: "meds",
    severity: "info",
    title: {
      en: "Creon with every meal + snack",
      zh: "每餐与加餐都服 Creon",
    },
    body: {
      en: "PERT is under-taken in PDAC. Full dose (25k–50k) with each meal, 10k with snacks. Missed PERT = missed protein = lost muscle.",
      zh: "胰腺癌胰酶补充常被忽略。每餐 25k–50k，加餐 10k。漏服 = 漏蛋白 = 掉肌肉。",
    },
  },

  // ======================================================================
  // GnP weekly — nadir (D16-D21)
  // ======================================================================
  {
    id: "gnp_nadir_hygiene",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx", "gem_maintenance"],
    day_range: [14, 21],
    category: "hygiene",
    severity: "warning",
    title: {
      en: "Nadir window — hand hygiene intensified",
      zh: "骨髓抑制低谷 —— 加强手卫生",
    },
    body: {
      en: "Neutrophils at their lowest. Wash hands before eating, after toilet, after outside. Alcohol gel between. Soft toothbrush, no flossing if platelets low.",
      zh: "中性粒细胞最低。进食前、上完厕所、外出后都要洗手。中间用酒精胶。软毛牙刷，血小板低时不用牙线。",
    },
  },
  {
    id: "gnp_nadir_crowds",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [14, 21],
    category: "safety",
    severity: "warning",
    title: {
      en: "Avoid crowds and sick contacts",
      zh: "避开人群与患病的人",
    },
    body: {
      en: "No gyms, no packed restaurants, no large family gatherings this week. Wear a mask in clinics, supermarkets, taxis. Ask anyone with a cough to stay away.",
      zh: "本周不去健身房、不进拥挤餐厅、不参加大型聚会。诊所、超市、打车戴口罩。有咳嗽的人请他们远离。",
    },
  },
  {
    id: "gnp_nadir_food_safety",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [14, 21],
    category: "diet",
    severity: "warning",
    title: {
      en: "Food safety this week",
      zh: "本周饮食安全",
    },
    body: {
      en: "No sushi / raw fish / raw eggs. No soft cheeses or buffet food. Wash all fruit and veg thoroughly. Cooked meat well-done. Pay attention to use-by dates.",
      zh: "本周不吃寿司 / 生鱼 / 生蛋。不吃软芝士或自助餐。所有果蔬彻底洗净。肉要煮熟。留意保质期。",
    },
  },
  {
    id: "gnp_nadir_temp",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [14, 21],
    category: "safety",
    severity: "warning",
    title: {
      en: "Temp twice daily. Fever ≥ 38 °C → hospital now",
      zh: "每日两次测体温。≥ 38 °C → 立即去医院",
    },
    body: {
      en: "9am and 6pm, same thermometer. Any temp ≥ 38 °C (or 37.5 °C sustained) — go to hospital, don't wait for a call-back. This is febrile neutropenia territory.",
      zh: "9 点和 18 点同一支体温计。体温 ≥ 38 °C（或 37.5 °C 持续）—— 立即去医院，不要等电话回复。这可能是发热性中性粒细胞减少。",
    },
  },
  {
    id: "gnp_nadir_pets",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [14, 21],
    category: "hygiene",
    severity: "caution",
    title: {
      en: "Delegate cat litter + gardening",
      zh: "猫砂和园艺请别人做",
    },
    body: {
      en: "No cleaning cat litter (toxoplasmosis). No gardening with bare hands (soil bacteria). Pat rather than cuddle pets. Wash hands after.",
      zh: "不要清猫砂（弓形虫）。园艺请戴手套（土壤菌）。宠物只拍不抱，抱后洗手。",
    },
  },
  {
    id: "gnp_nadir_dental",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [14, 21],
    category: "safety",
    severity: "caution",
    title: {
      en: "Postpone dental work",
      zh: "推迟牙科治疗",
    },
    body: {
      en: "No cleanings, fillings, or extractions during nadir. Schedule on D22–D28 instead.",
      zh: "低谷期不要做洗牙、补牙、拔牙。改到 D22–D28 做。",
    },
  },
  {
    id: "gnp_nadir_sleep",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly"],
    day_range: [14, 21],
    category: "sleep",
    severity: "info",
    title: {
      en: "Fatigue peaks here — permission to rest",
      zh: "此时疲劳最重 —— 允许自己休息",
    },
    body: {
      en: "Afternoon nap if needed. Short walks only. Aim for 8+ hours at night. Resting is protecting function, not losing it.",
      zh: "需要的话午睡。只做短距离步行。晚上目标睡 8 小时以上。休息是在保护功能，不是失去它。",
    },
  },
  {
    id: "gnp_nadir_mental",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [14, 21],
    category: "mental",
    severity: "info",
    title: {
      en: "Low mood around now is biological",
      zh: "此时心情低落是生理的",
    },
    body: {
      en: "Dex withdrawal + fatigue + infection risk all stack here. If you feel flat, that's chemistry — not a failure. It lifts by D22.",
      zh: "地塞米松撤药 + 疲劳 + 感染风险叠加。觉得低落是化学作用，不是退步。到 D22 会缓解。",
    },
  },
  {
    id: "gnp_nadir_bleeding",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [14, 21],
    category: "safety",
    severity: "caution",
    title: {
      en: "Watch for bruising or bleeding",
      zh: "留意淤青或出血",
    },
    body: {
      en: "Platelets dip too. No razor (use electric). Soft-bristle toothbrush. New petechiae, nosebleeds >10 min, black stool — call Dr Lee.",
      zh: "血小板也会低。别用剃须刀（改电动）。软毛牙刷。新出现瘀点、鼻血 >10 分钟、黑便 —— 联系 Dr Lee。",
    },
  },

  // ======================================================================
  // GnP weekly — late recovery / rest (D22-D28)
  // ======================================================================
  {
    id: "gnp_recovery_activity",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly"],
    day_range: [22, 28],
    category: "exercise",
    severity: "info",
    title: {
      en: "Recovery window — push the exercise",
      zh: "恢复期 —— 多做运动",
    },
    body: {
      en: "Counts are recovering. Best days for longer walks, qigong, resistance training, a meaningful meal out. This is when you rebuild.",
      zh: "血象恢复中。最适合散长步、气功、阻力训练、在外面吃一顿值得的饭。这是重建的窗口。",
    },
  },
  {
    id: "gnp_recovery_meaning",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [22, 28],
    category: "mental",
    severity: "info",
    title: {
      en: "Recovery window — plan meaningful contact",
      zh: "恢复期 —— 安排有意义的相聚",
    },
    body: {
      en: "Infection risk is down. A good week for family visits, grandchildren, community practice. Schedule it now while energy is here.",
      zh: "感染风险下降。最适合家人探望、孙辈、团体修习。趁有精神时安排好。",
    },
  },
  {
    id: "gnp_recovery_labs",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly"],
    day_range: [26, 28],
    category: "meds",
    severity: "info",
    title: {
      en: "Pre-cycle labs + clinic",
      zh: "下周期前化验 + 复诊",
    },
    body: {
      en: "FBC, LFTs, U&Es, CA19-9 typically. Confirm dose day on calendar. If unwell, call clinic sooner — delay is fine, catch-up is fine.",
      zh: "通常查血常规、肝功、电解质、CA19-9。确认下次用药日期。若不适，提早联系诊所 —— 延期没问题，补上也没问题。",
    },
  },

  // ======================================================================
  // GnP weekly — before D15 specifically (pre-nadir)
  // ======================================================================
  {
    id: "gnp_pre_nadir_stock",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly"],
    day_range: [12, 14],
    category: "diet",
    severity: "info",
    title: {
      en: "Stock up before nadir",
      zh: "低谷前备好食物",
    },
    body: {
      en: "Get groceries now. Next week you'll want to avoid supermarkets. Cook some easy meals and freeze portions.",
      zh: "现在买齐食材，下周最好不去超市。做些简单饭菜分装冷冻。",
    },
  },

  // ======================================================================
  // Cross-protocol: neuropathy vigilance
  // ======================================================================
  {
    id: "cipn_watch",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [1, 28],
    category: "safety",
    severity: "info",
    title: {
      en: "Tell us early if fingers / toes feel different",
      zh: "手指或脚趾有异感时尽早告诉我们",
    },
    body: {
      en: "Tingling, burning, numb patches — flag early. Early dose modification preserves function. Late is permanent.",
      zh: "刺痛、烧灼、麻木 —— 尽早标记。早减量保得住功能，晚了是永久的。",
    },
  },
  {
    id: "cipn_safety",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [1, 28],
    category: "safety",
    severity: "caution",
    title: {
      en: "If feet are numb — no bare feet, check shoes",
      zh: "若足底麻木 —— 不要赤脚，检查鞋内",
    },
    body: {
      en: "Numb feet don't feel injuries. Always wear shoes indoors. Check inside shoes for stones before putting them on. Check skin for blisters / cuts daily.",
      zh: "麻木的脚感觉不到伤。室内也穿鞋。穿鞋前检查里面有无小石子。每天看脚有没有水泡或小伤。",
    },
  },

  // ======================================================================
  // Gem-only maintenance — softer profile
  // ======================================================================
  {
    id: "gem_flu_like",
    protocol_ids: ["gem_maintenance"],
    day_range: [1, 3],
    category: "meds",
    severity: "info",
    title: {
      en: "Flu-like feeling is normal",
      zh: "流感样症状是常见的",
    },
    body: {
      en: "Gem alone can give low-grade achey/tired for 24–48 h after dose. Paracetamol OK. Fever ≥ 38 still means hospital.",
      zh: "吉西他滨用药后 24–48 小时常有轻度酸痛、乏力。对乙酰氨基酚可以用。体温 ≥ 38 仍需去医院。",
    },
  },

  // ======================================================================
  // mFFX — specific
  // ======================================================================
  {
    id: "mffx_cold_extreme",
    protocol_ids: ["mffx"],
    day_range: [1, 5],
    category: "safety",
    severity: "warning",
    title: {
      en: "Cold warning for 3–5 days",
      zh: "3–5 天内严格避冷",
    },
    body: {
      en: "Oxaliplatin cold sensitivity is severe and acute. No cold air on skin, gloves in fridge, warm drinks only, no cold handles on metal.",
      zh: "奥沙利铂对冷的敏感是重度的。皮肤不接触冷空气，开冰箱戴手套，只喝温热饮料，不摸冰的金属把手。",
    },
  },
  {
    id: "mffx_irinotecan_gi",
    protocol_ids: ["mffx"],
    day_range: [3, 7],
    category: "diet",
    severity: "warning",
    title: {
      en: "Delayed diarrhoea window",
      zh: "迟发性腹泻窗口",
    },
    body: {
      en: "Irinotecan diarrhoea often peaks D3–D7. Keep loperamide at hand, start at first loose stool. ≥ 4 in 24 h, or bloody, or with fever → clinic.",
      zh: "伊立替康迟发腹泻常在 D3–D7 达峰。随身备洛哌丁胺，第一次稀便即开始用。24 小时内 ≥ 4 次、带血或伴发热 —— 联系诊所。",
    },
  },

  // ======================================================================
  // Intimacy (protocol-wide)
  // ======================================================================
  {
    id: "intimacy_general",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "gem_maintenance", "mffx"],
    day_range: [1, 28],
    category: "intimacy",
    severity: "info",
    title: {
      en: "Intimacy is OK — with care",
      zh: "亲密接触可以 —— 注意几点",
    },
    body: {
      en: "Energy-permitting, yes. Condoms for first 72 h after dose (chemo in body fluids). Avoid during nadir (infection risk). Emotional closeness matters as much as physical.",
      zh: "若精力允许，当然可以。用药后 72 小时内用安全套（体液里有化疗药）。骨髓低谷期避免（感染风险）。情感亲近与身体亲近同样重要。",
    },
  },

  // ======================================================================
  // Mental / emotional — protocol-wide
  // ======================================================================
  {
    id: "dex_crash_day3",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "mffx"],
    day_range: [3, 5],
    category: "mental",
    severity: "info",
    title: {
      en: "Steroid dip is temporary",
      zh: "类固醇撤药低潮是暂时的",
    },
    body: {
      en: "Two to three days after dex, many people feel flat, tearful, irritable. It lifts on its own by day 5. Gentle practice, warm food, talk to someone.",
      zh: "地塞米松停后 2–3 天，很多人感到低落、爱哭、烦躁。到第 5 天自然缓解。温和修习、吃热的、跟人聊聊。",
    },
  },
  // ======================================================================
  // Narmafotinib (AMP945) — oral FAK inhibitor, continuous daily
  // ======================================================================
  {
    id: "narmafotinib_daily_adherence",
    protocol_ids: ["gnp_narmafotinib"],
    day_range: [1, 28],
    category: "meds",
    severity: "info",
    title: {
      en: "Narmafotinib: twice daily, with food",
      zh: "纳马非替尼：每日两次，与餐同服",
    },
    body: {
      en: "Take morning and evening at roughly 12 h apart, with a meal to reduce nausea. If a dose is missed by <6 h, take it. If >6 h, skip — do not double up. Log each dose in the daily check-in.",
      zh: "早晚约 12 小时间隔服用，与餐同服以减少恶心。漏服 <6 小时可补服；>6 小时跳过 —— 不要加倍。每次服药在每日打卡中记录。",
    },
  },
  {
    id: "narmafotinib_lft_monitor",
    protocol_ids: ["gnp_narmafotinib"],
    day_range: [22, 28],
    category: "meds",
    severity: "caution",
    title: {
      en: "Pre-cycle bloods: confirm LFTs",
      zh: "下周期前化验：务必查肝功",
    },
    body: {
      en: "Narmafotinib can elevate ALT/AST. Make sure LFTs are on the panel before the next cycle. If transaminases rise >3× ULN, Dr Lee may hold or dose-reduce narmafotinib.",
      zh: "纳马非替尼可引起 ALT/AST 升高。下次周期前确保化验单包含肝功。若转氨酶 >3× 正常上限，Dr Lee 可能暂停或减量。",
    },
  },
  {
    id: "narmafotinib_gi_first_week",
    protocol_ids: ["gnp_narmafotinib"],
    day_range: [1, 7],
    category: "diet",
    severity: "info",
    title: {
      en: "First week: watch narmafotinib GI tolerance",
      zh: "第一周：留意纳马非替尼的胃肠反应",
    },
    body: {
      en: "Nausea and loose stools are most common in the first 5–7 days as the body adjusts. Take with a real meal, not just a snack. Ginger, small frequent meals, scheduled ondansetron all help.",
      zh: "最初 5–7 天恶心和稀便最常见，身体需要适应。与正餐同服，不要只配小点心。姜茶、少量多餐、按时昂丹司琼都有帮助。",
    },
  },
  {
    id: "narmafotinib_hold_infusion_day",
    protocol_ids: ["gnp_narmafotinib"],
    day_range: [1, 28],
    category: "meds",
    severity: "caution",
    title: {
      en: "Check with Dr Lee: hold on infusion days?",
      zh: "与 Dr Lee 确认：输液日是否暂停？",
    },
    body: {
      en: "Some narmafotinib + GnP schedules hold the oral drug on D1/D8/D15 to reduce stacked toxicity. Confirm the specific rule for this regimen and document it in cycle notes.",
      zh: "部分纳马非替尼 + GnP 方案在 D1/D8/D15 输液日暂停口服药以减少毒性叠加。请与 Dr Lee 确认本方案的具体规则，并写入周期备注。",
    },
  },
  {
    id: "narmafotinib_rash_watch",
    protocol_ids: ["gnp_narmafotinib"],
    day_range: [1, 28],
    category: "safety",
    severity: "info",
    title: {
      en: "Flag any new rash early",
      zh: "新发皮疹尽早告知",
    },
    body: {
      en: "FAK inhibitors can cause rash or itch. Photo it, note the day, message Dr Lee. Early topical steroid / antihistamine is usually enough; ignoring it risks dose hold.",
      zh: "FAK 抑制剂可致皮疹或瘙痒。拍照留存、记录日期、告知 Dr Lee。早期外用激素 / 抗组胺通常足够；忽视可能导致暂停用药。",
    },
  },

  {
    id: "practice_rhythm",
    protocol_ids: ["gnp_weekly", "gnp_narmafotinib", "gnp_biweekly", "gem_maintenance", "mffx"],
    day_range: [4, 28],
    category: "mental",
    severity: "info",
    title: {
      en: "Protect the practice rhythm",
      zh: "保护修习的节奏",
    },
    body: {
      en: "Even 10 minutes of sitting or qigong matters. Practice during chemo is what carries function, stillness, meaning through the whole cycle.",
      zh: "哪怕 10 分钟静坐或气功也值。化疗期间的修习是贯穿整个周期、承载功能、安定与意义的。",
    },
  },
];

export function selectNudges({
  protocolId,
  cycleDay,
  symptomFlags,
  snoozedIds,
  dismissedIds,
}: {
  protocolId: string;
  cycleDay: number;
  symptomFlags?: string[];
  snoozedIds?: string[];
  dismissedIds?: string[];
}): NudgeTemplate[] {
  const snoozed = new Set(snoozedIds ?? []);
  const dismissed = new Set(dismissedIds ?? []);
  const flags = new Set(symptomFlags ?? []);

  return NUDGE_LIBRARY.filter((n) => {
    if (!n.protocol_ids.includes(protocolId as NudgeTemplate["protocol_ids"][number])) {
      return false;
    }
    if (snoozed.has(n.id) || dismissed.has(n.id)) return false;
    if (cycleDay < n.day_range[0] || cycleDay > n.day_range[1]) return false;
    if (n.if_symptom_flag && !flags.has(n.if_symptom_flag)) return false;
    return true;
  });
}

const SEVERITY_ORDER: Record<NudgeTemplate["severity"], number> = {
  warning: 0,
  caution: 1,
  info: 2,
};

export function sortBySeverity(
  nudges: NudgeTemplate[],
): NudgeTemplate[] {
  return nudges.slice().sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return a.day_range[0] - b.day_range[0];
  });
}
