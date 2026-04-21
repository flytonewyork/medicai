// Narrow an unknown caught value to a displayable message string.
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
