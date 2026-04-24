import { db, now } from "~/lib/db/dexie";
import type { CareTeamMember, CareTeamRole } from "~/types/care-team";

// Thin CRUD + query helpers over the `care_team` Dexie table. Kept
// plain so the Settings UI, the appointment form, and the emergency
// card all use the same surface.

export async function listCareTeam(): Promise<CareTeamMember[]> {
  return db.care_team.orderBy("name").toArray();
}

// Look up the local care-team row that represents a Supabase auth account,
// either by account_user_id (when previously linked) or by email match.
export async function findCareTeamMemberForAccount(args: {
  user_id?: string | null;
  email?: string | null;
}): Promise<CareTeamMember | undefined> {
  const all = await db.care_team.toArray();
  if (args.user_id) {
    const byId = all.find((m) => m.account_user_id === args.user_id);
    if (byId) return byId;
  }
  if (args.email) {
    const e = args.email.trim().toLowerCase();
    const byEmail = all.find(
      (m) => (m.email ?? "").trim().toLowerCase() === e,
    );
    if (byEmail) return byEmail;
  }
  return undefined;
}

export async function addCareTeamMember(
  input: Omit<CareTeamMember, "id" | "created_at" | "updated_at">,
): Promise<number> {
  const ts = now();
  const id = await db.care_team.add({
    ...input,
    created_at: ts,
    updated_at: ts,
  });
  if (input.is_lead) {
    await unmarkOtherLeadsForRole(input.role, id);
  }
  return id as number;
}

export async function updateCareTeamMember(
  id: number,
  patch: Partial<CareTeamMember>,
): Promise<void> {
  await db.care_team.update(id, { ...patch, updated_at: now() });
  if (patch.is_lead && patch.role) {
    await unmarkOtherLeadsForRole(patch.role, id);
  } else if (patch.is_lead) {
    const row = await db.care_team.get(id);
    if (row) await unmarkOtherLeadsForRole(row.role, id);
  }
}

export async function removeCareTeamMember(id: number): Promise<void> {
  await db.care_team.delete(id);
}

export async function getLeadForRole(
  role: CareTeamRole,
): Promise<CareTeamMember | undefined> {
  const rows = await db.care_team
    .where("role")
    .equals(role)
    .and((r) => Boolean(r.is_lead))
    .toArray();
  return rows[0];
}

// When a member is flagged as lead, any prior lead in the same role
// gets un-flagged. One-lead-per-role keeps downstream UI
// (emergency card picks "the" oncologist) unambiguous.
async function unmarkOtherLeadsForRole(
  role: CareTeamRole,
  keepId: number,
): Promise<void> {
  const others = await db.care_team
    .where("role")
    .equals(role)
    .and((r) => Boolean(r.is_lead) && r.id !== keepId)
    .toArray();
  const ts = now();
  await Promise.all(
    others.map((o) =>
      o.id != null
        ? db.care_team.update(o.id, { is_lead: false, updated_at: ts })
        : Promise.resolve(),
    ),
  );
}

// One-time hydrate: if the user has a legacy `managing_oncologist` in
// settings but no care-team rows exist yet, seed the registry from it so
// existing data carries forward. Called from the Settings page on mount.
export async function hydrateFromLegacySettings(args: {
  managing_oncologist?: string;
  managing_oncologist_phone?: string;
  hospital_name?: string;
}): Promise<void> {
  const existing = await db.care_team.count();
  if (existing > 0) return;
  if (!args.managing_oncologist?.trim()) return;
  await addCareTeamMember({
    name: args.managing_oncologist.trim(),
    role: "oncologist",
    organisation: args.hospital_name?.trim() || undefined,
    phone: args.managing_oncologist_phone?.trim() || undefined,
    is_lead: true,
  });
}

// Case-insensitive lookup: given a free-text name from an appointment's
// `attendees[]`, return the matching registry row if any. Lets the UI
// show a role badge and phone link without storing a foreign key.
export function matchMemberByName(
  name: string,
  members: readonly CareTeamMember[],
): CareTeamMember | undefined {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  return members.find((m) => m.name.trim().toLowerCase() === target);
}
