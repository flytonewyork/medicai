import { NextResponse } from "next/server";
import { NARRATIVE_SYSTEM } from "~/lib/nudges/ai-narrative";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import type { FeedItem } from "~/types/feed";
import type { Locale } from "~/types/clinical";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  locale: Locale;
  items: FeedItem[];
  model?: string;
}

export async function POST(req: Request) {
  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsed = await readJsonBody<RequestBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: "items[] required" }, { status: 400 });
  }

  const { locale = "en", items, model = DEFAULT_AI_MODEL } = body;
  const signals = items
    .slice(0, 8)
    .map((item, i) => {
      const title = item.title[locale] ?? item.title.en;
      const bodyText = item.body[locale] ?? item.body.en;
      return `${i + 1}. [${item.category}/${item.tone}] ${title} — ${bodyText}`;
    })
    .join("\n");

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.create({
      model,
      max_tokens: 300,
      system: [
        {
          type: "text",
          text: NARRATIVE_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Signals for today (language = ${locale === "zh" ? "Simplified Chinese" : "English"}):\n\n${signals}\n\nWrite the opener.`,
            },
          ],
        },
      ],
    }),
  );
  if (result.error) return result.error;

  const block = result.value.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return NextResponse.json(
      { error: "No narrative returned" },
      { status: 502 },
    );
  }
  return NextResponse.json({ narrative: block.text.trim() });
}
