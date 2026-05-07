import { NextResponse } from "next/server";
import {
  DEFAULT_AI_MODEL,
  gateAiRequest,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import {
  getOptionalHouseholdId,
  loadHouseholdProfile,
} from "~/lib/household/profile";
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
  // Slice 9: optional category hint from /log's wizard chips. When
  // the patient picked "Symptom" before recording, we tell Claude to
  // focus extraction on the daily-tracking + clinic_visit sections
  // and leave the rest null. Cleaner parse than free-form because
  // Claude isn't scanning for everything at once.
  category?:
    | "symptom"
    | "nutrition"
    | "visit_treatment"
    | "test_result"
    | "appointment";
}

export async function POST(req: Request) {
  const ctx = await gateAiRequest<ParseBody>(req, { requireAuth: false });
  if (ctx.error) return ctx.error;
  const body = ctx.body;

  if (!body?.transcript?.trim()) {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  const profile = await loadHouseholdProfile(await getOptionalHouseholdId());
  const localeNote =
    body.locale === "zh"
      ? "The transcript is Mandarin. Translate before extracting."
      : "";
  const recordedHint = body.recorded_at
    ? `The memo was recorded at ${body.recorded_at}.`
    : "";
  const categoryHint = body.category
    ? buildCategoryFocus(body.category)
    : "";

  const result = await withAnthropicErrorBoundary(() =>
    ctx.client.messages.create({
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
            categoryHint,
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

// Slice 9: targeted prompt that matches the wizard chip the patient
// picked on /log. The category narrows Claude's attention so the
// extraction is reliable: a "Symptom" memo doesn't need to be
// scanned for clinic-visit summaries; a "Test result" memo doesn't
// need a daily-form sweep. Other sections still get extracted when
// the patient mentions them in passing — the hint is a guide, not a
// gate.
function buildCategoryFocus(
  category: NonNullable<ParseBody["category"]>,
): string {
  const lines: string[] = [
    "CATEGORY HINT — the patient picked a category before recording. Focus your extraction on the matching schema sections; leave unrelated ones null. The patient may still mention other things in passing — capture those too, but don't over-search.",
  ];
  switch (category) {
    case "symptom":
      lines.push(
        "Picked: Symptom. Prioritise the daily-tracking 0–10 numerics (pain_current, pain_worst, nausea, fatigue, anorexia, abdominal_pain, energy, sleep_quality, mood_clarity, appetite), the CTCAE neuropathy grades, and the symptom booleans (cold_dysaesthesia, mouth_sores, fever). \`notes\` for clinical addenda. Skip clinic_visit / appointments_mentioned / nutrition unless the patient explicitly mentions them.",
      );
      break;
    case "nutrition":
      lines.push(
        "Picked: Food/Fluid. Prioritise the nutrition block (meals + fluids). Estimate grams / ml when defensible. Skip clinic_visit / appointments_mentioned / imaging_results / lab_results unless mentioned in passing.",
      );
      break;
    case "visit_treatment":
      lines.push(
        "Picked: Visit/Treatment. Prioritise clinic_visit (set kind to chemo / scan / blood_test / procedure / clinic / ed accordingly). Imaging or lab results that came up during the visit go in their own structured fields. Skip future appointments_mentioned unless the patient explicitly says something is scheduled.",
      );
      break;
    case "test_result":
      lines.push(
        "Picked: Test result. Prioritise imaging_results (modality, finding_summary, status) for scans, and lab_results (name, value, status) for blood-tests. Both can apply when the patient is describing a panel of results. Skip clinic_visit unless the patient is also recapping the visit where the result was discussed.",
      );
      break;
    case "appointment":
      lines.push(
        "Picked: Future appointment. Prioritise appointments_mentioned (title + starts_at + prep + kind + confidence). Set confidence: high only when both date and title are concrete. Skip clinic_visit (that's for past encounters).",
      );
      break;
  }
  return lines.join("\n");
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
