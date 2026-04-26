"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";
import type { Settings } from "~/types/clinical";

// Single canonical hook for the singleton Settings row. Replaces the
// ~20 callsites that did `useLiveQuery(() => db.settings.toArray())` and
// then took `[0]`. Returns `undefined` while Dexie is loading and
// `null` once we know the row doesn't exist yet (pre-onboarding).
export function useSettings(): Settings | null | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.toCollection().first();
    return row ?? null;
  });
}

// Convenience helper: the configured default Claude model, falling back
// to the global default when settings isn't loaded yet or the user
// hasn't overridden it.
export function useDefaultAiModel(): string {
  const settings = useSettings();
  return settings?.default_ai_model ?? DEFAULT_AI_MODEL;
}
