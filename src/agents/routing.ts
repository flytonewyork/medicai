import type { AgentId, LogTag } from "~/types/agent";

// Many-to-many. Dad's log about "hands tingling after my dose" gets tagged
// `toxicity` + `treatment` by the tagger, which routes to toxicity + clinical
// + treatment agents in parallel.
//
// Legacy-module tags route to [] today. Once the `biographer` (slice 13)
// and `orchestrator` (slice 15) agents land, they'll pick up memory /
// social / legacy_voice / legacy_session / cooking / practice.
// Importantly: none of these tags should ever route to clinical agents,
// so the [] default here is correct — the psychology agent couples to
// reflection content via a separate path (slice 26), not general tag
// routing.
const TAG_TO_AGENTS: Record<LogTag, AgentId[]> = {
  diet: ["nutrition"],
  toxicity: ["toxicity", "clinical"],
  physical: ["rehabilitation"],
  symptom: ["toxicity", "clinical"],
  tumour: ["clinical"],
  mental: ["psychology"],
  treatment: ["treatment"],
  labs: ["clinical"],
  memory: [],
  social: [],
  legacy_voice: [],
  legacy_session: [],
  cooking: [],
  practice: [],
};

export function agentsForTags(tags: readonly LogTag[]): AgentId[] {
  const set = new Set<AgentId>();
  for (const tag of tags) {
    for (const id of TAG_TO_AGENTS[tag] ?? []) set.add(id);
  }
  return Array.from(set);
}
