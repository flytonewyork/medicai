"use client";

import { useHousehold } from "./use-household";
import { can, type PermissionAction } from "~/lib/auth/permissions";

// Thin wrapper so components can check permissions without threading
// membership + permissions imports through their props. Returns
// `false` while membership is still loading — UI should render the
// permission-off state until the role is known.
//
// Example:
//   const canEditPlan = useCan("edit_treatment_plan");
//   <Button disabled={!canEditPlan}>Edit</Button>

export function useCan(action: PermissionAction): boolean {
  const { membership } = useHousehold();
  if (membership === undefined) return false;
  return can(membership?.role ?? null, action);
}
