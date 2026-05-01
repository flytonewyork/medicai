import { getSupabaseServer } from "~/lib/supabase/server";
import {
  FALLBACK_HOUSEHOLD_PROFILE,
  type HouseholdProfile,
} from "~/types/household-profile";

// Server-side loader for the household profile that drives identity
// templating in AI system prompts and any other patient-specific
// runtime string. Falls back to the generic FALLBACK_HOUSEHOLD_PROFILE
// when:
//   - Supabase isn't configured
//   - the caller isn't in a household yet
//   - no row exists in `household_profile` (new install, never filled)
//
// Routes are responsible for calling requireSession() first; this
// helper is intentionally tolerant of `null` so the same code path
// works for the cron / unauthenticated edge cases.

const FIELDS = [
  "household_id",
  "patient_initials",
  "diagnosis_short",
  "diagnosis_full",
  "oncologist_name",
  "surgeon_name",
  "locale_default",
  "created_at",
  "updated_at",
].join(", ");

// Best-effort household lookup for routes that work pre-sign-in (per
// middleware.ts: parse-meal, parse-voice-memo, etc). Never throws —
// returns null on no session, no Supabase config, or schema error so
// callers fall through to FALLBACK_HOUSEHOLD_PROFILE. Routes that
// _require_ a session should use requireSession() instead.
export async function getOptionalHouseholdId(): Promise<string | null> {
  try {
    const sb = getSupabaseServer();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    if (!data?.user) return null;
    const { data: membership } = await sb
      .from("household_memberships")
      .select("household_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return (membership?.household_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function loadHouseholdProfile(
  household_id: string | null,
): Promise<HouseholdProfile> {
  if (!household_id) return FALLBACK_HOUSEHOLD_PROFILE;
  const sb = getSupabaseServer();
  if (!sb) return FALLBACK_HOUSEHOLD_PROFILE;
  const { data, error } = await sb
    .from("household_profile")
    .select(FIELDS)
    .eq("household_id", household_id)
    .maybeSingle();
  if (error || !data) return FALLBACK_HOUSEHOLD_PROFILE;
  return data as unknown as HouseholdProfile;
}

// Mustache-light renderer used by the role.md loader and any inline
// template that wants `{patient_initials}` / `{diagnosis_short}` /
// `{diagnosis_full}` / `{oncologist_name}` / `{surgeon_name}` tokens.
// Unknown tokens are left intact so tests can spot them.
export function renderProfileTemplate(
  template: string,
  profile: HouseholdProfile,
): string {
  return template
    .replaceAll("{patient_initials}", profile.patient_initials)
    .replaceAll("{diagnosis_short}", profile.diagnosis_short)
    .replaceAll("{diagnosis_full}", profile.diagnosis_full)
    .replaceAll(
      "{oncologist_name}",
      profile.oncologist_name ?? "the patient's oncologist",
    )
    .replaceAll(
      "{surgeon_name}",
      profile.surgeon_name ?? "the patient's surgeon",
    );
}
