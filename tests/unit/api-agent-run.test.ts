import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentOutput } from "~/types/agent";
import type { RunAgentArgs } from "~/agents/run";

// Mock runAgent before importing the route so the route binds to the mock.
const runAgentMock = vi.fn<[RunAgentArgs], Promise<AgentOutput>>();

vi.mock("~/agents/run", () => ({
  runAgent: (args: RunAgentArgs) => runAgentMock(args),
  selectReferralsForAgent: () => [],
}));

function emptyOutput(): AgentOutput {
  return {
    daily_report: { en: "", zh: "" },
    safety_flags: [],
    filings: [],
    questions: [],
    nudges: [],
    state_diff: "",
  };
}

const baseBody = {
  referrals: [
    {
      id: 1,
      at: "2026-04-22T08:00:00Z",
      input: {
        text: "had 25 g protein",
        tags: ["diet"],
        locale: "en",
        at: "2026-04-22T08:00:00Z",
      },
    },
  ],
  state_md: "yesterday: protein 60 g",
  locale: "en",
  date: "2026-04-22",
  trigger: "on_demand",
};

describe("/api/agent/[id]/run route", () => {
  beforeEach(() => {
    runAgentMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("404s for an unknown agent id", async () => {
    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/agent/triage/run", {
        method: "POST",
        body: JSON.stringify(baseBody),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "triage" } },
    );
    expect(res.status).toBe(404);
  });

  it("400s on invalid JSON", async () => {
    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/agent/nutrition/run", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "nutrition" } },
    );
    expect(res.status).toBe(400);
  });

  it("400s on schema-invalid body (missing required fields)", async () => {
    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/agent/nutrition/run", {
        method: "POST",
        body: JSON.stringify({ referrals: [], locale: "en" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "nutrition" } },
    );
    expect(res.status).toBe(400);
  });

  it("503s when ANTHROPIC_API_KEY is absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/agent/nutrition/run", {
        method: "POST",
        body: JSON.stringify(baseBody),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "nutrition" } },
    );
    expect(res.status).toBe(503);
  });

  it("returns the agent output on success", async () => {
    runAgentMock.mockResolvedValue({
      ...emptyOutput(),
      daily_report: {
        en: "Protein up to 25 g today; aim for 60 g+ tomorrow.",
        zh: "今天蛋白 25 克，明天目标 60 克以上。",
      },
      filings: [
        {
          table: "daily_entries",
          strategy: "upsert_by_date",
          data: { date: "2026-04-22", protein_grams: 25 },
        },
      ],
      state_diff: "Protein 25 g today.",
    });

    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/agent/nutrition/run", {
        method: "POST",
        body: JSON.stringify(baseBody),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "nutrition" } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agent_id: string;
      referral_count: number;
      trigger: string;
      output: AgentOutput;
    };
    expect(body.agent_id).toBe("nutrition");
    expect(body.referral_count).toBe(1);
    expect(body.trigger).toBe("on_demand");
    expect(body.output.daily_report.en).toMatch(/protein/i);
    expect(body.output.filings[0]?.data).toMatchObject({ protein_grams: 25 });
    expect(runAgentMock).toHaveBeenCalledTimes(1);
  });

  it("502s and surfaces the error when the agent throws", async () => {
    runAgentMock.mockRejectedValue(new Error("Claude 429"));
    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/agent/toxicity/run", {
        method: "POST",
        body: JSON.stringify({ ...baseBody }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "toxicity" } },
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("Claude 429");
  });

  it("accepts an empty referrals array (maintenance run)", async () => {
    runAgentMock.mockResolvedValue({
      ...emptyOutput(),
      daily_report: {
        en: "No new logs; trajectory unchanged.",
        zh: "无新记录，趋势不变。",
      },
    });
    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const res = await POST(
      new Request("http://localhost/api/agent/clinical/run", {
        method: "POST",
        body: JSON.stringify({ ...baseBody, referrals: [] }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "clinical" } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { referral_count: number };
    expect(body.referral_count).toBe(0);
  });
});
