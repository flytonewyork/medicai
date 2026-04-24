// Central care-team registry. A single source of truth that every
// care-team surface (appointment attendees, emergency card, pre-clinic
// summary, family context) reads from — so "Wendy", "wendy", and
// "Wendy Hu" never fragment in the database.
//
// Each member has a stable numeric id (Dexie autoincrement) plus a
// human-chosen `name`. Roles are coarse buckets that drive UI
// treatment (role-coloured chips, grouping in Settings, emergency-card
// highlighting) rather than fine-grained permissions. Specialty is
// free-text for the long tail ("HPB surgeon", "Medical Oncology",
// "Palliative Care RN").

export type CareTeamRole =
  | "family"         // Thomas, Catherine, Wendy
  | "oncologist"     // Dr Michael Lee
  | "surgeon"        // Mark Cullinan
  | "gp"             // general practitioner
  | "nurse"          // chemo nurse, care coordinator
  | "allied_health"  // physio, dietitian, psychologist
  | "other";

// Account-linkage status for a care-team member who also signs in to
// Anchor. "none" = local contact only (most clinicians fall here);
// "invited" = a Supabase invite has been created and is pending
// acceptance; "active" = the invitee has joined and now has a
// household_membership row of their own. The Settings care-team list
// renders one row per member with this badge so a single contact can
// represent both the call-list entry and the Anchor account.
export type CareTeamAccountStatus = "none" | "invited" | "active";

export interface CareTeamMember {
  id?: number;
  name: string;
  role: CareTeamRole;
  specialty?: string;
  organisation?: string;  // "Epworth Richmond"
  phone?: string;
  email?: string;
  notes?: string;
  // When true, this person is the canonical contact for their role — the
  // managing oncologist, the primary family contact, etc. Used by the
  // emergency card and pre-clinic summary to pick one per role.
  is_lead?: boolean;
  // When true, include this member on newly-created appointments of the
  // given kinds by default. For now we don't act on this; the flag is
  // captured so a future pass can default-populate attendees.
  default_attendee?: boolean;
  // Optional Anchor-account linkage. Populated when the member also
  // signs in (e.g. a family member invited via household_invites).
  // Settings UI renders the row as one entry, not two.
  account_user_id?: string;            // Supabase auth.uid when linked
  account_status?: CareTeamAccountStatus;
  pending_invite_id?: string;          // Supabase household_invites.id while pending
  pending_invite_token?: string;       // copy-link target while pending
  created_at: string;
  updated_at: string;
}
