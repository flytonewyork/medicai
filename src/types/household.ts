// Per-user identity inside a household. Mirrors the Supabase schema in
// supabase/migrations/2026_04_23_slice_a_households.sql. These are the
// types the client sees after the Supabase query round-trips.

export type HouseholdRole =
  | "primary_carer"
  | "patient"
  | "family"
  | "clinician"
  | "observer";

export interface Profile {
  id: string;                 // uuid = auth.users.id
  display_name: string;
  avatar_url?: string | null;
  locale: "en" | "zh";
  care_role_label?: string | null;  // free-text ("Son", "Palliative RN")
  relationship?: string | null;     // Slice M — "son", "wife", "oncology nurse"
  timezone?: string | null;         // IANA id e.g. "Australia/Melbourne"
  notification_preference?:
    | "all"
    | "digest"
    | "emergency_only"
    | null;
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

// Lightweight household-picker shape — what `list_all_households()`
// returns. Caregiver onboarding renders this in a tap-list; the full
// household row isn't fetched until after the user joins and RLS opens
// the regular `households` SELECT to them.
export interface HouseholdSummary {
  id: string;
  name: string;
  patient_display_name: string;
  created_at: string;
  member_count: number;
}

// Public-readable invite preview returned by `get_invite_preview` —
// the minimum needed for the /invite/<token> landing page to show a
// trustworthy "you've been invited to X as Y" card BEFORE forcing
// the visitor to sign in. Status mirrors the SQL function's enum.
export type InvitePreviewStatus =
  | "active"
  | "expired"
  | "revoked"
  | "accepted"
  | "not_found";

export interface InvitePreview {
  status: InvitePreviewStatus;
  household_name: string | null;
  patient_display_name: string | null;
  role: HouseholdRole | null;
  invited_by_name: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
}
