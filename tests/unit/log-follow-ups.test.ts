import { describe, it, expect } from "vitest";
import { generateFollowUps } from "~/lib/log/follow-ups";
import type { DirectFileResult } from "~/lib/log/direct-file";
import type { Appointment } from "~/types/appointment";
import type { CareTeamMember } from "~/types/care-team";

const TODAY = "2026-05-06";

function lab(glucose: number): DirectFileResult {
  return {
    kind: "lab",
    date: TODAY,
    patch: {
      date: TODAY,
      glucose,
      source: "patient_self_report",
    },
    summary: { en: `Blood glucose — ${glucose}`, zh: `血糖 —— ${glucose}` },
    icon: "lab",
  };
}

function daily(patch: Record<string, unknown>): DirectFileResult {
  return {
    kind: "daily",
    date: TODAY,
    patch: patch as DirectFileResult["patch"],
    summary: { en: "", zh: "" },
    icon: "daily",
  };
}

const team: CareTeamMember[] = [
  {
    id: 1,
    name: "Sumi",
    role: "nurse",
    is_lead: true,
    phone: "+61 400 111 222",
    created_at: TODAY,
    updated_at: TODAY,
  },
  {
    id: 2,
    name: "Dr Lee",
    role: "oncologist",
    is_lead: true,
    email: "dr.lee@example.com",
    created_at: TODAY,
    updated_at: TODAY,
  },
];

const clinic: Appointment = {
  id: 99,
  kind: "clinic",
  title: "Oncology review",
  starts_at: "2026-05-10T09:00:00+10:00",
  status: "scheduled",
  created_at: TODAY,
  updated_at: TODAY,
};

describe("generateFollowUps", () => {
  it("escalates glucose ≥ 11.1 with a message-nurse + clinic + dietician triad", () => {
    const r = generateFollowUps({ filed: lab(12.4), team, nextClinic: clinic });
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe("urgent");
    const kinds = r[0]!.actions.map((a) => a.kind);
    expect(kinds).toContain("message_care_team");
    expect(kinds).toContain("add_to_clinic");
    expect(kinds).toContain("engage_agent");
    const msg = r[0]!.actions.find((a) => a.kind === "message_care_team")!;
    if (msg.kind === "message_care_team") {
      expect(msg.channel).toBe("sms");
      expect(msg.target).toMatch(/^sms:\+61/);
    }
  });

  it("flags glucose 7.8–11.0 as watch, adds to clinic + dietician (no nurse message)", () => {
    const r = generateFollowUps({ filed: lab(8.2), team, nextClinic: clinic });
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe("watch");
    const kinds = r[0]!.actions.map((a) => a.kind);
    expect(kinds).toContain("add_to_clinic");
    expect(kinds).toContain("engage_agent");
    expect(kinds).not.toContain("message_care_team");
  });

  it("ignores a normal glucose (4.0–7.7)", () => {
    const r = generateFollowUps({ filed: lab(5.6), team, nextClinic: clinic });
    expect(r).toHaveLength(0);
  });

  it("escalates hypoglycaemia < 4.0 with a message-nurse action", () => {
    const r = generateFollowUps({ filed: lab(3.2), team, nextClinic: clinic });
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe("urgent");
    expect(r[0]!.actions.map((a) => a.kind)).toContain("message_care_team");
  });

  it("flags fever ≥ 38 as urgent with a nurse-message action", () => {
    const r = generateFollowUps({
      filed: daily({ fever_temp: 38.6, fever: true }),
      team,
      nextClinic: clinic,
    });
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe("urgent");
    expect(r[0]!.actions[0]!.kind).toBe("message_care_team");
  });

  it("files weight as a routine clinic discussion item", () => {
    const r = generateFollowUps({
      filed: daily({ weight_kg: 64.5 }),
      team,
      nextClinic: clinic,
    });
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe("routine");
    expect(r[0]!.actions[0]!.kind).toBe("add_to_clinic");
  });

  it("skips Message-nurse actions when the care-team has no phone or email", () => {
    const teamNoContact: CareTeamMember[] = [
      {
        id: 1,
        name: "Sumi",
        role: "nurse",
        is_lead: true,
        created_at: TODAY,
        updated_at: TODAY,
      },
    ];
    const r = generateFollowUps({
      filed: lab(12.1),
      team: teamNoContact,
      nextClinic: clinic,
    });
    expect(r[0]!.actions.map((a) => a.kind)).not.toContain("message_care_team");
  });

  it("falls back to email when phone is missing", () => {
    const teamEmail: CareTeamMember[] = [
      {
        id: 1,
        name: "Dr Lee",
        role: "oncologist",
        is_lead: true,
        email: "dr.lee@example.com",
        created_at: TODAY,
        updated_at: TODAY,
      },
    ];
    const r = generateFollowUps({
      filed: lab(12.1),
      team: teamEmail,
      nextClinic: clinic,
    });
    const msg = r[0]!.actions.find((a) => a.kind === "message_care_team");
    expect(msg).toBeDefined();
    if (msg?.kind === "message_care_team") {
      expect(msg.channel).toBe("email");
      expect(msg.target).toMatch(/^mailto:dr\.lee@/);
    }
  });

  it("skips Add-to-clinic actions when no upcoming clinic appointment is supplied", () => {
    const r = generateFollowUps({ filed: lab(8.2), team });
    // Only engage_agent remains — no clinic to add to.
    expect(r[0]!.actions.map((a) => a.kind)).toEqual(["engage_agent"]);
  });
});
