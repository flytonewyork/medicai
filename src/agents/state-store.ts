import { db, now } from "~/lib/db/dexie";
import type { AgentId, AgentStateRow } from "~/types/agent";

// Each agent rewrites its entire state.md every referral. We cap at this
// many characters so prompt size stays bounded — the agent is instructed
// to compress if it's approaching the limit.
export const STATE_MAX_CHARS = 3500;

export async function readAgentState(
  agentId: AgentId,
): Promise<AgentStateRow | undefined> {
  return db.agent_states.where("agent_id").equals(agentId).first();
}

export async function writeAgentState(
  agentId: AgentId,
  content: string,
): Promise<void> {
  const trimmed =
    content.length > STATE_MAX_CHARS
      ? content.slice(0, STATE_MAX_CHARS) + "\n\n…(truncated)"
      : content;
  const existing = await readAgentState(agentId);
  if (existing?.id) {
    await db.agent_states.update(existing.id, {
      content: trimmed,
      updated_at: now(),
    });
  } else {
    await db.agent_states.add({
      agent_id: agentId,
      content: trimmed,
      updated_at: now(),
    });
  }
}
