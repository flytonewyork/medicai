"use client";

import type { PreparedImage } from "~/lib/ingest/image";
import type { ParsedMealResult } from "./parser-schema";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";
import { postJson } from "~/lib/utils/http";

// Client-side shims around the /api/ai/parse-meal route. The route holds
// the server-side ANTHROPIC_API_KEY; the parsers below are the only thing
// the UI imports.

export async function parseMealPhoto({
  image,
  model = DEFAULT_AI_MODEL,
  locale = "en",
}: {
  image: PreparedImage;
  model?: string;
  locale?: "en" | "zh";
}): Promise<ParsedMealResult> {
  const data = await postJson<{ result: ParsedMealResult }>(
    "/api/ai/parse-meal",
    { kind: "photo", image, model, locale },
  );
  return data.result;
}

export async function parseMealText({
  text,
  model = DEFAULT_AI_MODEL,
  locale = "en",
}: {
  text: string;
  model?: string;
  locale?: "en" | "zh";
}): Promise<ParsedMealResult> {
  const data = await postJson<{ result: ParsedMealResult }>(
    "/api/ai/parse-meal",
    { kind: "text", text, model, locale },
  );
  return data.result;
}
