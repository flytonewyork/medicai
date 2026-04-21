"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import type { Settings } from "~/types/clinical";

// Reactively read the single Settings row the app uses (Anchor is
// single-patient). Returns `undefined` while Dexie is still loading and after
// load when no Settings row exists yet (pre-onboarding). Consumers should
// treat `undefined` as "not ready / no settings".
export function useSettings(): Settings | undefined {
  const rows = useLiveQuery(() => db.settings.toArray());
  return rows?.[0];
}
