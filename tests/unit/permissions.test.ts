import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_LABEL,
  PERMISSIONS,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  TABLE_WRITE_ACTION,
  actionsFor,
  can,
  type PermissionAction,
} from "~/lib/auth/permissions";
import type { HouseholdRole } from "~/types/household";

const ROLES: HouseholdRole[] = [
  "primary_carer",
  "patient",
  "family",
  "clinician",
  "observer",
];

describe("can (permission matrix)", () => {
  it("returns false for null / undefined roles", () => {
    expect(can(null, "edit_treatment_plan")).toBe(false);
    expect(can(undefined, "see_clinical_data")).toBe(false);
  });

  it("primary_carer has every permission except where explicitly denied", () => {
    // Primary carer is in every action's allow-list by design.
    for (const action of Object.keys(PERMISSIONS) as PermissionAction[]) {
      expect(can("primary_carer", action)).toBe(true);
    }
  });

  it("observer can read but cannot write anything", () => {
    const reads: PermissionAction[] = [
      "see_clinical_data",
      "see_member_list",
    ];
    for (const action of reads) {
      expect(can("observer", action)).toBe(true);
    }
    const writes: PermissionAction[] = [
      "invite_members",
      "remove_members",
      "edit_treatment_plan",
      "edit_medications",
      "edit_appointments",
      "log_daily_checkin",
      "log_clinical_note",
      "quick_note_family",
      "see_pending_invites",
    ];
    for (const action of writes) {
      expect(can("observer", action)).toBe(false);
    }
  });

  it("clinician can edit treatment plan + medications + clinical notes but not family notes", () => {
    expect(can("clinician", "edit_treatment_plan")).toBe(true);
    expect(can("clinician", "edit_medications")).toBe(true);
    expect(can("clinician", "log_clinical_note")).toBe(true);
    expect(can("clinician", "see_family_notes")).toBe(false);
    expect(can("clinician", "invite_members")).toBe(false);
    expect(can("clinician", "edit_appointments")).toBe(false);
  });

  it("family can log daily check-ins + edit appointments but not the treatment plan", () => {
    expect(can("family", "log_daily_checkin")).toBe(true);
    expect(can("family", "edit_appointments")).toBe(true);
    expect(can("family", "quick_note_family")).toBe(true);
    expect(can("family", "edit_treatment_plan")).toBe(false);
    expect(can("family", "invite_members")).toBe(false);
  });

  it("patient can edit own medications + log check-ins + invite carers but not treatment plan", () => {
    expect(can("patient", "log_daily_checkin")).toBe(true);
    expect(can("patient", "edit_medications")).toBe(true);
    expect(can("patient", "edit_treatment_plan")).toBe(false);
    // Patients are captains of their own care team — they can bring
    // carers in directly. Removing other members and editing
    // structural settings still belong to the primary carer.
    expect(can("patient", "invite_members")).toBe(true);
    expect(can("patient", "see_pending_invites")).toBe(true);
    expect(can("patient", "remove_members")).toBe(true);
    expect(can("patient", "edit_household_settings")).toBe(false);
  });

  it("primary_carer and patient see pending invites; others don't", () => {
    for (const role of ROLES) {
      const expected = role === "primary_carer" || role === "patient";
      expect(can(role, "see_pending_invites")).toBe(expected);
    }
  });

  it("only primary_carer + clinician can add clinical notes", () => {
    for (const role of ROLES) {
      const allowed = role === "primary_carer" || role === "clinician";
      expect(can(role, "log_clinical_note")).toBe(allowed);
    }
  });
});

describe("actionsFor", () => {
  it("returns every action primary_carer can do", () => {
    const actions = actionsFor("primary_carer");
    expect(new Set(actions)).toEqual(new Set(Object.keys(PERMISSIONS)));
  });

  it("observer has only the see-* actions", () => {
    const actions = actionsFor("observer");
    for (const action of actions) {
      expect(action.startsWith("see_")).toBe(true);
    }
  });
});

describe("label / description coverage", () => {
  it("every role has a label + description", () => {
    for (const role of ROLES) {
      expect(ROLE_LABEL[role]?.en.length ?? 0).toBeGreaterThan(0);
      expect(ROLE_LABEL[role]?.zh.length ?? 0).toBeGreaterThan(0);
      expect(ROLE_DESCRIPTION[role]?.en.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("every action has a label", () => {
    for (const action of Object.keys(PERMISSIONS) as PermissionAction[]) {
      expect(ACTION_LABEL[action]?.en.length ?? 0).toBeGreaterThan(0);
    }
  });
});

// Parity check: the SQL `can_write` function must list the same set
// of actions as the TypeScript matrix. If a new action is added to
// PERMISSIONS without updating the migration, this test fires.
describe("SQL ↔ TS permission parity", () => {
  it("every PermissionAction appears in the can_write SQL function", () => {
    const sqlPath = join(
      __dirname,
      "..",
      "..",
      "supabase",
      "migrations",
      "2026_04_26_slice_m_role_writes.sql",
    );
    const sql = readFileSync(sqlPath, "utf8");
    for (const action of Object.keys(PERMISSIONS) as PermissionAction[]) {
      // Each action key is matched by a `WHEN '<action>' THEN` arm.
      const expected = `WHEN '${action}' THEN`;
      expect(sql).toContain(expected);
    }
  });

  it("every TABLE_WRITE_ACTION mapping is present in action_for_table", () => {
    const sqlPath = join(
      __dirname,
      "..",
      "..",
      "supabase",
      "migrations",
      "2026_04_26_slice_m_role_writes.sql",
    );
    const sql = readFileSync(sqlPath, "utf8");
    for (const [table, action] of Object.entries(TABLE_WRITE_ACTION)) {
      const expected = `WHEN '${table}' THEN '${action}'`;
      expect(sql).toContain(expected);
    }
  });
});
