import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { NARRATIVE_SYSTEM } from "~/lib/nudges/ai-narrative";
import type { FeedItem } from "~/types/feed";
import type { Locale } from "~/types/clinical";

export const runtime = "nodejs";

interface RequestBody {
  locale: Locale;
  items: FeedItem[];
  model?: string;
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
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: "items[] required" }, { status: 400 });
  }

  const { locale = "en", items, model = "claude-opus-4-7" } = body;
  const signals = items
    .slice(0, 8)
    .map((item, i) => {
      const title = item.title[locale] ?? item.title.en;
      const bodyText = item.body[locale] ?? item.body.en;
      return `${i + 1}. [${item.category}/${item.tone}] ${title} — ${bodyText}`;
    })
    .join("\n");

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
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
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "No narrative returned" },
        { status: 502 },
      );
    }
    return NextResponse.json({ narrative: block.text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
