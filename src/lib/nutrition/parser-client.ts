"use client";

import type { PreparedImage } from "~/lib/ingest/image";
import type { ParsedMealResult } from "./parser-schema";

// Client-side shims around the /api/ai/parse-meal route. The route holds
// the server-side ANTHROPIC_API_KEY; the parsers below are the only thing
// the UI imports.

export async function parseMealPhoto({
  image,
  model = "claude-opus-4-7",
  locale = "en",
}: {
  image: PreparedImage;
  model?: string;
  locale?: "en" | "zh";
}): Promise<ParsedMealResult> {
  const res = await fetch("/api/ai/parse-meal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "photo", image, model, locale }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { result: ParsedMealResult };
  return data.result;
}

export async function parseMealText({
  text,
  model = "claude-opus-4-7",
  locale = "en",
}: {
  text: string;
  model?: string;
  locale?: "en" | "zh";
}): Promise<ParsedMealResult> {
  const res = await fetch("/api/ai/parse-meal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "text", text, model, locale }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { result: ParsedMealResult };
  return data.result;
}
