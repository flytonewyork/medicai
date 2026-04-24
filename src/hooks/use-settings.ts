"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import type { Settings } from "~/types/clinical";

// Settings is a single-row table. Every consumer was duplicating
// `useLiveQuery(() => db.settings.toArray())` and then pulling `[0]`.
// Returning `undefined` while the query is loading is preserved.
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.toArray().then((r) => r[0]));
}
