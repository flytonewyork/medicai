import type { HouseholdRole } from "~/types/household";
import type { SyncedTable } from "~/lib/sync/tables";

// Authoritative permission matrix. This file is the single source of
// truth — the client-side gates read from `PERMISSIONS`, and the
// SQL RLS helpers are regenerated from it (see
// supabase/migrations/2026_04_23_slice_m_roles.sql).
//
// When adding a new action: (1) add the row here, (2) update the
// mirror comment inside the SQL migration, (3) update the user-
// facing matrix in docs/ROLES_AND_PERMISSIONS.md.
//
// The set of roles is intentionally small (5). Adding a sixth role
// means revisiting every row in this matrix.

export type PermissionAction =
  | "invite_members"
  | "remove_members"
  | "edit_household_settings"
  | "edit_treatment_plan"
  | "edit_medications"
  | "edit_appointments"
  | "log_daily_checkin"
  | "log_clinical_note"
  | "quick_note_family"
  | "confirm_self_attendance"
  | "see_clinical_data"
  | "see_family_notes"
  | "see_member_list"
  | "see_pending_invites";

export const PERMISSIONS: Record<PermissionAction, readonly HouseholdRole[]> = {
  // The patient is captain of their own care team. They can bring carers
  // in directly without going through the primary carer — this is the
  // canonical user story for someone who self-onboards before anyone
  // else exists in the household. Removing other members and editing
  // structural household settings still belong to the primary carer
  // (so a patient can't accidentally lock the lead carer out).
  invite_members: ["primary_carer", "patient"],
  remove_members: ["primary_carer", "patient"],
  edit_household_settings: ["primary_carer"],
  edit_treatment_plan: ["primary_carer", "clinician"],
  edit_medications: ["primary_carer", "patient", "clinician"],
  edit_appointments: ["primary_carer", "patient", "family"],
  log_daily_checkin: ["primary_carer", "patient", "family"],
  log_clinical_note: ["primary_carer", "clinician"],
  quick_note_family: ["primary_carer", "patient", "family"],
  confirm_self_attendance: [
    "primary_carer",
    "patient",
    "family",
    "clinician",
  ],
  see_clinical_data: [
    "primary_carer",
    "patient",
    "family",
    "clinician",
    "observer",
  ],
  see_family_notes: ["primary_carer", "patient", "family"],
  see_member_list: [
    "primary_carer",
    "patient",
    "family",
    "clinician",
    "observer",
  ],
  see_pending_invites: ["primary_carer", "patient"],
};

// The workhorse. Null role (signed out / no membership) never
// passes — the caller decides whether to fall back to offline mode.
export function can(
  role: HouseholdRole | null | undefined,
  action: PermissionAction,
): boolean {
  if (!role) return false;
  return PERMISSIONS[action].includes(role);
}

// Convenience: given a role, returns every action they can take.
// Useful for showing "here's what you can do" on the welcome screen
// after invite acceptance.
export function actionsFor(role: HouseholdRole): PermissionAction[] {
  return (Object.keys(PERMISSIONS) as PermissionAction[]).filter((a) =>
    can(role, a),
  );
}

// Human-readable labels for each action (bilingual). Used in the
// post-invite welcome screen and any "permission denied" toast.
export const ACTION_LABEL: Record<
  PermissionAction,
  { en: string; zh: string }
> = {
  invite_members: { en: "Invite new members", zh: "邀请新成员" },
  remove_members: { en: "Remove members", zh: "移除成员" },
  edit_household_settings: {
    en: "Edit family settings",
    zh: "编辑家庭设置",
  },
  edit_treatment_plan: { en: "Edit treatment plan", zh: "编辑治疗方案" },
  edit_medications: { en: "Edit medications", zh: "编辑用药" },
  edit_appointments: { en: "Edit appointments", zh: "编辑预约" },
  log_daily_checkin: { en: "Log daily check-in", zh: "记录每日检查" },
  log_clinical_note: { en: "Add clinical notes", zh: "添加临床记录" },
  quick_note_family: { en: "Post a quick note", zh: "发送快速记录" },
  confirm_self_attendance: {
    en: "Confirm your attendance",
    zh: "确认参与",
  },
  see_clinical_data: { en: "View clinical data", zh: "查看临床数据" },
  see_family_notes: { en: "Read family notes", zh: "查看家人记录" },
  see_member_list: { en: "See who else is on the team", zh: "查看团队成员" },
  see_pending_invites: { en: "Manage pending invites", zh: "管理待处理邀请" },
};

