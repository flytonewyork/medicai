import { db } from "~/lib/db/dexie";
import type { CareTeamMember, CareTeamRole } from "~/types/care-team";

export interface ReadCareTeamInput {
  role?: CareTeamRole;
}

export interface ReadCareTeamOutput {
  rows: Array<
    Pick<
      CareTeamMember,
      | "id"
      | "name"
      | "role"
      | "specialty"
      | "organisation"
      | "phone"
      | "email"
      | "is_lead"
    >
  >;
  total_matched: number;
}

export async function readCareTeamHandler(
  input: ReadCareTeamInput,
): Promise<ReadCareTeamOutput> {
  let rows = await db.care_team.toArray();
  if (input.role) rows = rows.filter((m) => m.role === input.role);
  // Leads first within each role — agent usually wants the lead by default.
  rows = rows.sort((a, b) => Number(b.is_lead) - Number(a.is_lead));
  return {
    rows: rows.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      specialty: m.specialty,
      organisation: m.organisation,
      phone: m.phone,
      email: m.email,
      is_lead: m.is_lead,
    })),
    total_matched: rows.length,
  };
}
