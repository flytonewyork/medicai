import type { ProfilePrompt, PromptSource } from "~/types/legacy";
import type { LocalizedString } from "~/types/feed";

// Seeded bilingual prompt library. ~120 prompts across seven evidence-
// based frameworks plus a deliberate lightness band.
//
// Every prompt carries:
//   - audience (whom it's asked of)
//   - depth + sensitivity (the cadence engine honours these)
//   - source citation (so we know WHERE an interview move comes from)
//   - cadence_weight (how often it surfaces when the engine picks)
//   - pair_id when the prompt is meant to be answered in parallel by a
//     different audience on the same theme
//
// Framework citations:
//   dignity_therapy   — Chochinov's nine-question generativity interview
//   mcp               — Breitbart, Meaning-Centered Psychotherapy
//   fgft              — Kissane, Family Focused Grief Therapy
//   butler_life_review — Butler 1963, systematic chapter recall
//   narrative_med     — Charon, witnessing / being witnessed
//   pennebaker        — expressive-writing protocol
//   ambiguous_loss    — Boss, grief of living with someone dying
//   chinese_tradition — 回忆录 (memoir) and 家谱 (genealogy) frames
//
// Kept deliberately declarative so the biographer agent (slice 13) and
// the cadence engine (slice 12) can import it as data and iterate.
//
// See docs/LEGACY_MODULE.md §"Feature set" + §"Evidence base".

type PromptSeed = Omit<ProfilePrompt, "id" | "created_at" | "updated_at">;

function p(
  category: string,
  depth: ProfilePrompt["depth"],
  audience: ProfilePrompt["audience"],
  source: PromptSource,
  sensitivity: ProfilePrompt["sensitivity"],
  cadence_weight: number,
  question: LocalizedString,
  pair_id?: string,
): PromptSeed {
  return {
    category,
    depth,
    audience,
    source,
    sensitivity,
    cadence_weight,
    question,
    pair_id,
  };
}

