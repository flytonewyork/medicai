import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentOutput } from "~/types/agent";
import type { RunAgentArgs } from "~/agents/run";

// Mock runAgent before importing the route so the route binds to the mock.
const runAgentMock = vi.fn<[RunAgentArgs], Promise<AgentOutput>>();

vi.mock("~/agents/run", () => ({
  runAgent: (args: RunAgentArgs) => runAgentMock(args),
  selectReferralsForAgent: () => [],
}));

// Phase 1.1 added a session gate to /api/agent/[id]/run. Stub the
// supabase server client so requireSession() resolves to a fake user
// without needing a live Supabase. The chain helper supports the
// shapes both the membership lookup (`.eq().limit().maybeSingle()`)
// and the household-profile lookup (`.eq().maybeSingle()`) use.
vi.mock("~/lib/supabase/server", () => {
  const fakeUser = { id: "test-user-id", email: "test@example.com" };
  function makeChain(payload: unknown): unknown {
    const result = Promise.resolve({ data: payload, error: null });
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = () => result;
    chain.single = () => result;
    chain.then = (resolve: (v: unknown) => unknown) => result.then(resolve);
    return chain;
  }
  return {
    getSupabaseServer: () => ({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: fakeUser }, error: null }),
      },
      from: (table: string) => {
        if (table === "household_memberships") {
          return makeChain({ household_id: "test-household-id" });
        }
        if (table === "household_profile") {
          return makeChain(null);
        }
        return makeChain(null);
      },
    }),
  };
});

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
  recent_feedback: [],
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

  it("threads recent_feedback through to runAgent (dial-in loop)", async () => {
    runAgentMock.mockResolvedValue({
      ...emptyOutput(),
      daily_report: { en: "ack", zh: "" },
    });
    const { POST } = await import("~/app/api/agent/[id]/run/route");
    const feedback = [
      {
        id: 7,
        agent_id: "nutrition",
        run_id: 12,
        kind: "correction",
        by: "thomas",
        notes:
          "You over-flagged weight loss yesterday — Hu Lin had been on a fast for a procedure.",
        at: "2026-04-21T22:00:00Z",
      },
    ];
    const res = await POST(
      new Request("http://localhost/api/agent/nutrition/run", {
        method: "POST",
        body: JSON.stringify({ ...baseBody, recent_feedback: feedback }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "nutrition" } },
    );
    expect(res.status).toBe(200);
    expect(runAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recentFeedback: expect.arrayContaining([
          expect.objectContaining({
            kind: "correction",
            by: "thomas",
            notes: expect.stringMatching(/over-flagged/),
          }),
        ]),
      }),
    );
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
