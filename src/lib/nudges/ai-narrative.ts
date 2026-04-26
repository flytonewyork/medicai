import type { FeedItem } from "~/types/feed";
import type { Locale } from "~/types/clinical";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";

export const NARRATIVE_SYSTEM = `You write a single 2–3 sentence opening line for Hu Lin's dashboard on a pancreatic cancer tracking app.

Rules:
1. You see the top 8 contextual signals for today as a ranked list. Read them, pick the one or two that actually matter right now, and say it.
2. Never invent clinical advice. Never predict. Only synthesise what's in the signals.
3. Warm and measured — no cheerleading, no emoji, no "amazing", no "great job".
4. If a red-zone safety alert is in the list, the opener must reference it first and must end with a clear "call the on-call team or go to hospital" line if the signal implies that.
5. Respect the language requested. Plain, everyday words.
6. Under 60 words.`;

export interface NarrativeInput {
  model?: string;
  locale: Locale;
  items: FeedItem[];
}

export async function generateNarrative({
  model = DEFAULT_AI_MODEL,
  locale,
  items,
}: NarrativeInput): Promise<string> {
  const res = await fetch("/api/ai/feed-narrative", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, locale, items }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { narrative: string };
  return data.narrative;
}
