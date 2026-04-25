import { NextResponse } from "next/server";
import {
  COACH_SYSTEM,
  type CoachContext,
  type CoachMessage,
} from "~/lib/ai/coach";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import type { Locale } from "~/types/clinical";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  model?: string;
  context: CoachContext;
  history: CoachMessage[];
  locale?: Locale;
}

export async function POST(req: Request) {
  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsed = await readJsonBody<RequestBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!body?.context || !Array.isArray(body?.history)) {
    return NextResponse.json(
      { error: "context and history[] required" },
      { status: 400 },
    );
  }

  const { model = DEFAULT_AI_MODEL, context, history, locale = "en" } = body;
  const contextBlock = `Current step: ${context.stepTitle}\nKey: ${context.stepKey}\nInstructions shown to the user:\n${context.stepInstructions}\n\nRespond in ${locale === "zh" ? "Simplified Chinese (简体中文)" : "English"}.`;

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.create({
      model,
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: COACH_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: contextBlock },
      ],
      messages: history.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
    }),
  );
  if (result.error) return result.error;

  const block = result.value.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return NextResponse.json(
      { error: "Empty response from coach" },
      { status: 502 },
    );
  }
  return NextResponse.json({ reply: block.text });
}
