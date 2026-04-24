import { z } from "zod/v4";

// Schema the vision/email parser is asked to emit. Lives in its own file (and
// on zod/v4) because the Anthropic SDK's `zodOutputFormat` helper imports
// `zod/v4` internally — passing a v3 schema throws "Cannot read properties of
// undefined (reading 'def')". The forms schema stays on zod v3 in
// `./schema.ts` so form-validation behaviour is unchanged.

const appointmentKindSchema = z.enum([
  "clinic",
  "chemo",
  "scan",
  "blood_test",
  "procedure",
  "other",
]);

// Mirrors AppointmentPrepKind in ~/types/appointment. Kept duplicated here
// instead of importing so this schema stays pure zod-v4 with no cross-module
// enum coupling.
const prepKindSchema = z.enum([
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
]);

const parsedPrepSchema = z.object({
  kind: prepKindSchema,
  description: z.string().min(1),
  // Absolute cut-off when the letter/email gives one ("no food from 7am")
  starts_at: z.string().optional(),
  // Relative offset when only "6 hours before" is stated
  hours_before: z.number().optional(),
});

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
  // Structured preparation items ("no food from 7am", "bring overnight bag").
  // Parser returns [] when the source has no prep instructions.
  prep: z.array(parsedPrepSchema).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  ambiguities: z.array(z.string()).optional(),
});

export type ParsedAppointment = z.infer<typeof parsedAppointmentSchema>;
export type ParsedAppointmentPrep = z.infer<typeof parsedPrepSchema>;
