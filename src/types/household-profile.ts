import type { Locale } from "~/types/clinical";

// Per-household identity envelope. Replaces the hardcoded patient name
// / diagnosis / clinician strings that used to live inside system
// prompts and component defaults. One row per household, mirrored in
// Supabase (household_profile table) and Dexie (v20).
//
// We deliberately keep `patient_initials` separate from
// `patient_display_name` (held on `households`) so prompts can refer
// to the patient succinctly ("AB tolerates GnP well") without
// scattering a full personal name across logs and Claude payloads.

export interface HouseholdProfile {
  household_id: string;
  patient_initials: string;
  diagnosis_short: string;
  diagnosis_full: string;
  oncologist_name: string | null;
  surgeon_name: string | null;
  locale_default: Locale;
  created_at: string;
  updated_at: string;
}

// Fallback used when no profile is available — anonymous (pre-signup)
// session, brand-new household before the row is filled, or in tests.
// Phrased generically so a Claude prompt rendered with this fallback
// reads as a generic clinical assistant rather than naming a specific
// patient who isn't actually behind the keyboard.
export const FALLBACK_HOUSEHOLD_PROFILE: HouseholdProfile = {
  household_id: "fallback",
  patient_initials: "the patient",
  diagnosis_short: "metastatic pancreatic cancer",
  diagnosis_full:
    "metastatic pancreatic ductal adenocarcinoma on first-line gemcitabine + nab-paclitaxel",
  oncologist_name: null,
  surgeon_name: null,
  locale_default: "en",
  created_at: "1970-01-01T00:00:00Z",
  updated_at: "1970-01-01T00:00:00Z",
};
