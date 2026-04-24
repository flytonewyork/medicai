import { getSupabaseBrowser } from "./client";
import type {
  Household,
  HouseholdInvite,
  HouseholdMembership,
  HouseholdMemberWithProfile,
  HouseholdRole,
  HouseholdSummary,
  Profile,
} from "~/types/household";

// Thin wrappers over Supabase RPC + table queries for the Slice A
// household + profile + invite surface. Every function is a no-op
// returning null/empty when Supabase isn't configured, so local-only
// sessions keep working.

export async function getCurrentMembership(): Promise<HouseholdMembership | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data: user } = await sb.auth.getUser();
  const uid = user.user?.id;
  if (!uid) return null;
  const { data, error } = await sb
    .from("household_memberships")
    .select("*")
    .eq("user_id", uid)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HouseholdMembership | null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data: user } = await sb.auth.getUser();
  const uid = user.user?.id;
  if (!uid) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateMyProfile(
  patch: Partial<
    Pick<
      Profile,
      | "display_name"
      | "locale"
      | "care_role_label"
      | "relationship"
      | "timezone"
      | "notification_preference"
    >
  >,
): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { data: user } = await sb.auth.getUser();
  const uid = user.user?.id;
  if (!uid) return;
  const { error } = await sb.from("profiles").update(patch).eq("id", uid);
  if (error) throw error;
}

// True if the carer / family member has at least filled the minimum fields
// the /family view needs to render a useful call-list (a display name + how
// they're related). Drives the post-invite welcome flow — if false, we
// route the user to /invite/welcome instead of straight to /family.
export function isProfileComplete(p: Profile | null): boolean {
  if (!p) return false;
  const hasName = !!p.display_name?.trim();
  const hasRelationship =
    !!p.relationship?.trim() || !!p.care_role_label?.trim();
  return hasName && hasRelationship;
}

export async function listHouseholdMembers(
  householdId: string,
): Promise<HouseholdMemberWithProfile[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb
    .from("household_memberships")
    .select(
      "household_id, user_id, role, invited_by, joined_at, profile:profiles!inner(*)",
    )
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as HouseholdMemberWithProfile[];
}

export async function getHousehold(
  householdId: string,
): Promise<Household | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data, error } = await sb
    .from("households")
    .select("*")
    .eq("id", householdId)
    .maybeSingle();
  if (error) throw error;
  return data as Household | null;
}

// RPC: create a household AND enrol the current user as primary_carer.
// Returns the new household id.
export async function createHousehold(args: {
  name: string;
  patient_name: string;
}): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("supabase_not_configured");
  const { data, error } = await sb.rpc("create_household", {
    household_name: args.name,
    patient_name: args.patient_name,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("create_household_failed");
  return data;
}

// PostgREST returns PGRST202 when the requested RPC isn't in its schema
// cache — typically because the caregiver-onboarding migration hasn't been
// applied (or applied without a cache reload). We surface this as a typed
// error so the picker UI can fall back to the invite-token flow with
// actionable copy instead of dumping the raw PostgREST message.
export class CaregiverPickerUnavailableError extends Error {
  readonly code = "caregiver_picker_unavailable";
  constructor(message = "Caregiver patient picker isn't available yet.") {
    super(message);
    this.name = "CaregiverPickerUnavailableError";
  }
}

function isMissingRpcError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "PGRST202" || e.code === "404") return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("could not find the function") ||
    msg.includes("schema cache") ||
    msg.includes("function public.list_all_households") ||
    msg.includes("function public.join_household_as_family")
  );
}

// RPC: list every household as a lightweight summary. Backed by the
// SECURITY DEFINER function `public.list_all_households` — lets
// caregiver onboarding show a patient picker without the caller being
// a member yet. Safe under the product assumption that "all patients
// are public within this family app"; tighten with a `discoverable`
// flag if that ever changes.
export async function listAllHouseholds(): Promise<HouseholdSummary[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb.rpc("list_all_households");
  if (error) {
    if (isMissingRpcError(error)) throw new CaregiverPickerUnavailableError();
    throw error;
  }
  return (data ?? []) as HouseholdSummary[];
}

// RPC: join an existing household as `family`. Idempotent — calls with
// a pre-existing membership return without writing.
export async function joinHouseholdAsFamily(
  householdId: string,
): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("supabase_not_configured");
  const { data, error } = await sb.rpc("join_household_as_family", {
    target_id: householdId,
  });
  if (error) {
    if (isMissingRpcError(error)) throw new CaregiverPickerUnavailableError();
    throw error;
  }
  if (typeof data !== "string") throw new Error("join_household_failed");
  return data;
}

// Pull the invite token out of a /invite/<token> URL the patient may have
// shared. Accepts bare tokens too. Returns null when nothing usable is
// present so the UI can keep the input controlled.
export function extractInviteToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Bare uuid (8-4-4-4-12) — accept as-is.
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  // /invite/<token> URL — pull the segment after /invite/.
  const match = trimmed.match(/\/invite\/([0-9a-fA-F-]{8,})/);
  if (match && match[1]) return match[1].toLowerCase();
  return null;
}

// RPC: accept an invite token, atomically creating a membership and
// marking the invite accepted. Returns the household id the user
// joined.
export async function acceptInvite(token: string): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("supabase_not_configured");
  const { data, error } = await sb.rpc("accept_household_invite", {
    invite_token: token,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("accept_invite_failed");
  return data;
}

export async function createInvite(args: {
  household_id: string;
  email_hint?: string;
  role: HouseholdRole;
}): Promise<HouseholdInvite> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("supabase_not_configured");
  const { data: user } = await sb.auth.getUser();
  const uid = user.user?.id;
  if (!uid) throw new Error("not_signed_in");
  const { data, error } = await sb
    .from("household_invites")
    .insert({
      household_id: args.household_id,
      email_hint: args.email_hint ?? null,
      role: args.role,
      invited_by: uid,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as HouseholdInvite;
}

export async function listInvites(
  householdId: string,
): Promise<HouseholdInvite[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb
    .from("household_invites")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HouseholdInvite[];
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { error } = await sb
    .from("household_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

export async function leaveHousehold(householdId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { data: user } = await sb.auth.getUser();
  const uid = user.user?.id;
  if (!uid) return;
  const { error } = await sb
    .from("household_memberships")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", uid);
  if (error) throw error;
}

export async function removeMember(args: {
  household_id: string;
  user_id: string;
}): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { error } = await sb
    .from("household_memberships")
    .delete()
    .eq("household_id", args.household_id)
    .eq("user_id", args.user_id);
  if (error) throw error;
}

// Builds the /invite/<token> URL from an invite record. The token is a
// uuid; no further secret required since access is already guarded by
// the expiry + accepted_at + revoked_at fields.
export function inviteUrl(token: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/invite/${token}`;
}

export function friendlyInviteError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("invite_not_found")) return "This invite link is invalid.";
  if (msg.includes("invite_revoked")) return "This invite has been revoked.";
  if (msg.includes("invite_already_accepted"))
    return "This invite has already been accepted.";
  if (msg.includes("invite_expired")) return "This invite has expired.";
  if (msg.includes("not_signed_in")) return "Please sign in first.";
  return msg;
}
