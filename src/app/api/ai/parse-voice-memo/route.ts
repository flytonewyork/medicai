import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
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
// and returns them in a Zod-validated shape. The client merges them
// into the day's `daily_entries` row as a safe fill — never an
// overwrite — so the diary turns voice memos into structured tracking
// without the patient having to open the daily form.
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

  const parsed = await readJsonBody<ParseBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!body?.transcript?.trim()) {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  // Best-effort household lookup — load the patient identity envelope
  // when a Supabase session happens to be present, fall back to the
  // generic profile when it isn't. Never block the parse on this.
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
    gate.client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
      // Generous budget — the expanded schema (daily fields + clinic
      // visit + appointments + medications + personal block) can
      // legitimately produce ~1k tokens for a rich memo. Truncation
      // here surfaces as a silent structured-output failure.
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: [buildVoiceMemoParseSystem(profile), localeNote, recordedHint]
            .filter(Boolean)
            .join("\n\n"),
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: jsonOutputFormat(VoiceMemoParseSchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: wrapUserInput(
                "Extract structured daily-tracking fields from the voice-memo transcript.",
                body.transcript,
              ),
            },
          ],
        },
      ],
    }),
  );
  if (result.error) return result.error;

  if (!result.value.parsed_output) {
    return NextResponse.json(
      { error: "No parse returned" },
      { status: 502 },
    );
  }

  return NextResponse.json({ parsed: result.value.parsed_output });
}
