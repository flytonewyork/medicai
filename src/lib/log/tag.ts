import type { LogTag } from "~/types/agent";

// Deterministic keyword/regex tagger. Runs both at /log render (to suggest
// chips to dad) and at /api/log submit (as a server-side backstop if the
// client sent no tags). Pure function — no Dexie reads, no network.
//
// Design notes:
// - Lowercased matching; both EN and simplified Chinese cues.
// - Prefer false positives over false negatives: an extra tag just routes
//   to one more specialist, which is cheap (~1 Opus call).
// - Numeric fast-paths in the UI (grip, weight, steps, energy) bypass the
//   tagger entirely and emit their own tags directly.

interface Rule {
  tag: LogTag;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    tag: "diet",
    patterns: [
      /\b(protein|meal|ate|eat|eating|breakfast|lunch|dinner|snack|kcal|calor|carb|fat|shake|drink|fluid|water|appetite|nausea|vomit|pert|creon|enzyme)\b/,
      /\b\d+\s*g(?:rams?)?\b/, // "25g", "30 grams"
      /[饱饭饮食蛋白质喝吃奶液腰肠药]/, // 饱/饭/饮/食/蛋白质/喝/吃/奶/液/胰肠药
    ],
  },
  {
    tag: "toxicity",
    patterns: [
      /\b(tingl\w*|numb\w*|neuropath\w*|pins and needles|cold sensit\w*|cold dys|mouth sore|oral ulcer|bruis\w*|bleed\w*|rash|hand.?foot|alopecia|hair loss|diarrh\w*|constipat\w*|dyspn\w*|shortness of breath|sob\b|chill\w*|fever|rigor)\b/,
      /[麻刺痛膚膚发热冒汗饭泻便秘呲噪滑滑]/, // 麻/刺/痛/肤/发热/冒汗/泻/便秘/呕/
    ],
  },
  {
    tag: "physical",
    patterns: [
      /\b(walk\w*|step\w*|stair\w*|grip|sit.?to.?stand|sts|tug|gait|strength|resistance|weight.?train|exercise|qigong|tai ?chi|stretch|yoga|mobility|balance)\b/,
      /\b\d+\s*(min|mins|minute|minutes|steps?)\b/,
      /[走路步路黄元最力足错板翻身平衡怅功]/, // 走/路/步/黄元/最力/脚/翻身/平衡/桩/功
    ],
  },
  {
    tag: "symptom",
    patterns: [
      /\b(pain|ache|sore\b|tender|cramp\w*|nausea|vomit\w*|dizz\w*|faint|breath\w*|cough|chill|swelling|edema|oedema|palpit\w*)\b/,
      /[痛酸晕嘽颗嗘噪噪咕咍哎哮]/, // 痛/酸/晕/嗳/咳/嗽
    ],
  },
  {
    tag: "tumour",
    patterns: [
      /\b(ca\s*19.?9|ca19.?9|cea|ctdna|tumou?r|mass|lesion|scan|ct\b|mri\b|pet.?ct|pet\b|recist|imaging)\b/,
      /[肿瘤扢投影扫量]/, // 肿/瘤/捕/投影/扫量
    ],
  },
  {
    tag: "mental",
    patterns: [
      /\b(mood|anxi\w*|worry|worried|depress\w*|low\b|sad|tear\w*|cry|fear\w*|panic|stress\w*|sleep|insomni\w*|meditat\w*|spiritual|pray\w*|family|friend|lonely|grief|peace)\b/,
      /[心情焦虑愤怒妨悦快乐悲忒神别怀]/, // 心情/焦虑/愤怒/悦/快乐/悲/忧/神别/怀
    ],
  },
  {
    tag: "treatment",
    patterns: [
      /\b(chemo|chemotherap\w*|gemcitabine|gem\b|nab.?paclitaxel|paclitaxel|abraxane|cycle|day ?\d+|dose|infusion|pump|line|port|dex\w*|dexamethasone|anti.?emetic|ondansetron|premed)\b/,
      /[化疗施注手法宣]/, // 化/疗/施/注/手法
    ],
  },
  {
    tag: "labs",
    patterns: [
      /\b(blood\s*test|lab|labs|fbc|eUC\b|lft\b|hb\b|haemoglobin|hemoglobin|platelet\w*|anc\b|neutrophil\w*|creatinine|albumin|bilirubin|alt\b|ast\b|alp\b|ggt\b|bun\b|urea\b)\b/,
      /[血质检测验实]/, // 血质检测验实
    ],
  },
  // Legacy-module tags. Heuristics intentionally loose: the biographer
  // would rather see a candidate memory and decide it's not one than
  // miss it entirely. `legacy_voice` and `legacy_session` are not
  // keyword-triggered — they're set by the capture flow itself.
  {
    tag: "memory",
    patterns: [
      /\b(remember\b|remembered|recalling|recall\b|childhood|when i was|years ago|back then|used to|we used to|the time (?:we|when|i)|reminisc\w*|nostalg\w*|the old days)\b/,
      /[忆記憶记得小时候从前昔日怀旧]/,
    ],
  },
  {
    tag: "social",
    patterns: [
      /\bfamily\s+(meal|dinner|lunch|breakfast|gathering|visit)\b/,
      /\b(dinner together|lunch together|meal together|gathering|get.?together|visit\w*|party|celebrat\w*|catch up|birthday|anniversary|reunion|holiday feast)\b/,
      /[聚会聚餐团聚家宴聚]/,
    ],
  },
  {
    tag: "cooking",
    patterns: [
      /\b(recipe|cook\w*|bak\w*|boil\w*|steam\w*|stir.?fry|fry|saut[eé]\w*|simmer|season\w*|marinat\w*|knead\w*|dough|broth|stock|sauce|dumpling|soup|dish)\b/,
      /[煮炒煎炖蒸烹饪做菜菜谱汤饺]/,
    ],
  },
  {
    tag: "practice",
    patterns: [
      /\b(qigong|qi ?gong|tai ?chi|meditat\w*|breath.?work|mindful\w*|pray\w*|scripture|sutra|dharma|mantra|chant\w*|spiritual\s+practice)\b/,
      /[气功太极打坐禅修静坐念经诵经]/,
    ],
  },
];

export function tagInput(text: string): LogTag[] {
  const lower = text.toLowerCase();
  const hits = new Set<LogTag>();
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(lower)) {
        hits.add(rule.tag);
        break;
      }
    }
  }
  return Array.from(hits);
}
