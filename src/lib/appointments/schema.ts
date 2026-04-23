import { z } from "zod";

export const appointmentKindSchema = z.enum([
  "clinic",
  "chemo",
  "scan",
  "blood_test",
  "procedure",
  "other",
]);

export const appointmentStatusSchema = z.enum([
  "scheduled",
  "attended",
  "missed",
  "cancelled",
  "rescheduled",
]);

// Input schema for create / edit forms. `id`, `created_at`, `updated_at`
// are assigned by the persistence layer, not by the form.
export const appointmentInputSchema = z.object({
  kind: appointmentKindSchema,
  title: z.string().trim().min(1, "Title required").max(200),
  starts_at: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid start date"),
  ends_at: z
    .string()
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), "Invalid end date")
    .optional()
    .or(z.literal("")),
  all_day: z.boolean().optional(),
  timezone: z.string().optional(),
  location: z.string().max(200).optional(),
  location_url: z.string().url().optional().or(z.literal("")),
  doctor: z.string().max(100).optional(),
  phone: z.string().max(60).optional(),
  notes: z.string().max(5000).optional(),
  status: appointmentStatusSchema.default("scheduled"),
  attendees: z.array(z.string().trim().min(1)).optional(),
  attachments: z.array(z.string()).optional(),
  derived_from_cycle: z.boolean().optional(),
  cycle_id: z.number().int().positive().optional(),
  attendance: z
    .array(
      z.object({
        name: z.string().min(1),
        user_id: z.string().uuid().optional(),
        status: z.enum(["confirmed", "tentative", "declined"]),
        claimed_at: z.string(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  prep: z
    .array(
      z.object({
        kind: z.enum([
          "fast",
          "medication_hold",
          "medication_take",
          "arrive_early",
          "bring",
          "sample",
          "transport",
          "companion",
          "consent",
          "pre_scan_contrast",
          "other",
        ]),
        description: z.string().min(1),
        starts_at: z.string().optional(),
        hours_before: z.number().min(0).max(168).optional(),
        completed_at: z.string().optional(),
        info_source: z
          .enum(["email", "phone", "letter", "in_person", "other"])
          .optional(),
      }),
    )
    .optional(),
  prep_info_received: z.boolean().optional(),
  linked_records: z
    .array(
      z.object({
        kind: z.enum([
          "treatment_cycle",
          "lab_result",
          "pending_result",
          "imaging",
          "ctdna_result",
          "medication",
          "decision",
          "task",
        ]),
        local_id: z.number().int().positive(),
        label: z.string().optional(),
      }),
    )
    .optional(),
  ics_uid: z.string().optional(),
  followup_logged_at: z.string().optional(),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

// The parsed-output schema lives in `./parse-schema.ts` — it must be a zod/v4
// schema so it can be fed to the Anthropic SDK's `zodOutputFormat` helper,
// which internally calls `z.toJSONSchema` (v4-only). Re-exported here for
// backwards compatibility with existing imports.
export {
  parsedAppointmentSchema,
  type ParsedAppointment,
} from "./parse-schema";