export const PROMPTS_SEED: PromptSeed[] = [
  // ── Origins (Butler chapter 1) ─────────────────────────────────────
  p(
    "origins",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.9,
    {
      en: "Where were you born, and what do you remember about that place?",
      zh: "您出生在哪里?对那片地方还记得些什么?",
    },
    "origins-place",
  ),
  p(
    "origins",
    "biographical",
    "thomas",
    "butler_life_review",
    "low",
    0.7,
    {
      en: "What do you already know — and wish you knew — about where Dad was born?",
      zh: "关于爸爸出生的地方,您知道哪些?又希望了解些什么?",
    },
    "origins-place",
  ),
  p(
    "origins",
    "biographical",
    "hulin",
    "chinese_tradition",
    "low",
    0.8,
    {
      en: "Tell me about your parents — their names, their temperaments, what you remember of them.",
      zh: "说说您的父母——他们的名字、性格,您记得的他们。",
    },
  ),
  p(
    "origins",
    "biographical",
    "hulin",
    "chinese_tradition",
    "medium",
    0.6,
    {
      en: "Were there grandparents or great-grandparents who shaped you?",
      zh: "有哪位祖辈或曾祖辈对您影响很深?",
    },
  ),
  p(
    "origins",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.7,
    {
      en: "What smells or sounds take you back to childhood the fastest?",
      zh: "哪些气味或声音最能把您带回童年?",
    },
  ),
  p(
    "origins",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.6,
    {
      en: "What games did you play as a child, and with whom?",
      zh: "小时候您玩过什么游戏?和谁一起玩?",
    },
  ),

  // ── Becoming (school, migration, young adulthood) ─────────────────
  p(
    "becoming",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.8,
    {
      en: "Which teacher or mentor most shaped you, and what did they teach you that's still with you?",
      zh: "哪位老师或导师对您影响最深?他们教给您的哪些东西至今仍在?",
    },
  ),
  p(
    "becoming",
    "biographical",
    "hulin",
    "butler_life_review",
    "medium",
    0.7,
    {
      en: "Tell me about the decision to leave home for the first time.",
      zh: "说说您第一次离开家乡的那个决定。",
    },
  ),
  p(
    "becoming",
    "biographical",
    "hulin",
    "chinese_tradition",
    "low",
    0.7,
    {
      en: "What were your first years in Australia like?",
      zh: "您在澳大利亚的最初几年是什么样的?",
    },
  ),
  p(
    "becoming",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.6,
    {
      en: "What did you believe you'd become when you were twenty?",
      zh: "二十岁的时候,您以为自己会成为一个什么样的人?",
    },
  ),

  // ── Love & fatherhood ──────────────────────────────────────────────
  p(
    "love",
    "biographical",
    "hulin",
    "dignity_therapy",
    "low",
    0.9,
    {
      en: "How did you and Catherine meet?",
      zh: "您和妈妈是怎么相识的?",
    },
    "love-meeting",
  ),
  p(
    "love",
    "biographical",
    "catherine",
    "narrative_med",
    "low",
    0.9,
    {
      en: "From your side — how did you know?",
      zh: "从您的角度——当时您是怎么确定的?",
    },
    "love-meeting",
  ),
  p(
    "love",
    "biographical",
    "hulin",
    "dignity_therapy",
    "low",
    0.9,
    {
      en: "Tell me about the day Thomas was born — what surprised you about being a father?",
      zh: "说说托马斯出生的那一天——成为父亲,最让您意外的是什么?",
    },
    "love-fatherhood",
  ),
  p(
    "love",
    "reflective",
    "thomas",
    "narrative_med",
    "low",
    0.9,
    {
      en: "What do you wish you knew about what Dad went through when you were born?",
      zh: "您希望对爸爸在您出生时的经历了解些什么?",
    },
    "love-fatherhood",
  ),
  p(
    "love",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.7,
    {
      en: "What's one memory from Thomas as a small child that still makes you smile?",
      zh: "托马斯小时候的哪一件事,至今想起来还让您微笑?",
    },
  ),
  p(
    "love",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.6,
    {
      en: "What did you and Catherine disagree about in the early years, and what did you learn from it?",
      zh: "您和妈妈在早年的时候意见相左过什么?从中学到了什么?",
    },
  ),

  // ── Craft & career ─────────────────────────────────────────────────
  p(
    "craft",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.7,
    {
      en: "What did your work teach you that nothing else could have?",
      zh: "您的工作教会了您哪些其它地方学不到的东西?",
    },
  ),
  p(
    "craft",
    "biographical",
    "hulin",
    "dignity_therapy",
    "low",
    0.7,
    {
      en: "What are you most proud of having built or contributed to?",
      zh: "您最自豪的,是曾经建造或为之付出过的什么?",
    },
  ),
  p(
    "craft",
    "biographical",
    "hulin",
    "butler_life_review",
    "low",
    0.6,
    {
      en: "Was there a moment your work nearly broke you, and how did you come through it?",
      zh: "有没有哪段工作让您几乎被压垮?您是怎么走过来的?",
    },
  ),

  // ── Faith & practice (core per patient values) ─────────────────────
  p(
    "practice",
    "biographical",
    "hulin",
    "chinese_tradition",
    "low",
    0.9,
    {
      en: "Who first taught you Qigong, and what did they see in you?",
      zh: "是谁最初教您气功的?他们在您身上看到了什么?",
    },
  ),
  p(
    "practice",
    "biographical",
    "hulin",
    "chinese_tradition",
    "low",
    0.9,
    {
      en: "What is the essence of the practice you've carried for decades?",
      zh: "您几十年来修行的核心,究竟是什么?",
    },
  ),
  p(
    "practice",
    "reflective",
    "hulin",
    "mcp",
    "low",
    0.8,
    {
      en: "What has stillness taught you that motion never could?",
      zh: "静,教给了您哪些动所教不了的?",
    },
  ),
  p(
    "practice",
    "biographical",
    "hulin",
    "chinese_tradition",
    "low",
    0.7,
    {
      en: "Is there a teaching or saying from your spiritual tradition that you'd like the family to remember?",
      zh: "您的修行传统中,有没有一句话或一段教诲,希望家人记住?",
    },
  ),

  // ── Values & wisdom (Dignity Therapy core) ─────────────────────────
  p(
    "values",
    "reflective",
    "hulin",
    "dignity_therapy",
    "medium",
    0.9,
    {
      en: "What matters most to you, and what has mattered most across your life?",
      zh: "什么对您最重要?一生中最让您在意的又是什么?",
    },
  ),
  p(
    "values",
    "reflective",
    "hulin",
    "dignity_therapy",
    "medium",
    0.8,
    {
      en: "What have you learned about life you want Thomas to know?",
      zh: "关于人生,您学到了哪些希望托马斯也知道的?",
    },
  ),
  p(
    "values",
    "dignity",
    "hulin",
    "dignity_therapy",
    "high",
    0.6,
    {
      en: "If you were writing to Thomas on his fiftieth birthday, what would you say?",
      zh: "如果您要为托马斯五十岁的生日写一封信,您会说什么?",
    },
  ),
  p(
    "values",
    "dignity",
    "hulin",
    "dignity_therapy",
    "high",
    0.5,
    {
      en: "Is there anyone you want to say something to — perhaps that has gone unsaid?",
      zh: "有没有您想对某个人说的话——也许从未说出口?",
    },
  ),
  p(
    "values",
    "reflective",
    "hulin",
    "mcp",
    "medium",
    0.7,
    {
      en: "What meaning do you find in this period of your life?",
      zh: "在您生命的这段时光里,您找到了怎样的意义?",
    },
  ),
  p(
    "values",
    "reflective",
    "hulin",
    "mcp",
    "medium",
    0.6,
    {
      en: "What do you still hope for?",
      zh: "您仍然期盼着什么?",
    },
  ),

  // ── Relationships (dyads) ──────────────────────────────────────────
  p(
    "relationships",
    "reflective",
    "catherine",
    "fgft",
    "medium",
    0.7,
    {
      en: "What have you learned about him in the last year that you didn't know before?",
      zh: "最近一年,您对他有了哪些过去不知道的新认识?",
    },
  ),
  p(
    "relationships",
    "reflective",
    "thomas",
    "fgft",
    "medium",
    0.7,
    {
      en: "What about Dad surprises you now that you didn't see when you were younger?",
      zh: "现在对爸爸有哪些,您在年轻时没有看到的?",
    },
  ),
  p(
    "relationships",
    "biographical",
    "hulin",
    "butler_life_review",
    "medium",
    0.6,
    {
      en: "Tell me about a friend who changed the shape of your life.",
      zh: "说一位改变过您人生的朋友。",
    },
  ),

  // ── Lightness (explicit counterweight to the heavier prompts) ──────
  p(
    "lightness",
    "icebreaker",
    "hulin",
    "custom",
    "low",
    0.8,
    {
      en: "What's a food you could happily eat every day?",
      zh: "有一种食物您每天吃都不会腻,那是什么?",
    },
  ),
  p(
    "lightness",
    "icebreaker",
    "hulin",
    "custom",
    "low",
    0.8,
    {
      en: "What song, when it plays, always stops you for a moment?",
      zh: "哪一首歌一响起,总会让您停下来片刻?",
    },
  ),
  p(
    "lightness",
    "icebreaker",
    "thomas",
    "custom",
    "low",
    0.7,
    {
      en: "What's a saying of Dad's you catch yourself using now?",
      zh: "爸爸常挂在嘴边的哪句话,您现在也会脱口而出?",
    },
  ),
  p(
    "lightness",
    "icebreaker",
    "catherine",
    "custom",
    "low",
    0.7,
    {
      en: "What's a small habit of his that always makes you smile?",
      zh: "他的哪个小习惯,总是让您会心一笑?",
    },
  ),
  p(
    "lightness",
    "icebreaker",
    "hulin",
    "custom",
    "low",
    0.6,
    {
      en: "Who do you find funny? Which comedians, which family members?",
      zh: "您觉得谁有意思?哪些艺人、哪些家人让您觉得好笑?",
    },
  ),
  p(
    "lightness",
    "icebreaker",
    "hulin",
    "custom",
    "low",
    0.7,
    {
      en: "Tell me about a trip you'd still love to take.",
      zh: "说一个您仍想去的地方。",
    },
  ),

  // ── Mannerisms (observational, from family) ────────────────────────
  p(
    "mannerisms",
    "icebreaker",
    "any_family",
    "custom",
    "low",
    0.7,
    {
      en: "What's something Dad always says, in English or in Chinese?",
      zh: "爸爸常说的一句话是什么?中英文都可以。",
    },
  ),
  p(
    "mannerisms",
    "icebreaker",
    "any_family",
    "custom",
    "low",
    0.6,
    {
      en: "What's a gesture or expression of Dad's you can picture right now?",
      zh: "闭上眼睛,您能立刻浮现的爸爸的一个动作或表情?",
    },
  ),

  // ── Caregiver reflection (ambiguous loss + Pennebaker) ─────────────
  p(
    "caregiver",
    "reflective",
    "catherine",
    "ambiguous_loss",
    "high",
    0.5,
    {
      en: "What is the hardest thing about this period that you haven't said out loud?",
      zh: "这段时间里,最难的一件事——您还没有说出口的是什么?",
    },
  ),
  p(
    "caregiver",
    "reflective",
    "thomas",
    "ambiguous_loss",
    "high",
    0.5,
    {
      en: "What have you learned about yourself in the last few months?",
      zh: "最近这几个月,您对自己有了什么新的认识?",
    },
  ),
  p(
    "caregiver",
    "reflective",
    "catherine",
    "pennebaker",
    "medium",
    0.4,
    {
      en: "Write for fifteen minutes about a feeling you've been carrying. Nobody else will read it unless you choose.",
      zh: "用十五分钟写一写您心里的一种感受。除非您愿意,否则无人会看到。",
    },
  ),
  p(
    "caregiver",
    "reflective",
    "thomas",
    "pennebaker",
    "medium",
    0.4,
    {
      en: "Write for fifteen minutes about something you want to understand better. No structure — just write.",
      zh: "用十五分钟写下一件您想更深理解的事情。不用结构——随意写。",
    },
  ),

  // ── Shared family (to be answered together) ────────────────────────
  p(
    "shared",
    "reflective",
    "shared_family",
    "fgft",
    "low",
    0.5,
    {
      en: "Sit down together and tell the story of one family holiday, taking turns. Record it.",
      zh: "一家人坐下来,轮流讲述一次家庭旅行。记录下来。",
    },
  ),
  p(
    "shared",
    "reflective",
    "shared_family",
    "fgft",
    "low",
    0.4,
    {
      en: "Each of you: one thing you admire about the other two. Say it out loud.",
      zh: "你们每个人:讲一件欣赏对方的事。说出来。",
    },
  ),
];

export async function seedProfilePrompts(
  db: import("dexie").Dexie & {
    profile_prompts: import("dexie").Table<ProfilePrompt, number>;
  },
): Promise<number> {
  const now = new Date().toISOString();
  const rows = PROMPTS_SEED.map<ProfilePrompt>((p) => ({
    ...p,
    created_at: now,
    updated_at: now,
  }));
  await db.profile_prompts.bulkAdd(rows);
  return rows.length;
}
