"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppPerspective } from "./scope";

// Hook for pages that are patient-only (daily wizard, weekly/fortnightly,
// new treatment cycle, assessment wizard). Caregivers hitting them
// directly get bounced to /family. Patient path is untouched.
//
// Does nothing until perspective resolves, so we never redirect in the
// brief window before Supabase auth + Dexie settings hydrate.
export function useRedirectCaregiverAway(to: string = "/family"): void {
  const perspective = useAppPerspective();
  const router = useRouter();
  useEffect(() => {
    if (perspective === "caregiver" || perspective === "clinician") {
      router.replace(to);
    }
  }, [perspective, router, to]);
}
