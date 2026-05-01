import type { AgentRunRow, AgentId } from "~/types/agent";
import type { FeedItem } from "~/types/feed";
import { AGENT_VOICES } from "~/config/agent-cadence";

// Convert the latest run per agent into feed items. Each agent's most
// recent run becomes one card; older runs are not surfaced (they live in
// agent_runs for audit / history).
//
// Priority is bucketed:
//   - any red safety_flag in the run     → 5  (just below zone alerts)
//   - any orange / yellow safety_flag    → 25
//   - otherwise                          → 55 (sits below cycle nudges,
//                                              above non-urgent trends)
export function agentRunsToFeedItems(runs: readonly AgentRunRow[]): FeedItem[] {
  const latestByAgent = new Map<AgentId, AgentRunRow>();
  for (const run of runs) {
    const prev = latestByAgent.get(run.agent_id);
    if (!prev || run.ran_at > prev.ran_at) {
      latestByAgent.set(run.agent_id, run);
    }
  }
  return Array.from(latestByAgent.values())
    .map(runToFeedItem)
    .filter((x): x is FeedItem => x !== null);
}

function runToFeedItem(run: AgentRunRow): FeedItem | null {
  const report = run.output.daily_report;
  if (!report || (!report.en?.trim() && !report.zh?.trim())) return null;
  if (typeof run.id !== "number") return null;

  const flagLevels = run.output.safety_flags.map((f) => f.level);
  const hasRed = flagLevels.includes("red");
  const hasOrange = flagLevels.includes("orange");
  const hasYellow = flagLevels.includes("yellow");

  const priority = hasRed ? 5 : hasOrange || hasYellow ? 25 : 55;
  const tone: FeedItem["tone"] = hasRed
    ? "warning"
    : hasOrange
      ? "warning"
      : hasYellow
        ? "caution"
        : "info";

  const voice = AGENT_VOICES[run.agent_id];
  return {
    id: `agent_run_${run.agent_id}_${run.id}`,
    priority,
    category: AGENT_FEED_CATEGORY[run.agent_id],
    tone,
    title: voice.display_name,
    body: report,
    icon: voice.icon,
    source: `agent:${run.agent_id}`,
    meta: {
      kind: "agent_run",
      agent_id: run.agent_id,
      run_id: run.id,
    },
  };
}

const AGENT_FEED_CATEGORY: Record<AgentId, FeedItem["category"]> = {
  nutrition: "body",
  toxicity: "safety",
  clinical: "treatment",
  rehabilitation: "body",
  treatment: "treatment",
  psychology: "encouragement",
};
