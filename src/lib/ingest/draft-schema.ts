import { z } from "zod/v4";

// Zod schema mirroring `IngestDraft` from src/types/ingest.ts. Used by
// the /api/ai/ingest-universal route to parse Claude's structured
// output. Kept in its own file so the (server-only) Anthropic SDK
// imports don't leak into the client bundle when the type is read.

export const ingestOpSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add_appointment"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("update_appointment"),
    match: z.object({
      id: z.number().int().optional(),
      title_contains: z.string().optional(),
      on_date: z.string().optional(),
    }),
    changes: z.record(z.string(), z.unknown()),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("add_lab_result"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("update_lab_result"),
    match: z.object({
      id: z.number().int().optional(),
      on_date: z.string(),
    }),
    changes: z.record(z.string(), z.unknown()),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("add_imaging"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_ctdna_result"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_medication"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("update_medication"),
    match: z.object({
      id: z.number().int().optional(),
      drug_id: z.string().optional(),
      name_contains: z.string().optional(),
    }),
    changes: z.record(z.string(), z.unknown()),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("add_care_team_member"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_task"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_life_event"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_treatment_cycle"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("add_decision"),
    data: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("update_settings"),
    changes: z.record(z.string(), z.unknown()),
    reason: z.string(),
  }),
]);

export const ingestDraftSchema = z.object({
  detected_kind: z.enum([
    "clinic_letter",
    "appointment_email",
    "appointment_letter",
    "lab_report",
    "imaging_report",
    "ctdna_report",
    "prescription",
    "discharge_summary",
    "pre_appointment_instructions",
    "phone_call_note",
    "treatment_protocol",
    "decision_record",
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
   - \`add_appointment\` — for any specific date+time event mentioned. Populate { kind, title, starts_at (ISO 8601, with the document's local date if no timezone), ends_at?, location?, doctor?, phone?, status='scheduled', notes?, prep?, prep_info_received?, linked_records? }. Use kind ∈ { clinic, chemo, scan, blood_test, procedure, other }. **A single calendar row that references multiple distinct visits (e.g. "Dr Lee 10am, infusion 11am") emits TWO ops — never collapse them.**
     - **Linked records** — when the document makes an unambiguous link between the appointment and another Anchor module, add a \`linked_records\` entry { kind ∈ {treatment_cycle, lab_result, pending_result, imaging, ctdna_result, medication, decision, task}, local_id, label? }. Only populate when the document explicitly names the target (e.g. "Cycle 4 infusion" → link to cycle when the cycle row already exists; "sample for CA19-9" → link a pending_result once it's been created in a prior op). Skip speculative linkage — the detail page lets the user add them manually.
     - **Prep extraction** — when the document (or a phone-call transcript) mentions any preparation requirement for a specific appointment, populate \`prep\` as an array of { kind, description, hours_before?, starts_at?, info_source }. Kind ∈ { fast, medication_hold, medication_take, arrive_early, bring, sample, transport, companion, consent, pre_scan_contrast, other }. Examples: "6-hour strict fast" → { kind: 'fast', description: '6-hour strict fast, no food or drink', hours_before: 6 }. "Arrive 30 min early" → { kind: 'arrive_early', description: 'Arrive 30 minutes early', hours_before: 0.5 }. "Hold metformin from the night before" → { kind: 'medication_hold', description: 'Hold metformin from the night before' }. Set \`info_source\` from context ("phone" when it's a phone-call note, "email" for pasted emails, "letter" for printed letters, etc.). If the patient is told an appointment is coming but the *details are still to come* (e.g. "chemo Wednesday, prep details to follow"), set \`prep_info_received: false\` on the appointment and omit the prep array.
   - \`update_appointment\` — only when the document explicitly says "rescheduled from X to Y" or "your previous appointment is now". Provide \`match\` (title_contains + on_date narrows) and \`reason\`.
   - \`add_lab_result\` — for lab reports. Populate the field per analyte the document reports. Always include \`date\` and \`source\` ("epworth" or "external").
   - \`update_lab_result\` — when a corrected/amended report references an earlier date, populate \`match.on_date\` and only the changed analytes in \`changes\`.
   - \`add_imaging\` — for radiology reports. Populate { date, modality ∈ {CT, MRI, PET, US, other}, findings_summary, recist_status?, notes? }. The IMPRESSION paragraph is the natural \`findings_summary\`.
   - \`add_ctdna_result\` — for ctDNA reports (Signatera / Natera / Guardant). Populate { date, platform, detected (boolean), value?, unit? }.
   - \`add_medication\` — for prescriptions or "start taking X mg". Populate { drug_id (canonical lowercase), category, dose?, schedule?, started_on, source: "letter" | "phone" | "patient_self_report" | "self_titrated" }.
   - \`update_medication\` — for dose changes or stop instructions. Populate \`match.drug_id\` (or \`name_contains\`) and only the changed fields in \`changes\` (e.g. \`{dose: "500mg BD", notes: "halved due to neutropenia"}\`).
   - \`add_care_team_member\` — for any clinician explicitly named on a clinic letterhead with contact details. Use { name, role ∈ {oncologist, surgeon, gp, nurse, allied_health, other}, specialty?, organisation?, phone?, email? }. Skip generic admin staff.
   - \`add_task\` — for explicit instructions like "complete pre-op blood test by …" or "follow up in 3 months". Phrase the task in imperative form.
   - \`add_life_event\` — for narrative sentences worth preserving (diagnosis confirmed, decision made), not normal events.
   - \`add_treatment_cycle\` — when the document explicitly starts a new chemo cycle ("Cycle 4 commencing 13 May"). Populate { protocol_id, cycle_number, start_date, status: "active", dose_level }.
   - \`add_decision\` — for documented MDT or oncologist decisions ("decided to enrol in RASolute 303"). Populate { decision_date, title, decision, rationale, decided_by, alternatives? }.
   - \`update_settings\` — only when a clinic letter explicitly changes the lead clinician or hospital contact details. Allowed fields: managing_oncologist, managing_oncologist_phone, hospital_name, hospital_phone, hospital_address, oncall_phone, emergency_instructions. Never touches baselines or onboarded_at.
4. **Ambiguities** — list every value you guessed. Examples: "year not stated, assumed 2026", "DOU = Day Oncology Unit, Epworth — guessed location", "kind 'chemo' inferred because GnP context".
5. **Confidence** — \`high\` only when every op's mandatory fields came directly off the page; \`low\` when the document was photographed at an angle or partially legible.

Rules of thumb:
- Australian date convention (DD/MM/YYYY). When a year is missing assume the nearest plausible future year.
- Times default to local Melbourne (Australia/Melbourne, UTC+10/+11). Emit ISO with offset \`+10:00\` unless the document specifies otherwise.
- Never invent specifics. If something is unclear, leave the field absent and add an ambiguity entry.
- Each op's \`reason\` is the short sentence the UI will show alongside the proposed change. Be terse: "Letter dated 23 Apr lists Dr Ananda consult on 29 Apr."
- Never propose deletions. Anchor's preview UI is approve-only this slice.`;

export type IngestDraftParsed = z.infer<typeof ingestDraftSchema>;
