import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  COACH_SYSTEM,
  type CoachContext,
  type CoachMessage,
} from "~/lib/ai/coach";
import type { Locale } from "~/types/clinical";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  model?: string;
  context: CoachContext;
  history: CoachMessage[];
  locale?: Locale;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.context || !Array.isArray(body?.history)) {
    return NextResponse.json(
      { error: "context and history[] required" },
      { status: 400 },
    );
  }

  const { model = "claude-opus-4-7", context, history, locale = "en" } = body;
  const contextBlock = `Current step: ${context.stepTitle}\nKey: ${context.stepKey}\nInstructions shown to the user:\n${context.stepInstructions}\n\nRespond in ${locale === "zh" ? "Simplified Chinese (简体中文)" : "English"}.`;

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
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
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "Empty response from coach" },
        { status: 502 },
      );
    }
    return NextResponse.json({ reply: block.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
