"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useHousehold } from "~/hooks/use-household";
import type { HouseholdRole } from "~/types/household";

export type AppPerspective = "patient" | "caregiver" | "clinician";

const CAREGIVER_ROLES: readonly HouseholdRole[] = [
  "family",
  "clinician",
  "observer",
];

// Single source of truth for "what kind of user is this?" when we need
// to fork UI on role. Reads:
//   (1) Supabase household membership.role when available — authoritative
//       once the user has joined a household.
//   (2) Dexie settings.user_type as a fallback — captures the choice
//       made during local-first onboarding before any Supabase sign-in.
//   (3) `"patient"` as the default when nothing is set — keeps the
//       existing single-user install behaviour.
export function useAppPerspective(): AppPerspective {
  const { membership } = useHousehold();
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);

  if (membership?.role) {
    if (membership.role === "primary_carer" || membership.role === "patient") {
      // Primary carer still sees the full dashboard — they act as the
      // patient's proxy when the patient isn't present. Only non-primary
      // family / clinician / observer roles get the caregiver shell.
      return "patient";
    }
    if (CAREGIVER_ROLES.includes(membership.role)) {
      return membership.role === "clinician" ? "clinician" : "caregiver";
    }
  }

  const userType = settings?.[0]?.user_type;
  if (userType === "caregiver") return "caregiver";
  if (userType === "clinician") return "clinician";
  return "patient";
}

// Synchronous variant for non-React callers (route guards, narrative
// builders). Uses only the Dexie settings row — misses Supabase-only
// caregivers, which is fine for guards since they'd already be
// redirected to /family by the root dashboard effect.
export function perspectiveFromSettings(
  userType: string | undefined,
): AppPerspective {
  if (userType === "caregiver") return "caregiver";
  if (userType === "clinician") return "clinician";
  return "patient";
}
