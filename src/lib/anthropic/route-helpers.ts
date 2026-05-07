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

// Combined preamble for Claude-backed routes: runs requireSession (when
// requireAuth ≠ false), getAnthropicClient, and readJsonBody in that
// order. api-auth.test.ts asserts the auth check fires before the API-key
// check; do not reorder.
//
// `requireAuth: false` opts a route out of the session gate entirely —
// used by the local-first surfaces listed in middleware.ts (parse-meal,
// parse-voice-memo). On those routes `session` is always null and the
// caller is expected to fall back to getOptionalHouseholdId().
export type AiRouteSuccess<T, S extends RequireSessionResult | null> = {
  client: Anthropic;
  body: T;
  session: S;
  error?: undefined;
};
export type AiRouteFailure = {
  error: NextResponse;
  client?: undefined;
  body?: undefined;
  session?: undefined;
};

export function gateAiRequest<T>(
  req: Request,
): Promise<AiRouteSuccess<T, RequireSessionResult> | AiRouteFailure>;
export function gateAiRequest<T>(
  req: Request,
  opts: { requireAuth: false },
): Promise<AiRouteSuccess<T, null> | AiRouteFailure>;
export async function gateAiRequest<T>(
  req: Request,
  opts?: { requireAuth?: boolean },
): Promise<
  | AiRouteSuccess<T, RequireSessionResult>
  | AiRouteSuccess<T, null>
  | AiRouteFailure
> {
  let session: RequireSessionResult | null = null;
  if (opts?.requireAuth !== false) {
    const auth = await requireSession();
    if (!auth.ok) return { error: auth.error };
    session = auth.session;
  }
  const gate = getAnthropicClient();
  if (gate.error) return { error: gate.error };
  const parsed = await readJsonBody<T>(req);
  if (parsed.error) return { error: parsed.error };
  return {
    client: gate.client,
    body: parsed.body,
    session: session as RequireSessionResult,
  };
}

// Extracts the first text block from a messages.create() response. Returns
// a 502 NextResponse when the model returned no text content (rare but
// possible — e.g. when only tool_use blocks are emitted).
export function firstTextBlock(
  message: { content: Array<{ type: string; text?: string }> },
  errorMessage = "Empty response from Claude",
):
  | { text: string; error?: undefined }
  | { error: NextResponse; text?: undefined } {
  const block = message.content.find(
    (b): b is { type: "text"; text: string } =>
      b.type === "text" && typeof b.text === "string",
  );
  if (!block) {
    return {
      error: NextResponse.json({ error: errorMessage }, { status: 502 }),
    };
  }
  return { text: block.text };
}

// Asserts that messages.parse() returned parsed_output. Returns a 502
// NextResponse when the model produced no structured output (e.g. tool
// abort, empty response).
export function requireParsedOutput<T>(
  message: { parsed_output: T | null | undefined },
  errorMessage = "No parsed output returned",
):
  | { value: T; error?: undefined }
  | { error: NextResponse; value?: undefined } {
  if (!message.parsed_output) {
    return {
      error: NextResponse.json({ error: errorMessage }, { status: 502 }),
    };
  }
  return { value: message.parsed_output };
}
