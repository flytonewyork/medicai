// Per-user identity inside a household. Mirrors the Supabase schema in
// supabase/migrations/2026_04_23_slice_a_households.sql. These are the
// types the client sees after the Supabase query round-trips.

export type HouseholdRole =
  | "primary_carer"
  | "family"
  | "clinician"
  | "observer";

export interface Profile {
  id: string;                 // uuid = auth.users.id
  display_name: string;
  avatar_url?: string | null;
  locale: "en" | "zh";
  care_role_label?: string | null;  // free-text ("Son", "Palliative RN")
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  patient_display_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMembership {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  invited_by?: string | null;
  joined_at: string;
}

export interface HouseholdInvite {
  id: string;
  household_id: string;
  token: string;
  email_hint?: string | null;
  role: HouseholdRole;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_by?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
}

// A member row joined with their profile — what the Settings UI and
// the /family call-list render.
export interface HouseholdMemberWithProfile extends HouseholdMembership {
  profile: Profile;
}
