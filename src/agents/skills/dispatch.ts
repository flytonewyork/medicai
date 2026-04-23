import { skillsByName } from "./registry";
import { addDiscussionItemHandler } from "./handlers/add-discussion-item";
import { addTaskHandler } from "./handlers/add-task";
import { readAppointmentsHandler } from "./handlers/read-appointments";
import { readCareTeamHandler } from "./handlers/read-care-team";
import { readDailyHandler } from "./handlers/read-daily";
import { readLabsHandler } from "./handlers/read-labs";

// Dispatcher: maps a tool_use call ("name" + input object) to the matching
// handler and returns the tool_result payload. Lives alongside the
// registry so adding a new skill is name → schema → handler in three
// adjacent edits.
//
// Handlers can throw; the dispatcher catches and wraps into a typed
// error result so the tool_use loop never kills the whole agent run.

const handlers: Record<
  string,
  (input: unknown) => Promise<unknown>
> = {
  read_labs: (i) => readLabsHandler(i as never),
  read_daily_entries: (i) => readDailyHandler(i as never),
  read_appointments: (i) => readAppointmentsHandler(i as never),
  read_care_team: (i) => readCareTeamHandler(i as never),
  add_discussion_item: (i) => addDiscussionItemHandler(i as never),
  add_task: (i) => addTaskHandler(i as never),
};

export interface DispatchResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

export async function dispatchSkill(
  name: string,
  input: unknown,
): Promise<DispatchResult> {
  if (!skillsByName[name]) {
    return { ok: false, error: `unknown_skill:${name}` };
  }
  const handler = handlers[name];
  if (!handler) {
    return { ok: false, error: `handler_missing:${name}` };
  }
  if (!validateAgainstSchema(input, skillsByName[name]!.input_schema)) {
    return { ok: false, error: `bad_input_for:${name}` };
  }
  try {
    const output = await handler(input);
    return { ok: true, output };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Minimal runtime JSONSchema check — just enough to catch the "agent
// forgot a required field" case. For anything more, reach for Zod.
function validateAgainstSchema(
  input: unknown,
  schema: { type?: string; required?: readonly string[]; properties?: Record<string, unknown> },
): boolean {
  if (schema.type === "object") {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return false;
    }
    const obj = input as Record<string, unknown>;
    for (const req of schema.required ?? []) {
      if (obj[req] === undefined) return false;
    }
  }
  return true;
}
