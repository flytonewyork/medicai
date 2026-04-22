import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentId, AgentOutput, LogInput } from "~/types/agent";

// Mock runAgent before importing the route so the route captures the mock.
type RunAgentArgs = {
  id: AgentId;
  input: LogInput;
  stateMd: string;
};

const runAgentMock = vi.fn<[RunAgentArgs], Promise<AgentOutput>>();

vi.mock("~/agents/run", () => ({
  runAgent: (args: RunAgentArgs) => runAgentMock(args),
}));

function emptyOutput(): AgentOutput {
  return {
    safety_flags: [],
    filings: [],
    questions: [],
    nudges: [],
    state_diff: "",
  };
}

describe("/api/log route", () => {
  beforeEach(() => {
    runAgentMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("rejects malformed JSON with 400", async () => {
    const { POST } = await import("~/app/api/log/route");
    const res = await POST(
      new Request("http://localhost/api/log", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("routes a diet log to the nutrition agent only", async () => {
    runAgentMock.mockResolvedValue({
      ...emptyOutput(),
      filings: [
        {
          table: "daily_entries",
          strategy: "upsert_by_date",
          data: { date: "2026-04-22", protein_grams: 25 },
        },
      ],
      state_diff: "Protein 25 g logged.",
    });

    const { POST } = await import("~/app/api/log/route");
    const res = await POST(
      new Request("http://localhost/api/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: {
            text: "had 25 g protein at breakfast",
            locale: "en",
            at: "2026-04-22T08:00:00Z",
          },
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agent_ids: AgentId[];
      outputs: Partial<Record<AgentId, AgentOutput>>;
      errors: Array<{ id: AgentId; message: string }>;
    };
    expect(body.agent_ids).toEqual(["nutrition"]);
    expect(body.outputs.nutrition?.filings[0]?.data).toMatchObject({
      protein_grams: 25,
    });
    expect(body.errors).toHaveLength(0);
    expect(runAgentMock).toHaveBeenCalledTimes(1);
  });

  it("fans out a compound log to multiple agents in parallel", async () => {
    runAgentMock.mockImplementation(async ({ id }) => ({
      ...emptyOutput(),
      state_diff: `updated ${id}`,
    }));

    const { POST } = await import("~/app/api/log/route");
    const res = await POST(
      new Request("http://localhost/api/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: {
            text: "walked 30 minutes, hands still tingling",
            locale: "en",
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agent_ids: AgentId[];
      outputs: Partial<Record<AgentId, AgentOutput>>;
    };
    // physical → rehabilitation; toxicity → toxicity + clinical
    expect(body.agent_ids.sort()).toEqual(
      ["clinical", "rehabilitation", "toxicity"].sort(),
    );
    expect(Object.keys(body.outputs).sort()).toEqual(
      ["clinical", "rehabilitation", "toxicity"].sort(),
    );
  });

  it("surfaces per-agent failures without failing the whole request", async () => {
    runAgentMock.mockImplementation(async ({ id }) => {
      if (id === "toxicity") throw new Error("Claude 429");
      return { ...emptyOutput(), state_diff: id };
    });

    const { POST } = await import("~/app/api/log/route");
    const res = await POST(
      new Request("http://localhost/api/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text: "hands tingling", locale: "en" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      outputs: Partial<Record<AgentId, AgentOutput>>;
      errors: Array<{ id: AgentId; message: string }>;
    };
    expect(body.outputs.clinical).toBeDefined();
    expect(body.outputs.toxicity).toBeUndefined();
    expect(body.errors).toEqual([
      expect.objectContaining({ id: "toxicity", message: "Claude 429" }),
    ]);
  });

  it("returns 503 when ANTHROPIC_API_KEY is absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await import("~/app/api/log/route");
    const res = await POST(
      new Request("http://localhost/api/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text: "had protein", locale: "en" },
        }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("short-circuits when no agents match (no key needed)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await import("~/app/api/log/route");
    const res = await POST(
      new Request("http://localhost/api/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text: "hello world", locale: "en" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agent_ids: AgentId[] };
    expect(body.agent_ids).toEqual([]);
  });
});
