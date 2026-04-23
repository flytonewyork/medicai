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
  followup_logged_at: z.string().optional(),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

// Schema the vision/email parser is asked to emit. Kept lean so the LLM
// doesn't hallucinate URLs or status transitions it has no evidence for.
export const parsedAppointmentSchema = z.object({
  kind: appointmentKindSchema,
  title: z.string().min(1),
  starts_at: z.string(), // ISO; parser does its best, we validate on save
  ends_at: z.string().optional(),
  all_day: z.boolean().optional(),
  location: z.string().optional(),
  doctor: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  ambiguities: z.array(z.string()).optional(),
});

export type ParsedAppointment = z.infer<typeof parsedAppointmentSchema>;
