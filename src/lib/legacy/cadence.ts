import type { FeedItem } from "~/types/feed";
import type {
  ProfilePrompt,
  PromptAudience,
  PromptSensitivity,
} from "~/types/legacy";
import type { Zone } from "~/types/clinical";

// Cadence engine — picks which prompt surfaces to each audience today.
//
// The engine is NOT a retreat scheduler. It's a pace-keeper. Design
// goals:
//   1. One active prompt per person at a time (never two open requests)
//   2. Don't repeat recently-asked prompts
//   3. Gate heavy prompts (sensitivity="high") during Orange/Red zone
//      or recent stress signals
//   4. Tilt cadence toward lightness when overall tone is heavy
//   5. No streaks, no counters, no progress-bar pressure
//
// Emits at most one FeedItem per audience per day. Opt-out is handled
// at the composer level (settings), not here.

export interface CadenceInputs {
  todayISO: string;
  /** All prompts in the library. */
  prompts: ProfilePrompt[];
  /** Current zone for stress gating. */
  zone: Zone | null;
  /** Audience to produce a feed item for. */
  audience: PromptAudience;
  /**
   * How many days should elapse before re-asking a prompt with this
   * audience. Default 60.
   */
  min_days_between_reasks?: number;
}

/** Pick today's prompt for one audience, or null if none eligible. */
export function pickNextPrompt(inputs: CadenceInputs): ProfilePrompt | null {
  const today = new Date(inputs.todayISO + "T12:00:00");
  const reaskWindowMs =
    (inputs.min_days_between_reasks ?? 60) * 24 * 60 * 60 * 1000;

  const eligible = inputs.prompts.filter((p) => {
    if (p.audience !== inputs.audience) return false;
    if (!isSensitivityAllowed(p.sensitivity, inputs.zone)) return false;
    if (p.asked_at) {
      const gap = today.getTime() - new Date(p.asked_at).getTime();
      if (gap < reaskWindowMs) return false;
    }
    return true;
  });

  if (eligible.length === 0) return null;

  // Weighted scoring: cadence_weight is the base. If zone is heavy,
  // bias toward lightness category and away from high-sensitivity
  // (which were already filtered, but we still prefer lighter of the
  // remaining). Unanswered pair prompts get a small boost so paired
  // conversations land within a reasonable window.
  const scored = eligible.map((p) => ({
    prompt: p,
    score: scorePrompt(p, inputs.zone),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.prompt ?? null;
}

function isSensitivityAllowed(
  sensitivity: PromptSensitivity,
  zone: Zone | null,
): boolean {
  // High-sensitivity prompts (Dignity Therapy core, ambiguous loss)
  // pause during Orange/Red zones. Low + medium always allowed.
  if (!zone) return true;
  if (sensitivity === "high" && (zone === "orange" || zone === "red")) {
    return false;
  }
  return true;
}

function scorePrompt(p: ProfilePrompt, zone: Zone | null): number {
  let score = p.cadence_weight;

  // In Yellow/Orange/Red, tilt toward lightness (category-level).
  if (zone && zone !== "green") {
    if (p.category === "lightness") score += 0.2;
    if (p.depth === "icebreaker") score += 0.1;
    if (p.sensitivity === "medium") score -= 0.1;
  }

  // Re-ask decay: prompts never asked get a small advantage over ones
  // asked long ago.
  if (!p.asked_at) score += 0.1;

  return score;
}

/**
 * Given a picked prompt, produce a feed item addressed to the right
 * audience. Priority 90–95 — deliberately low, never crowds a Red zone.
 */
export function promptToFeedItem(
  prompt: ProfilePrompt,
  audience: PromptAudience,
): FeedItem {
  return {
    id: `dignity_prompt:${audience}:${prompt.id ?? prompt.category}`,
    priority: 92,
    category: "memory",
    tone: "positive",
    title: titleFor(audience),
    body: prompt.question,
    cta: {
      href: `/family/legacy/prompt/${prompt.id ?? ""}`,
      label: {
        en: "Respond when you have a moment",
        zh: "有空的时候再回应",
      },
    },
    icon: "chat",
    source: "dignity_prompt",
  };
}

function titleFor(audience: PromptAudience): FeedItem["title"] {
  switch (audience) {
    case "hulin":
      return {
        en: "Something small — when you have a moment",
        zh: "一个小小的话题——有空的时候",
      };
    case "catherine":
      return {
        en: "A reflection, whenever fits",
        zh: "一段思考,随您方便",
      };
    case "thomas":
      return {
        en: "A reflection, whenever fits",
        zh: "一段思考,随您方便",
      };
    case "any_family":
      return {
        en: "A memory to share",
        zh: "一段可以分享的记忆",
      };
    case "shared_family":
      return {
        en: "Something to try together",
        zh: "一件可以一起做的事",
      };
  }
}
