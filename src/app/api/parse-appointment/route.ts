import { NextResponse } from "next/server";
import { z } from "zod";
import { parsedAppointmentSchema } from "~/lib/appointments/schema";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
} from "~/lib/anthropic/route-helpers";

// Server-side vision/text parser for appointment letters, cards, and
// pasted emails. Accepts either an image (data URL or https URL) or a
// text body; returns a ParsedAppointment that the /schedule/new form
// uses as `initial`. No Dexie writes happen here — the client decides
// whether to accept the parse.

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  text: z.string().optional(),
  imageBase64: z.string().optional(),
  imageMediaType: z
    .enum(["image/jpeg", "image/png", "image/gif", "image/webp"])
    .optional(),
  locale: z.enum(["en", "zh"]).default("en"),
  // Today's date in the patient's timezone so the parser can resolve
  // relative references like "next Tuesday 2pm" without hallucinating
  // a year.
  today: z.string(),
});

const SYSTEM_PROMPT = `You are a careful medical-appointment parser for a patient-tracking app. Given a photo of an appointment letter/card or a pasted email body, extract exactly one appointment.

Fields:
- kind: one of "clinic" (oncology/specialist consult), "chemo" (infusion visit), "scan" (CT/MRI/PET), "blood_test" (pathology/phlebotomy), "procedure" (line/port/biopsy incl. admission for a procedure), or "other"
- title: short human label, e.g. "Cycle 3 consult with Dr Lee" or "Admission — Epworth Freemasons"
- starts_at: ISO 8601 including timezone offset if known; resolve the year using the supplied "Today's date" (a date in the near past/future in the same calendar year unless the source says otherwise). Default timezone is +10:00 (Melbourne) when none is shown. If only a date is shown, set all_day=true and use T00:00:00+10:00.
- ends_at: optional
- all_day: true when no specific time is given
- location: free-text; include site + street address + level/room if present. Combine address lines into a single string (e.g. "Epworth Freemasons Hospital, 109 Albert Street, East Melbourne").
- doctor: named clinician if identifiable
- phone: contact number if shown
- notes: anything explicit that doesn't fit a structured field below — e.g. signer's name, reference numbers, reply-with-questions context. Do NOT duplicate prep instructions here.
- prep: an array of structured preparation items. Extract one entry per distinct instruction. Pick the tightest matching kind:
  - "fast" for food/fluids cut-offs ("no food from 7am", "nil by mouth 6h before"). Put the absolute cut-off time in starts_at when the source gives a clock time ("7am" → today's date + 07:00 local); use hours_before when only a relative window is given ("fast for 6 hours before").
  - "medication_hold" for stop-a-medication instructions
  - "medication_take" for take-something instructions (including contrast drinks)
  - "arrive_early" for "arrive 30 minutes before" style
  - "bring" for items to bring (overnight bag, photo ID, referral letter, recent scans, list of medications)
  - "sample" for provide-a-sample-on-the-day
  - "transport" for no-driving-after warnings
  - "companion" for accompanying-adult requirements
  - "consent" for consent-form tasks
  - "pre_scan_contrast" for oral/IV contrast pre-scan specifically
  - "other" when nothing fits
  The description should be one short human line in the source's own words ("No food from 7am", "Bring an overnight bag"). Return [] when the source has no prep instructions. Never invent prep that isn't in the source.
- confidence: "high" if all core fields are explicit; "medium" if you had to reconcile ambiguity; "low" if you're guessing
- ambiguities: short bulleted list of what you were unsure about

Return nothing for fields you can't see. Never fabricate. If the input clearly isn't an appointment, still return an object but with confidence "low" and title="Unable to parse".`;

export async function POST(req: Request) {
  const json = await readJsonBody<unknown>(req);
  if (json.error) return json.error;

  const parsed = RequestSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { text, imageBase64, imageMediaType, locale, today } = parsed.data;
  if (!text && !imageBase64) {
    return NextResponse.json(
      { error: "Provide text or imageBase64" },
      { status: 400 },
    );
  }

  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const { jsonOutputFormat } = await import("~/lib/anthropic/json-output");

  const userContent: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: {
          type: "base64";
          media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          data: string;
        };
      }
  > = [];
  if (imageBase64 && imageMediaType) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType,
        data: stripDataUrlPrefix(imageBase64),
      },
    });
  }
  userContent.push({
    type: "text",
    text: [
      `Patient locale: ${locale}.`,
      `Today's date: ${today}.`,
      text?.trim() ? `Pasted text:\n\n---\n${text}\n---` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  try {
    const response = await gate.client.messages.parse({
      model: process.env.ANTHROPIC_LOG_MODEL || DEFAULT_AI_MODEL,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: jsonOutputFormat(parsedAppointmentSchema) },
      messages: [{ role: "user", content: userContent }],
    });
    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "Parser returned no output" },
        { status: 502 },
      );
    }
    return NextResponse.json({ appointment: response.parsed_output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Parse failed", message },
      { status: 502 },
    );
  }
}

function stripDataUrlPrefix(b64: string): string {
  const marker = "base64,";
  const idx = b64.indexOf(marker);
  return idx >= 0 ? b64.slice(idx + marker.length) : b64;
}
