import { getSupabaseBrowser } from "./client";
import type {
  Household,
  HouseholdInvite,
  HouseholdMembership,
  HouseholdMemberWithProfile,
  HouseholdRole,
  HouseholdSummary,
  InvitePreview,
  InvitePreviewStatus,
  Profile,
} from "~/types/household";

// Thin wrappers over Supabase RPC + table queries for the Slice A
// household + profile + invite surface. Every function is a no-op
// returning null/empty when Supabase isn't configured, so local-only
// sessions keep working.
//
// All "current user" lookups go through `currentUserId` instead of
// calling `sb.auth.getUser()` directly. `getUser()` makes a network
// call to /auth/v1/user and can hang on poor / Capacitor / iOS
// network conditions, leaving `useHousehold` permanently in the
// loading state. `getSession()` reads from local storage and is
// instant — RLS on the server is what actually authenticates the
// query, so a stale session token here is harmless: a failed query
// surfaces as an error from the RLS check, not a silent hang.

async function currentUserId(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function getCurrentMembership(): Promise<HouseholdMembership | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const uid = await currentUserId();
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
  const uid = await currentUserId();
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
  const uid = await currentUserId();
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

// Idempotent bootstrap. The user-story bug: a patient who self-onboarded
// offline has `settings.onboarded_at` set but never reached the
// `createHousehold` step in `onboarding/page.tsx` (it only fires when a
// Supabase session is already present). When they later sign in to invite
// a carer, they have a profile but no membership — and rerunning
// onboarding bounces them back to `/` because `onboarded_at` is set.
// This helper closes that gap from anywhere: call it after sign-in or
// when the carer-invite UI needs a household, and it'll create one with
// the patient as primary_carer of their own care team. No-ops when:
//   - Supabase isn't configured
//   - the user isn't signed in
//   - the user already has a membership
//   - a `patientName` isn't supplied AND we can't infer one (we don't
//     want to seed `Patient`'s family blindly — caller passes the name)
//
// Returns the household id (existing or newly-created), or null when the
// no-op conditions hit. Throws on RPC error so the UI can surface it.
export async function ensureHouseholdForCurrentUser(args: {
  patientName: string;
}): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;
  const existing = await getCurrentMembership();
  if (existing?.household_id) return existing.household_id;
  const trimmed = args.patientName.trim();
  if (!trimmed) return null;
  return createHousehold({
    name: `${trimmed}'s care team`,
    patient_name: trimmed,
  });
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
  const uid = await currentUserId();
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
  const uid = await currentUserId();
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
  if (msg.includes("not_authenticated")) return "Please sign in first.";
  if (msg.includes("not_authorised"))
    return "Only the primary carer can do that.";
  // target_not_a_member is checked BEFORE not_a_member because the
  // latter is a substring of the former — flipping the order
  // misclassifies "the invitee" errors as "the caller" errors.
  if (msg.includes("target_not_a_member"))
    return "That person isn't a member of this household.";
  if (msg.includes("not_a_member"))
    return "You're not a member of this household.";
  if (msg.includes("last_primary_carer"))
    return "You can't change the role of the last primary carer — promote someone else first.";
  if (msg.includes("invalid_extension"))
    return "Invite extension must be between 1 and 90 days.";
  return msg;
}

// RPC: fetch a public preview of an invite token. Used by /invite/<token>
// to render trust copy ("You've been invited to the patient's care team as
// Family by Thomas") BEFORE bouncing an unauthenticated visitor to
// /login. Falls back to a not_found preview when Supabase isn't
// configured so the UI can still render an error state instead of
// blank-screening.
export async function getInvitePreview(
  token: string,
): Promise<InvitePreview> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    return {
      status: "not_found",
      household_name: null,
      patient_display_name: null,
      role: null,
      invited_by_name: null,
      expires_at: null,
      accepted_at: null,
      revoked_at: null,
    };
  }
  const { data, error } = await sb.rpc("get_invite_preview", {
    invite_token: token,
  });
  if (error) throw error;
  // Supabase returns rows from a SETOF / TABLE function as an array.
  // We expect zero or one row; pull the first or surface not_found.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      status: "not_found",
      household_name: null,
      patient_display_name: null,
      role: null,
      invited_by_name: null,
      expires_at: null,
      accepted_at: null,
      revoked_at: null,
    };
  }
  const r = row as {
    status: string;
    household_name: string | null;
    patient_display_name: string | null;
    role: HouseholdRole | null;
    invited_by_name: string | null;
    expires_at: string | null;
    accepted_at: string | null;
    revoked_at: string | null;
  };
  const status: InvitePreviewStatus =
    r.status === "active" ||
    r.status === "expired" ||
    r.status === "revoked" ||
    r.status === "accepted"
      ? r.status
      : "not_found";
  return {
    status,
    household_name: r.household_name,
    patient_display_name: r.patient_display_name,
    role: r.role,
    invited_by_name: r.invited_by_name,
    expires_at: r.expires_at,
    accepted_at: r.accepted_at,
    revoked_at: r.revoked_at,
  };
}

// RPC: change a member's role inside a household. Primary-carer-only.
// Refuses to demote the last primary_carer so the household can never
// be left without an admin.
export async function updateMemberRole(args: {
  household_id: string;
  user_id: string;
  new_role: HouseholdRole;
}): Promise<HouseholdRole> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("supabase_not_configured");
  const { data, error } = await sb.rpc("update_member_role", {
    target_household: args.household_id,
    target_user: args.user_id,
    new_role: args.new_role,
  });
  if (error) throw error;
  return data as HouseholdRole;
}

// RPC: extend an invite's expires_at by N days (default 14). Useful
// when a relative drags their feet — saves the carer from having to
// revoke + recreate + reshare a fresh URL.
export async function extendInviteExpiry(args: {
  invite_id: string;
  days?: number;
}): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("supabase_not_configured");
  const { data, error } = await sb.rpc("extend_invite_expiry", {
    target_invite: args.invite_id,
    days_to_add: args.days ?? 14,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("extend_invite_failed");
  return data;
}

// Bucket an invite's lifecycle for UI rendering. Single source of
// truth — keep CSS / copy keyed off this rather than scattering the
// `accepted_at && !revoked_at && expires_at > now` checks across a
// dozen components.
export type InviteStatusBucket =
  | "active"
  | "expired"
  | "accepted"
  | "revoked";

export function inviteStatusBucket(
  invite: Pick<HouseholdInvite, "accepted_at" | "revoked_at" | "expires_at">,
  now: Date = new Date(),
): InviteStatusBucket {
  if (invite.revoked_at) return "revoked";
  if (invite.accepted_at) return "accepted";
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

// Days until an invite expires, rounded down. Negative for already-
// expired invites. Used in the "expires in 12 days" hint copy.
export function daysUntilExpiry(
  expiresAt: string,
  now: Date = new Date(),
): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
