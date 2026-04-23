import { describe, expect, it } from "vitest";
import {
  ACTION_LABEL,
  PERMISSIONS,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
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
      "edit_treatment_plan",
      "edit_medications",
      "edit_appointments",
      "log_daily_checkin",
      "log_clinical_note",
      "quick_note_family",
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

  it("patient can edit own medications + log check-ins but not treatment plan", () => {
    expect(can("patient", "log_daily_checkin")).toBe(true);
    expect(can("patient", "edit_medications")).toBe(true);
    expect(can("patient", "edit_treatment_plan")).toBe(false);
    expect(can("patient", "invite_members")).toBe(false);
  });

  it("only primary_carer sees pending invites", () => {
    for (const role of ROLES) {
      expect(can(role, "see_pending_invites")).toBe(role === "primary_carer");
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
