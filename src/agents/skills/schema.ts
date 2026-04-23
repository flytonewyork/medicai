// Tiny JSONSchema subset that mirrors what the Anthropic tool_use contract
// accepts as `input_schema`. Kept narrow on purpose: if we need more we
// should reach for a proper JSONSchema type rather than growing this one.

export interface JSONSchema {
  type?: "object" | "string" | "integer" | "number" | "boolean" | "array";
  description?: string;
  required?: readonly string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  enum?: readonly string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}
