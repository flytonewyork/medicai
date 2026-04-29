import { NextResponse } from "next/server";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import { getSupabaseServer } from "~/lib/supabase/server";
import { loadHouseholdProfile } from "~/lib/household/profile";
import { wrapUserInput } from "~/lib/anthropic/wrap-user-input";
import {
  VoiceMemoParseSchema,
  buildVoiceMemoParseSystem,
} from "~/lib/voice-memo/parse-schema";

// Structured-fields extractor for a voice-memo transcript. Whisper
// already produced the text; this route asks Claude which daily-form
// fields the memo verbalises (energy, sleep, pain, neuropathy, etc.)
// PLUS clinic visits, future appointments, medications mentioned, and
// non-clinical personal content. The client merges the daily fields
// into `daily_entries` as a safe fill (preview-then-confirm); the
// other categories drive `life_events` / `appointments` patches via
// the apply step.
//
// Why messages.create + manual JSON.parse + Zod, not messages.parse?
// Anthropic's structured-output endpoint caps optional parameters at
// 24 and union-typed parameters at 16 across the entire tree. Our
// surface is broad enough that even .nullable() (= union with null)
// across every field blows past both caps. messages.create has no
// such limits — we ask for JSON in the prompt, strip any markdown
// fences, JSON.parse, and validate with the same Zod schema that
// would have driven structured output. The client never has to know
// the route changed shape.
//
// Auth: not required. Voice memos are foundational and the project is
// local-first (per middleware.ts and CLAUDE.md). When a Supabase
// session is present we use it to fetch the household profile so the
// system prompt is interpolated against the right patient identity;
// when it's not, we fall back to FALLBACK_HOUSEHOLD_PROFILE which is
// generic but still produces a useful parse.

export const runtime = "nodejs";
export const maxDuration = 30;

interface ParseBody {
  transcript: string;
  locale?: "en" | "zh";
  recorded_at?: string;
  model?: string;
}

export async function POST(req: Request) {
  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsedBody = await readJsonBody<ParseBody>(req);
  if (parsedBody.error) return parsedBody.error;
  const body = parsedBody.body;

  if (!body?.transcript?.trim()) {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  let householdId: string | null = null;
  try {
    const sb = getSupabaseServer();
    if (sb) {
      const { data } = await sb.auth.getUser();
      if (data?.user) {
        const { data: membership } = await sb
          .from("household_memberships")
          .select("household_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        householdId = (membership?.household_id as string | undefined) ?? null;
      }
    }
  } catch {
    // unauthenticated or schema mismatch — use the fallback profile
  }
  const profile = await loadHouseholdProfile(householdId);
  const localeNote =
    body.locale === "zh"
      ? "The transcript is Mandarin. Translate before extracting."
      : "";
  const recordedHint = body.recorded_at
    ? `The memo was recorded at ${body.recorded_at}.`
    : "";

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.create({
      model: body.model ?? DEFAULT_AI_MODEL,
      // Generous budget — the expanded schema (daily fields + clinic
      // visit + appointments + medications + personal block) can
      // legitimately produce ~1k tokens for a rich memo. Truncation
      // here surfaces as invalid JSON downstream.
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: [
            buildVoiceMemoParseSystem(profile),
            localeNote,
            recordedHint,
            JSON_OUTPUT_INSTRUCTIONS,
          ]
            .filter(Boolean)
            .join("\n\n"),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: wrapUserInput(
                "Extract a structured picture of this voice-memo transcript.",
                body.transcript,
              ),
            },
          ],
        },
      ],
    }),
  );
  if (result.error) return result.error;

  const text = collectTextBlocks(result.value);
  if (!text.trim()) {
    return NextResponse.json({ error: "Empty model response" }, { status: 502 });
  }

  const json = extractJsonObject(text);
  if (!json) {
    return NextResponse.json(
      {
        error:
          "Model did not return JSON. First 200 chars: " +
          text.slice(0, 200).replace(/\s+/g, " "),
      },
      { status: 502 },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Model response was not valid JSON: " +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 502 },
    );
  }

  const safe = VoiceMemoParseSchema.safeParse(parsedJson);
  if (!safe.success) {
    // Surface the first issue path so the patient sees an actionable
    // hint when Claude returns the wrong shape (e.g. an enum it
    // invented). Suite logs the full issue list.
    // eslint-disable-next-line no-console
    console.warn("[parse-voice-memo] zod validation failed", safe.error.issues);
    const first = safe.error.issues[0];
    const summary = first
      ? `${first.path.join(".")}: ${first.message}`
      : "schema mismatch";
    return NextResponse.json(
      { error: `Model returned the wrong shape (${summary})` },
      { status: 502 },
    );
  }

  return NextResponse.json({ parsed: safe.data });
}

const JSON_OUTPUT_INSTRUCTIONS = [
  "Output rules — STRICT:",
  "- Respond with ONE JSON object only. No commentary, no markdown fences, no leading or trailing prose.",
  '- The first character of your reply MUST be "{" and the last must be "}". Nothing else.',
  "- Use null (or [] for list fields) when the memo doesn't carry a signal — do not omit the key, do not invent values.",
  "- Strings stay in the transcript's source language for free-text fields; numerics and enums are language-neutral.",
].join("\n");

function collectTextBlocks(message: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Pull the first { ... } object out of a model response. Tolerates
// markdown fences (```json … ```), leading prose ("Here is the
// extracted JSON:"), and balanced braces inside string literals
// (handled via a tiny brace-counting scanner that respects \" escapes
// inside strings). Returns null when no balanced object is found.
function extractJsonObject(text: string): string | null {
  // Strip ```json … ``` or ``` … ``` fences, leaving the inner body.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenceMatch ? fenceMatch[1]! : text;

  const start = body.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return body.slice(start, i + 1);
      }
    }
  }
  return null;
}
