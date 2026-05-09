// Pull a human-readable message out of an unknown thrown value.
//
// The pattern
//
//     err instanceof Error ? err.message : String(err)
//
// had grown to ~50 sites across components, hooks, API routes, and
// background ingest jobs. Centralising it gives every caller the same
// fallback for non-Error throws and makes it easier to layer on richer
// extraction later (cause chains, redaction) without hunting down call
// sites.
//
// Beyond the basic ternary, this helper also reaches into the
// `{ message: string }` shape used by Supabase's `PostgrestError` and
// most fetch-style libraries — these are plain objects, not `Error`
// instances, so the naive `String(err)` fallback produced
// "[object Object]" in toasts. Onboarding had its own copy of this
// logic; everything now flows through here.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  if (typeof err === "string" && err.length > 0) return err;
  return "Something went wrong.";
}
