import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Phase 1.1 acceptance: AI / agent routes that depend on a household
// context reject unauthenticated callers with a 401. The cron and
// push routes have their own auth surface (CRON_SECRET, push
// session) and aren't covered here.
//
// Local-first exceptions — these AI routes intentionally do NOT
// require auth (per middleware.ts: "anyone can use it without an
// account") and are excluded from the list below:
//   /api/ai/transcribe          (voice-memo recording)
//   /api/ai/parse-voice-memo    (voice-memo structured extraction)
//   /api/ai/parse-meal          (meal-ingest + voice-memo macro fill)
//   /api/ai/ingest-universal    (clinical document ingest)

// We mock the supabase server client so requireSession() can resolve
// without a live Supabase. When the client returns `data.user = null`,
// requireSession() must short-circuit with a 401 NextResponse.
const getUserMock = vi.fn();
const fromMock = vi.fn();
const supabaseClientMock = {
  auth: { getUser: getUserMock },
  from: fromMock,
};

vi.mock("~/lib/supabase/server", () => ({
  getSupabaseServer: () => supabaseClientMock,
}));

// runAgent is mocked away — the agent-run route still needs auth even
// when the agent itself wouldn't be exercised.
vi.mock("~/agents/run", () => ({
  runAgent: vi.fn(),
  selectReferralsForAgent: () => [],
}));

interface RouteCase {
  path: string;
  module: string;
  body: Record<string, unknown>;
  params?: Record<string, string>;
}

const ROUTES: RouteCase[] = [
  { path: "/api/ai/coach", module: "~/app/api/ai/coach/route", body: {} },
  { path: "/api/ai/ingest-meal", module: "~/app/api/ai/ingest-meal/route", body: {} },
  { path: "/api/ai/ingest-notes", module: "~/app/api/ai/ingest-notes/route", body: {} },
  { path: "/api/ai/ingest-report", module: "~/app/api/ai/ingest-report/route", body: {} },
  { path: "/api/ai/assessment-summary", module: "~/app/api/ai/assessment-summary/route", body: {} },
  { path: "/api/ai/feed-narrative", module: "~/app/api/ai/feed-narrative/route", body: {} },
  { path: "/api/parse-appointment", module: "~/app/api/parse-appointment/route", body: { today: "2026-04-26" } },
  { path: "/api/ingest-ics", module: "~/app/api/ingest-ics/route", body: {} },
];

const AGENT_ROUTE = {
  path: "/api/agent/nutrition/run",
  module: "~/app/api/agent/[id]/run/route",
  body: {
    referrals: [],
    state_md: "",
    recent_feedback: [],
    locale: "en",
    date: "2026-04-26",
    trigger: "on_demand",
  },
  params: { id: "nutrition" },
};

function makeRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API routes reject unauthenticated callers", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    getUserMock.mockReset();
    fromMock.mockReset();
    // Auth gate sees no user → requireSession() must 401.
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
        }),
      }),
    });
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  for (const route of ROUTES) {
    it(`${route.path} → 401 without a session`, async () => {
      const mod = (await import(route.module)) as {
        POST: (req: Request) => Promise<Response>;
      };
      const res = await mod.POST(makeRequest(route.path, route.body));
      expect(res.status).toBe(401);
    });
  }

  it(`${AGENT_ROUTE.path} → 401 without a session`, async () => {
    const mod = (await import(AGENT_ROUTE.module)) as {
      POST: (
        req: Request,
        ctx: { params: { id: string } },
      ) => Promise<Response>;
    };
    const res = await mod.POST(makeRequest(AGENT_ROUTE.path, AGENT_ROUTE.body), {
      params: { id: AGENT_ROUTE.params.id },
    });
    expect(res.status).toBe(401);
  });
});
