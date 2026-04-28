import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  requireSession,
  type RequireSessionResult,
} from "~/lib/auth/require-session";

export { DEFAULT_AI_MODEL } from "./model";

// Discriminated result so callers can `if ("error" in r) return r.error;`
// without losing the `Anthropic` client type on the success branch.
export type AnthropicGate =
  | { client: Anthropic; error?: undefined }
  | { error: NextResponse; client?: undefined };

// Returns either an Anthropic client or a 503 NextResponse to return directly.
// All Claude-backed routes share this gate so the missing-key error surface
// stays consistent (and tested by api-agent-run.test.ts).
export function getAnthropicClient(): AnthropicGate {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured on the server." },
        { status: 503 },
      ),
    };
  }
  return { client: new Anthropic({ apiKey }) };
}

export type JsonBodyResult<T> =
  | { body: T; error?: undefined }
  | { error: NextResponse; body?: undefined };

// Reads and JSON-parses a Request body, returning a 400 NextResponse on
// failure. The shape `{ error: "Invalid JSON body" }` is asserted by
// api-agent-run.test.ts and must not change.
export async function readJsonBody<T>(req: Request): Promise<JsonBodyResult<T>> {
  try {
    const body = (await req.json()) as T;
    return { body };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }
}

// Wraps a Claude SDK call. On thrown error, returns a 502 with the error
// message. Callers pass the work as a closure so the helper can keep the
// try/catch boilerplate out of every route.
export async function withAnthropicErrorBoundary<T>(
  work: () => Promise<T>,
): Promise<{ value: T; error?: undefined } | { error: NextResponse; value?: undefined }> {
  try {
    return { value: await work() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: NextResponse.json({ error: message }, { status: 502 }),
    };
  }
}

export interface ClaudeRouteContext<TBody> {
  body: TBody;
  client: Anthropic;
  session: RequireSessionResult;
  req: Request;
}

// Composes the three gates every Claude-backed route runs: requireSession()
// (401 / 503), getAnthropicClient() (503), readJsonBody() (400). The handler
// receives the parsed body, an authenticated client, and the session — no
// try/catch, no early-return ladder. Validation of body shape stays inside
// the handler since each route has different requirements.
export function createClaudeRoute<TBody>(
  handler: (ctx: ClaudeRouteContext<TBody>) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const auth = await requireSession();
    if (!auth.ok) return auth.error;

    const gate = getAnthropicClient();
    if (gate.error) return gate.error;

    const parsed = await readJsonBody<TBody>(req);
    if (parsed.error) return parsed.error;

    return handler({
      body: parsed.body,
      client: gate.client,
      session: auth.session,
      req,
    });
  };
}
