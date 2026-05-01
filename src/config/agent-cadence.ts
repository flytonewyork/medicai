import type { AgentId } from "~/types/agent";
import type { LocalizedText } from "~/types/localized";
import type { CycleContext } from "~/types/treatment";

// Per-discipline cadence config. Each agent has a patient-facing
// "voice" (AI Nurse / AI Dietician / AI Physio) and a default cadence
// — what days of the week it offers a check-in nudge in the absence of
// any other signal. The cycle-aware multiplier lets the toxicity / nurse
// agent ride harder during the nadir window and back off in the recovery
// week, matching the actual clinical risk profile of GnP.
//
// CLAUDE.md guardrails enforced here:
//   - No new top-level patient screen.
//   - Hard daily cap so the feed never feels overbearing.
//   - Suppress all discipline cadence prompts entirely if the patient is
//     currently in a red zone — the safety alert owns the channel that
//     day; we don't pile on with check-ins.

export interface AgentVoice {
  display_name: LocalizedText;
  // Lower-case slug used inside feed.source ("agent_voice:dietician").
  slug: string;
  icon: string;
  // Default per-week cadence — true = the agent offers a daily-style
  // check-in nudge that day if the patient hasn't already produced
  // signal. Sunday=0 … Saturday=6.
  weekly_pattern: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  // Optional copy for the cadence prompt that surfaces on a "due" day.
  cadence_prompt: LocalizedText;
}

// One row per AgentId, even agents that don't yet expose a voice (clinical,
// treatment) — keeps the type total. The feed-renderer reads this to swap
// the generic agent title ("Nutrition") for the patient-facing voice ("AI
// Dietician") on the agent_run feed cards.
export const AGENT_VOICES: Record<AgentId, AgentVoice> = {
  nutrition: {
    display_name: { en: "AI Dietician", zh: "AI 营养师" },
    slug: "dietician",
    icon: "salad",
    // Daily — diet/GI is the highest-frequency loop for PDAC.
    weekly_pattern: [true, true, true, true, true, true, true],
    cadence_prompt: {
      en: "Quick check-in — how were meals, fluids, and stools today?",
      zh: "简单回顾 —— 今日的正餐、饮水和排便情况如何？",
    },
  },
  toxicity: {
    display_name: { en: "AI Nurse", zh: "AI 护士" },
    slug: "nurse",
    icon: "thermo",
    // Daily during the nadir window (handled by cycle multiplier);
    // otherwise Mon / Wed / Fri to keep the channel quiet between dose
    // weeks.
    weekly_pattern: [false, true, false, true, false, true, false],
    cadence_prompt: {
      en: "Anything new with neuropathy, mouth, or bowels since yesterday?",
      zh: "自昨日以来神经病变、口腔或肠道有无新变化？",
    },
  },
  rehabilitation: {
    display_name: { en: "AI Physio", zh: "AI 物理治疗师" },
    slug: "physio",
    icon: "walk",
    // Mon / Wed / Fri — matches the resistance-training cadence the
    // exercise physiology guidance recommends.
    weekly_pattern: [false, true, false, true, false, true, false],
    cadence_prompt: {
      en: "Time for a quick movement check — walking minutes, any resistance work?",
      zh: "活动情况快报 —— 今天步行多少分钟？是否做了阻力训练？",
    },
  },
  clinical: {
    display_name: { en: "AI Clinician", zh: "AI 临床医师" },
    slug: "clinician",
    icon: "pulse",
    // No weekly cadence — clinical reasoning runs only when there's a
    // referral (lab, imaging, decision). All-false pattern means the
    // cadence engine never proactively prompts; the agent still runs
    // on demand and on the daily batch.
    weekly_pattern: [false, false, false, false, false, false, false],
    cadence_prompt: {
      en: "",
      zh: "",
    },
  },
  treatment: {
    display_name: { en: "AI Treatment", zh: "AI 化疗助手" },
    slug: "treatment",
    icon: "pill",
    weekly_pattern: [false, false, false, false, false, false, false],
    cadence_prompt: {
      en: "",
      zh: "",
    },
  },
  psychology: {
    display_name: { en: "AI Companion", zh: "AI 心境陪伴" },
    slug: "companion",
    icon: "moon",
    // Twice a week (Tue / Sat) — gentle. Daily psych prompts erode
    // signal and risk feeling pestering on tough days.
    weekly_pattern: [false, false, true, false, false, false, true],
    cadence_prompt: {
      en: "How are mood, sleep, and your practice sitting with you today?",
      zh: "今天的心情、睡眠和修习状态如何？",
    },
  },
};

// Hard cap on combined discipline cadence prompts in a single feed
// compose. Safety alerts, follow-ups, and agent daily reports are NOT
// counted against this cap — only the cadence prompts produced by this
// module.
export const MAX_CADENCE_PROMPTS_PER_DAY = 2;

// Hard cap on resurfaced multi-day follow-ups in a single feed compose.
// Combined with the prompt cap above, the patient sees at most ~5
// discipline-driven items per day, sitting under safety + treatment +
// task items.
export const MAX_FOLLOW_UPS_PER_DAY = 3;

// Suppress all discipline cadence prompts entirely when this many or
// more red zone alerts are active — don't pile cheerful check-ins on
// top of a safety event.
export const RED_ZONE_SUPPRESSION_COUNT = 1;

// Base priority for cadence prompts in the feed. Sits below safety
// (0–30), treatment / task / cycle-relevant (30–50), but above gentle
// trend nudges (≥ 60).
export const CADENCE_PROMPT_PRIORITY = 55;

// Base priority for resurfaced follow-ups. Slightly higher than a
// fresh cadence prompt because the patient already heard the question
// once and there's a real reason to ask again.
export const FOLLOW_UP_PRIORITY = 40;

export interface CadenceMultiplierInputs {
  agentId: AgentId;
  cycleContext: CycleContext | null;
}

// Cycle-aware boost: during the nadir window (cycle days 7–14 of GnP),
// the toxicity / nurse cadence flips to daily so we catch febrile
// neutropenia, mucositis, and diarrhoea early. During the recovery
// week, dietician stays daily but physio softens.
//
// Returns `true` if the agent should prompt today regardless of its
// weekly_pattern; `false` to follow the static pattern; `null` to
// suppress entirely (e.g. red zone is active and the cap kicked in).
export function shouldPromptOverride(
  inputs: CadenceMultiplierInputs,
): boolean | null {
  const { agentId, cycleContext } = inputs;
  if (!cycleContext) return false;
  const phase = cycleContext.phase?.key;
  if (agentId === "toxicity" && phase === "nadir") return true;
  if (agentId === "nutrition" && phase === "nadir") return true;
  return false;
}
