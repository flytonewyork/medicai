import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z as zv4 } from "zod/v4";

// Thin wrapper around the SDK's `zodOutputFormat`. The SDK's type signature
// expects a zod v3 `ZodType`, but its runtime calls `z.toJSONSchema()` (v4
// only). We pass v4 schemas — this shim keeps the type checker happy without
// the ` as any` sprinkled at every call site.
export function jsonOutputFormat<T extends zv4.ZodTypeAny>(schema: T) {
  return zodOutputFormat(schema as unknown as Parameters<typeof zodOutputFormat>[0]);
}
