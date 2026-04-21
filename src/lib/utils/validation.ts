import type { ZodError } from "zod";

// Flatten a ZodError's issue list into a comma-separated user-facing string.
export function formatZodIssues(error: ZodError): string {
  return error.issues.map((i) => i.message).join(", ");
}