// Roles expanded with their user-facing label, sorted for display.
export const ROLE_LABEL: Record<HouseholdRole, { en: string; zh: string }> = {
  primary_carer: { en: "Primary carer", zh: "主要照护者" },
  patient: { en: "Patient", zh: "患者" },
  family: { en: "Family", zh: "家人" },
  clinician: { en: "Clinician", zh: "临床医师" },
  observer: { en: "Observer", zh: "观察者" },
};

// Maps each `cloud_rows.table_name` to the permission action that
// gates writes against it. Mirrored in
// supabase/migrations/2026_04_26_slice_m_role_writes.sql; the parity
// test in tests/unit/permissions.test.ts asserts the two stay in
// sync. Tables not listed fall back to a household-membership-only
// check on the SQL side.
export const TABLE_WRITE_ACTION: Partial<Record<SyncedTable, PermissionAction>> = {
  // Clinical surface
  labs: "log_clinical_note",
  imaging: "log_clinical_note",
  ctdna_results: "log_clinical_note",
  molecular_profile: "log_clinical_note",
  pending_results: "log_clinical_note",
  ingested_documents: "log_clinical_note",
  comprehensive_assessments: "log_clinical_note",
  fortnightly_assessments: "log_clinical_note",
  quarterly_reviews: "log_clinical_note",
  change_signals: "log_clinical_note",
  signal_events: "log_clinical_note",
  decisions: "log_clinical_note",
  // Treatment plan
  treatments: "edit_treatment_plan",
  treatment_cycles: "edit_treatment_plan",
  trials: "edit_treatment_plan",
  // Medications
  medications: "edit_medications",
  medication_events: "edit_medications",
  medication_prompt_events: "edit_medications",
  // Daily check-ins
  daily_entries: "log_daily_checkin",
  weekly_assessments: "log_daily_checkin",
  // Family / patient narrative
  family_notes: "quick_note_family",
  life_events: "quick_note_family",
  zone_alerts: "quick_note_family",
  patient_tasks: "quick_note_family",
  // Household configuration
  settings: "edit_household_settings",
};

// Plain-language description of what each role can do. Shown in the
// invite picker (primary carer choosing a role for the invitee) and
// on the welcome screen after acceptance.
export const ROLE_DESCRIPTION: Record<
  HouseholdRole,
  { en: string; zh: string }
> = {
  primary_carer: {
    en: "Runs the household — can invite, remove, and edit the treatment plan.",
    zh: "管理全家 —— 可邀请、移除成员并编辑治疗方案。",
  },
  patient: {
    en: "The patient themselves. Logs their own symptoms, confirms attendance, edits their medications.",
    zh: "患者本人。可记录症状、确认参与、编辑用药。",
  },
  family: {
    en: "Extended family. Sees schedule, confirms attendance, posts quick notes. Can't edit the treatment plan.",
    zh: "家人。可查看日程、确认参与、发送记录，但不能编辑治疗方案。",
  },
  clinician: {
    en: "External clinical contact. Reads the chart, can add clinical notes, doesn't see family messages.",
    zh: "外部临床联系人。可查阅病历并添加临床记录，不查看家人留言。",
  },
  observer: {
    en: "Read-only access. Social worker, lawyer, or researcher with consent.",
    zh: "仅读权限。社工、律师或经同意的研究人员。",
  },
};
