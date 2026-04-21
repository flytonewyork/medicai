"use client";

import type { FeedItem } from "~/types/feed";
import type { Locale } from "~/types/clinical";

const SYSTEM = `You write a single 2–3 sentence opening line for Hu Lin's dashboard on a pancreatic cancer tracking app.

Rules:
1. You see the top 8 contextual signals for today as a ranked list. Read them, pick the one or two that actually matter right now, and say it.
2. Never invent clinical advice. Never predict. Only synthesise what's in the signals.
3. Warm and measured — no cheerleading, no emoji, no "amazing", no "great job".
4. If a red-zone safety alert is in the list, the opener must reference it first and must end with a clear "call the on-call team or go to hospital" line if the signal implies that.
5. Respect the language requested. Plain, everyday words.
6. Under 60 words.`;

export interface NarrativeInput {
  apiKey: string;
  model?: string;
  locale: Locale;
  items: FeedItem[];
}

export async function generateNarrative({
  apiKey,
  model = "claude-opus-4-7",
  locale,
  items,
}: NarrativeInput): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const signals = items
    .slice(0, 8)
    .map((item, i) => {
      const title = item.title[locale] ?? item.title.en;
      const body = item.body[locale] ?? item.body.en;
      return `${i + 1}. [${item.category}/${item.tone}] ${title} — ${body}`;
    })
    .join("\n");

  const response = await client.messages.create({
    model,
    max_tokens: 300,
    system: [
      {
        type: "text",
        text: SYSTEM,
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
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No narrative returned");
  }
  return block.text.trim();
}
