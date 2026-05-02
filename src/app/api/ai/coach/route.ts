import { NextResponse } from "next/server";
import {
  buildCoachSystem,
  type CoachContext,
  type CoachMessage,
} from "~/lib/ai/coach";
import {
  DEFAULT_AI_MODEL,
  firstTextBlock,
  gateAiRequest,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import { loadHouseholdProfile } from "~/lib/household/profile";
import { wrapUserInputBlock } from "~/lib/anthropic/wrap-user-input";
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
  const ctx = await gateAiRequest<RequestBody>(req);
  if (ctx.error) return ctx.error;

  if (!ctx.body?.context || !Array.isArray(ctx.body?.history)) {
    return NextResponse.json(
      { error: "context and history[] required" },
      { status: 400 },
    );
  }

  const { model = DEFAULT_AI_MODEL, context, history, locale = "en" } = ctx.body;
  const profile = await loadHouseholdProfile(ctx.session.household_id);
  const contextBlock = `Current step: ${context.stepTitle}\nKey: ${context.stepKey}\nInstructions shown to the user:\n${context.stepInstructions}\n\nRespond in ${locale === "zh" ? "Simplified Chinese (简体中文)" : "English"}.`;

  const result = await withAnthropicErrorBoundary(() =>
    ctx.client.messages.create({
      model,
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: buildCoachSystem(profile),
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: contextBlock },
      ],
      messages: history.map((m) => ({
        role: m.role,
        content: [
          { type: "text", text: wrapUserInputBlock(m.content) },
        ],
      })),
    }),
  );
  if (result.error) return result.error;

  const text = firstTextBlock(result.value, "Empty response from coach");
  if (text.error) return text.error;
  return NextResponse.json({ reply: text.text });
}
