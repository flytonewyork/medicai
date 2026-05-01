import type { FeedItem } from "~/types/feed";
import type { AgentId } from "~/types/agent";
import type { CycleContext } from "~/types/treatment";
import type { DailyEntry, ZoneAlert } from "~/types/clinical";
import {
  AGENT_VOICES,
  CADENCE_PROMPT_PRIORITY,
  MAX_CADENCE_PROMPTS_PER_DAY,
  RED_ZONE_SUPPRESSION_COUNT,
  shouldPromptOverride,
} from "~/config/agent-cadence";

// Per-discipline daily / weekly cadence prompts. Each discipline (AI
// Dietician, AI Nurse, AI Physio, AI Companion) has its own weekly
// cadence pattern in agent-cadence.ts. This module turns that pattern
// — plus today's cycle context, today's daily entry, and active zone
// alerts — into a small set of feed items.
//
// Hard guardrails:
//   - Suppress all cadence prompts entirely if any red zone alert is
//     active (RED_ZONE_SUPPRESSION_COUNT). Safety owns the channel.
//   - Skip a discipline's prompt if the patient already touched its
//     domain today (e.g. dietician quiet if meals + stool already
//     logged) — we don't pester for redundant input.
//   - Cap total prompts at MAX_CADENCE_PROMPTS_PER_DAY.

export interface CadenceInputs {
  todayISO: string; // YYYY-MM-DD
  cycleContext: CycleContext | null;
  todayDaily: DailyEntry | null;
  activeAlerts: ZoneAlert[];
}

export function computeCadencePrompts(inputs: CadenceInputs): FeedItem[] {
  const redCount = inputs.activeAlerts.filter(
    (a) => !a.resolved && a.zone === "red",
  ).length;
  if (redCount >= RED_ZONE_SUPPRESSION_COUNT) return [];

  const dow = new Date(inputs.todayISO + "T12:00:00").getDay();
  const out: FeedItem[] = [];

  // Order matters when the cap kicks in: dietician + nurse first
  // because GI and toxicity are the highest-yield daily channels for
  // this patient population.
  const order: AgentId[] = [
    "nutrition",
    "toxicity",
    "rehabilitation",
    "psychology",
    "clinical",
    "treatment",
  ];

  for (const id of order) {
    if (out.length >= MAX_CADENCE_PROMPTS_PER_DAY) break;
    if (!shouldPromptToday(id, dow, inputs.cycleContext)) continue;
    if (alreadyCoveredToday(id, inputs.todayDaily)) continue;
    out.push(promptItem(id, inputs.todayISO));
  }

  return out;
}

function shouldPromptToday(
  id: AgentId,
  dow: number,
  cycleContext: CycleContext | null,
): boolean {
  const voice = AGENT_VOICES[id];
  const override = shouldPromptOverride({ agentId: id, cycleContext });
  if (override === true) return true;
  if (override === null) return false;
  return voice.weekly_pattern[dow] === true;
}

// Heuristic: if the patient already produced signal in this discipline's
// domain today, skip the prompt. Dietician needs meals + (stool OR PERT
// OR appetite). Nurse needs any toxicity field touched. Physio needs
// any movement field. Companion needs reflection or practice.
function alreadyCoveredToday(id: AgentId, today: DailyEntry | null): boolean {
  if (!today) return false;
  switch (id) {
    case "nutrition":
      return (
        typeof today.meals_count === "number" &&
        (typeof today.stool_count === "number" ||
          typeof today.stool_bristol === "number" ||
          today.pert_with_meals_today !== undefined)
      );
    case "toxicity":
      return (
        typeof today.neuropathy_hands === "number" ||
        typeof today.neuropathy_feet === "number" ||
        typeof today.diarrhoea_count === "number" ||
        today.mouth_sores === true ||
        today.fever === true
      );
    case "rehabilitation":
      return (
        typeof today.walking_minutes === "number" ||
        typeof today.steps === "number" ||
        today.resistance_training === true
      );
    case "psychology":
      return (
        typeof today.reflection === "string" && today.reflection.length > 0
      );
    default:
      return false;
  }
}

function promptItem(id: AgentId, todayISO: string): FeedItem {
  const voice = AGENT_VOICES[id];
  return {
    id: `cadence_${voice.slug}_${todayISO}`,
    priority: CADENCE_PROMPT_PRIORITY,
    category: "checkin",
    tone: "info",
    title: voice.display_name,
    body: voice.cadence_prompt,
    cta: {
      href: "/log",
      label: { en: "Tell us", zh: "告诉我们" },
    },
    icon: voice.icon,
    source: `agent_voice:${voice.slug}`,
  };
}
