import { NextResponse } from "next/server";
import { z } from "zod";
import { parsedAppointmentSchema } from "~/lib/appointments/schema";

// Server-side vision/text parser for appointment letters, cards, and
// pasted emails. Accepts either an image (data URL or https URL) or a
// text body; returns a ParsedAppointment that the /schedule/new form
// uses as `initial`. No Dexie writes happen here — the client decides
// whether to accept the parse.

export const runtime = "nodejs";

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
- kind: one of "clinic" (oncology/specialist consult), "chemo" (infusion visit), "scan" (CT/MRI/PET), "blood_test" (pathology/phlebotomy), "procedure" (line/port/biopsy etc.), or "other"
- title: short human label, e.g. "Cycle 3 consult with Dr Lee"
- starts_at: ISO 8601 including timezone offset if known; if only a date is shown, set all_day=true and use T00:00:00+10:00 (Melbourne) as a fallback
- ends_at: optional
- all_day: true when no specific time is given
- location: free-text; include site + level/room if present
- doctor: named clinician if identifiable
- phone: contact number if shown
- notes: anything else explicit on the page/email (what to bring, fasting, pre-med etc.). Do NOT invent prep instructions.
- confidence: "high" if all core fields are explicit; "medium" if you had to reconcile ambiguity; "low" if you're guessing
- ambiguities: short bulleted list of what you were unsure about

Return nothing for fields you can't see. Never fabricate. If the input clearly isn't an appointment, still return an object but with confidence "low" and title="Unable to parse".`;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured on the server. Set it in Vercel env.",
      },
      { status: 503 },
    );
  }

  const [{ default: Anthropic }, { jsonOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("~/lib/anthropic/json-output"),
  ]);
  const client = new Anthropic({ apiKey });

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
    const response = await client.messages.parse({
      model: process.env.ANTHROPIC_LOG_MODEL || "claude-opus-4-7",
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
