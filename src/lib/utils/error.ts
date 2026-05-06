// Extract a human-readable message from an `unknown` thrown value. Centralised
// so the `err instanceof Error ? err.message : String(err)` ternary doesn't
// have to be re-derived at every catch site (it had reached 50+ copies before
// this helper landed).
//
// Strict-mode catch parameters are typed `unknown`, so callers cannot just
// reach for `.message` directly — using this helper keeps the surface honest
// without losing the string fallback for things like thrown strings or
// objects from older libraries.
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
