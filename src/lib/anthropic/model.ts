// Default Claude model used by every Claude-backed call (server route or
// client-side helper). Override per-user via Settings.default_ai_model.
// Kept in its own module so client code can import it without pulling in
// the server-only Anthropic SDK from route-helpers.ts.
export const DEFAULT_AI_MODEL = "claude-opus-4-7";
