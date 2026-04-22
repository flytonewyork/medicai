import type { AgentId, LogTag } from "~/types/agent";

// Many-to-many. Dad's log about "hands tingling after my dose" gets tagged
// `toxicity` + `treatment` by the tagger, which routes to toxicity + clinical
// + treatment agents in parallel.
const TAG_TO_AGENTS: Record<LogTag, AgentId[]> = {
  diet: ["nutrition"],
  toxicity: ["toxicity", "clinical"],
  physical: ["rehabilitation"],
  symptom: ["toxicity", "clinical"],
  tumour: ["clinical"],
  mental: ["psychology"],
  treatment: ["treatment"],
  labs: ["clinical"],
};

export function agentsForTags(tags: readonly LogTag[]): AgentId[] {
  const set = new Set<AgentId>();
  for (const tag of tags) {
    for (const id of TAG_TO_AGENTS[tag] ?? []) set.add(id);
  }
  return Array.from(set);
}
