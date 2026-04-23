// Declarative skill registry for Claude agents.
//
// Each skill is a named capability the agent can invoke via tool-use to
// read or mutate the patient's state. The registry is the single source
// of truth: it feeds the `tools` parameter on the Anthropic SDK call AND
// drives the client-side dispatcher that actually runs the handler
// against Dexie. New capabilities are added by declaring a new skill
// entry here and a handler in `./handlers/<skill>.ts`.
//
// Runtime split — every skill runs *client-side*. Dexie is browser-only
// and source-of-truth, so the agent's tool loop lives in the client
// harness: it posts messages to a thin server proxy, receives an
// assistant message, executes any tool_use blocks via these handlers,
// and sends the tool_result back. The server never touches Dexie.

import type {
  AddDiscussionItemInput,
  AddDiscussionItemOutput,
} from "./handlers/add-discussion-item";
import type {
  ReadLabsInput,
  ReadLabsOutput,
} from "./handlers/read-labs";
import type {
  ReadDailyInput,
  ReadDailyOutput,
} from "./handlers/read-daily";
import type {
  ReadAppointmentsInput,
  ReadAppointmentsOutput,
} from "./handlers/read-appointments";
import type {
  ReadCareTeamInput,
  ReadCareTeamOutput,
} from "./handlers/read-care-team";
import type {
  AddTaskInput,
  AddTaskOutput,
} from "./handlers/add-task";
import type { JSONSchema } from "./schema";

export interface SkillDefinition<I = unknown, O = unknown> {
  name: string;
  description: string;
  // JSON Schema for the input — Anthropic's tool_use contract consumes
  // this verbatim. Keep it conservative; require the fewest fields an
  // agent needs to decide on a safe call.
  input_schema: JSONSchema;
  // Phantom marker so the TS compiler can check input / output pairs at
  // dispatch time without forcing every skill to share a generic.
  _io?: { input: I; output: O };
}

// -----------------------------------------------------------------------
// Skill definitions
// -----------------------------------------------------------------------

export const readLabs: SkillDefinition<ReadLabsInput, ReadLabsOutput> = {
  name: "read_labs",
  description:
    "Return patient lab results. Optionally filter by a single analyte (e.g. 'glucose', 'ca199', 'neutrophils') and/or an ISO date range. Returns at most `limit` rows, newest first. Use this before flagging a value as trending up/down.",
  input_schema: {
    type: "object",
    properties: {
      analyte: {
        type: "string",
        description:
          "Optional. A single field name on LabResult (e.g. 'glucose', 'neutrophils', 'ca199'). Omit to get every analyte on the row.",
      },
      since: {
        type: "string",
        description: "Optional ISO date (YYYY-MM-DD). Exclude rows before this.",
      },
      until: {
        type: "string",
        description: "Optional ISO date. Exclude rows after this.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Max rows to return. Defaults to 10.",
      },
    },
  },
};

export const readDaily: SkillDefinition<ReadDailyInput, ReadDailyOutput> = {
  name: "read_daily_entries",
  description:
    "Return recent daily check-in entries (energy, sleep, nausea, fever, weight, steps, etc.) newest first. Use to quote recent data rather than inventing it.",
  input_schema: {
    type: "object",
    properties: {
      since: { type: "string", description: "Optional ISO date lower bound." },
      until: { type: "string", description: "Optional ISO date upper bound." },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 60,
        description: "Max rows. Defaults to 14 (two weeks).",
      },
    },
  },
};

export const readAppointments: SkillDefinition<
  ReadAppointmentsInput,
  ReadAppointmentsOutput
> = {
  name: "read_appointments",
  description:
    "Return upcoming appointments the agent should know about, optionally filtered by `kind` ('clinic' | 'chemo' | 'scan' | 'blood_test' | 'procedure' | 'other'). Returns next N in time order.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["clinic", "chemo", "scan", "blood_test", "procedure", "other"],
      },
      include_past: {
        type: "boolean",
        description:
          "If true, include past appointments within the last 30 days. Default false.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 30,
        description: "Max rows. Defaults to 5.",
      },
    },
  },
};

export const readCareTeam: SkillDefinition<
  ReadCareTeamInput,
  ReadCareTeamOutput
> = {
  name: "read_care_team",
  description:
    "Return the household's care-team roster (name, role, phone, email, is_lead). Use when drafting a 'message the nurse' or 'escalate to oncologist' suggestion so the right member is named.",
  input_schema: {
    type: "object",
    properties: {
      role: {
        type: "string",
        enum: [
          "family",
          "oncologist",
          "surgeon",
          "gp",
          "nurse",
          "allied_health",
          "other",
        ],
        description:
          "Optional. If set, only return members with this role (lead first).",
      },
    },
  },
};

export const addDiscussionItem: SkillDefinition<
  AddDiscussionItemInput,
  AddDiscussionItemOutput
> = {
  name: "add_discussion_item",
  description:
    "Queue a plain-language item to raise at a future clinic appointment. Used when the agent notices something worth flagging but that isn't urgent. Never emits duplicates — if the same text is already queued on that appointment, no-op.",
  input_schema: {
    type: "object",
    required: ["appointment_id", "text"],
    properties: {
      appointment_id: {
        type: "integer",
        description: "Dexie id of the target appointment (from read_appointments).",
      },
      text: {
        type: "string",
        minLength: 3,
        maxLength: 240,
        description: "One short sentence. Specific, quotable by the patient.",
      },
    },
  },
};

export const addTask: SkillDefinition<AddTaskInput, AddTaskOutput> = {
  name: "add_task",
  description:
    "Add a task to the patient's task list. Use sparingly — the patient sees every task, so only things they actually need to do.",
  input_schema: {
    type: "object",
    required: ["title"],
    properties: {
      title: {
        type: "string",
        minLength: 3,
        maxLength: 120,
        description: "Imperative phrasing. 'Book blood test by Tue', not 'reminder'.",
      },
      due_date: {
        type: "string",
        description: "Optional ISO date.",
      },
      category: {
        type: "string",
        description: "Optional free-text category.",
      },
      notes: {
        type: "string",
        maxLength: 500,
      },
    },
  },
};

// The authoritative ordered registry. `allSkills` is what the Anthropic
// `tools` payload is derived from; `skillsByName` is the dispatcher
// lookup. New skills: append to `allSkills` — the array's order is the
// order they appear in the agent's system prompt.

export const allSkills = [
  readLabs,
  readDaily,
  readAppointments,
  readCareTeam,
  addDiscussionItem,
  addTask,
] as const;

export const skillsByName: Record<string, SkillDefinition> = Object.fromEntries(
  allSkills.map((s) => [s.name, s]),
);
