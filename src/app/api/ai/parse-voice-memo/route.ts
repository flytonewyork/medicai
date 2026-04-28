import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import { requireSession } from "~/lib/auth/require-session";
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

export const runtime = "nodejs";
export const maxDuration = 30;

interface ParseBody {
  transcript: string;
  locale?: "en" | "zh";
  recorded_at?: string;
  model?: string;
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.error;

  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsed = await readJsonBody<ParseBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!body?.transcript?.trim()) {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  const profile = await loadHouseholdProfile(auth.session.household_id);
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
      max_tokens: 800,
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
