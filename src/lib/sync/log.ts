/* eslint-disable no-console */
// Centralized warn-level logger for the sync + bootstrap subsystems.
// Wrapping `console.warn` once means swapping in a structured logger
// later is a single edit, not nine, and keeps `no-console` disables
// off the call sites. The whole point of this file is to wrap
// console, hence the per-file disable.

export type SyncLogTag = "sync" | "bootstrap";

export function logSyncWarn(
  tag: SyncLogTag,
  context: string,
  err?: unknown,
): void {
  const prefix = `[${tag}] ${context}`;
  if (err === undefined) console.warn(prefix);
  else console.warn(`${prefix}:`, err);
}
