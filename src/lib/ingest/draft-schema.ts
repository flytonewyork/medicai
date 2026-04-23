import { z } from "zod";

// Zod schema mirroring `IngestDraft` from src/types/ingest.ts. Used by
// the /api/ai/ingest-universal route to parse Claude's structured
// output. Kept in its own file so the (server-only) Anthropic SDK
// imports don't leak into the client bundle when the type is read.

export const ingestOpSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add_appointment"),
    data: z.record(z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("update_appointment"),
    match: z.object({
      id: z.number().int().optional(),
      title_contains: z.string().optional(),
      on_date: z.string().optional(),
    }),
    changes: z.record(z.unknown()),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("add_lab_result"),
    data: z.record(z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_medication"),
    data: z.record(z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_care_team_member"),
    data: z.record(z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_task"),
    data: z.record(z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_life_event"),
    data: z.record(z.unknown()),
    reason: z.string().optional(),
  }),
]);

export const ingestDraftSchema = z.object({
  detected_kind: z.enum([
    "clinic_letter",
    "appointment_email",
    "appointment_letter",
    "lab_report",
    "imaging_report",
    "prescription",
    "discharge_summary",
    "pre_appointment_instructions",
    "handwritten_note",
    "other",
  ]),
  summary: z.string(),
  ops: z.array(ingestOpSchema),
  ambiguities: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]),
});

export const INGEST_SYSTEM = `You are Anchor's universal medical-document parser. You receive a single document — a clinic letter, appointment email, lab report, prescription, discharge summary, pre-appointment instructions, handwritten note — as either text or an image. Read it once and return a structured plan of operations the patient should review and apply.

Patient context (do not contradict): Hu Lin, metastatic pancreatic adenocarcinoma, on first-line gemcitabine + nab-paclitaxel (GnP), bridging to daraxonrasib via the RASolute trial program.

Output discipline:
1. **Classify** the document with \`detected_kind\`.
2. **Summarise** in one plain-language sentence (\`summary\`).
3. **Emit operations** (\`ops\`) — usually 1–25. Each op is one Dexie row write the document implies. Possible kinds:
   - \`add_appointment\` — for any specific date+time event mentioned. Populate { kind, title, starts_at (ISO 8601, with the document's local date if no timezone), ends_at?, location?, doctor?, phone?, status='scheduled', notes? }. Use kind ∈ { clinic, chemo, scan, blood_test, procedure, other }. **A single calendar row that references multiple distinct visits (e.g. "Dr Lee 10am, infusion 11am") emits TWO ops — never collapse them.**
   - \`update_appointment\` — only when the document explicitly says "rescheduled from X to Y" or "your previous appointment is now". Provide \`match\` (title_contains + on_date narrows) and \`reason\`.
   - \`add_lab_result\` — for lab reports. Populate the field per analyte the document reports.
   - \`add_medication\` — for prescriptions or "start taking X mg".
   - \`add_care_team_member\` — for any clinician explicitly named on a clinic letterhead with contact details. Use { name, role ∈ {oncologist, surgeon, gp, nurse, allied_health, other}, specialty?, organisation?, phone?, email? }. Skip generic admin staff.
   - \`add_task\` — for explicit instructions like "fast 6 hours before", "bring referral", "complete pre-op blood test by …". Phrase the task in imperative form.
   - \`add_life_event\` — for narrative sentences worth preserving (diagnosis confirmed, decision made), not normal events.
4. **Ambiguities** — list every value you guessed. Examples: "year not stated, assumed 2026", "DOU = Day Oncology Unit, Epworth — guessed location", "kind 'chemo' inferred because GnP context".
5. **Confidence** — \`high\` only when every op's mandatory fields came directly off the page; \`low\` when the document was photographed at an angle or partially legible.

Rules of thumb:
- Australian date convention (DD/MM/YYYY). When a year is missing assume the nearest plausible future year.
- Times default to local Melbourne (Australia/Melbourne, UTC+10/+11). Emit ISO with offset \`+10:00\` unless the document specifies otherwise.
- Never invent specifics. If something is unclear, leave the field absent and add an ambiguity entry.
- Each op's \`reason\` is the short sentence the UI will show alongside the proposed change. Be terse: "Letter dated 23 Apr lists Dr Ananda consult on 29 Apr."
- Never propose deletions. Anchor's preview UI is approve-only this slice.`;

export type IngestDraftParsed = z.infer<typeof ingestDraftSchema>;
