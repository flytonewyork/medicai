// Rule-based follow-up engine. When a direct-filed value lands (glucose,
// weight, temperature, ...), this turns it into a ranked list of
// "next steps" — things the system can either do automatically (add to
// the next clinic's discussion items, surface in the feed) or offer to
// the user as a one-tap action (message the lead oncology nurse, engage
// the dietician agent).
//
// Kept deliberately rule-based and cheap to run — no LLM round-trip for
// the common cases. More nuanced reasoning can be layered later by
// invoking a specialist agent when the rules flag an ambiguous case.

import type { DirectFileResult } from "./direct-file";
import type { AppointmentDiscussionItem } from "~/types/appointment";
import type { Appointment } from "~/types/appointment";
import type { CareTeamMember } from "~/types/care-team";
import type { LocalizedText } from "~/types/localized";

export type FollowUpSeverity = "routine" | "watch" | "urgent";

export interface FollowUpItem {
  id: string;
  severity: FollowUpSeverity;
  title: LocalizedText;
  body: LocalizedText;
  actions: FollowUpAction[];
}

export type FollowUpAction =
  | {
      kind: "add_to_clinic";
      appointment_id: number;
      text: string;
      label: LocalizedText;
    }
  | {
      kind: "message_care_team";
      member_id: number;
      channel: "phone" | "sms" | "email";
      target: string;          // tel:+…, sms:+…, mailto:…
      draft?: string;
      label: LocalizedText;
    }
  | {
      kind: "engage_agent";
      agent_id: "nutrition" | "toxicity" | "clinical" | "psychology" | "rehabilitation" | "treatment";
      prompt: string;
      label: LocalizedText;
    };

function slug(s: string): string {
  return Math.random().toString(36).slice(2, 8) + "-" + s.slice(0, 8);
}

function leadMemberByRole(
  team: CareTeamMember[],
  roles: Array<CareTeamMember["role"]>,
): CareTeamMember | undefined {
  for (const role of roles) {
    const hit = team.find((m) => m.role === role && m.is_lead);
    if (hit) return hit;
  }
  for (const role of roles) {
    const hit = team.find((m) => m.role === role);
    if (hit) return hit;
  }
  return undefined;
}

function messageAction(
  member: CareTeamMember | undefined,
  draft: string,
  locale: "en" | "zh",
): FollowUpAction | null {
  if (!member?.id) return null;
  if (member.phone) {
    return {
      kind: "message_care_team",
      member_id: member.id,
      channel: "sms",
      target: `sms:${member.phone.replace(/\s+/g, "")}?body=${encodeURIComponent(
        draft,
      )}`,
      draft,
      label: {
        en: `Message ${member.name}`,
        zh: `发短信给 ${member.name}`,
      },
    };
  }
  if (member.email) {
    return {
      kind: "message_care_team",
      member_id: member.id,
      channel: "email",
      target: `mailto:${member.email}?body=${encodeURIComponent(draft)}`,
      draft,
      label: {
        en: `Email ${member.name}`,
        zh: `发邮件给 ${member.name}`,
      },
    };
  }
  return null;
}

function addToClinicAction(
  clinic: Appointment | undefined,
  text: string,
): FollowUpAction | null {
  if (!clinic?.id) return null;
  return {
    kind: "add_to_clinic",
    appointment_id: clinic.id,
    text,
    label: {
      en: "Add to next clinic",
      zh: "加入下次就诊议题",
    },
  };
}

export interface GenerateArgs {
  filed: DirectFileResult;
  team: CareTeamMember[];
  nextClinic?: Appointment;
  locale?: "en" | "zh";
}

export function generateFollowUps(args: GenerateArgs): FollowUpItem[] {
  const { filed, team, nextClinic, locale = "en" } = args;
  const out: FollowUpItem[] = [];

  // -------- Blood glucose ----------------------------------------------
  if (filed.kind === "lab" && typeof filed.patch.glucose === "number") {
    const g = filed.patch.glucose;
    if (g >= 11.1) {
      const nurse = leadMemberByRole(team, ["nurse", "oncologist", "gp"]);
      const actions: FollowUpAction[] = [];
      const msg = messageAction(
        nurse,
        `The patient's blood glucose is ${g} mmol/L (hyperglycaemia). Asking whether to do anything today.`,
        locale,
      );
      if (msg) actions.push(msg);
      const clinic = addToClinicAction(
        nextClinic,
        `Hyperglycaemia ${g} mmol/L on ${filed.date}`,
      );
      if (clinic) actions.push(clinic);
      actions.push({
        kind: "engage_agent",
        agent_id: "nutrition",
        prompt: `Glucose ${g} mmol/L logged on ${filed.date}. Suggest a response and whether diet changes are warranted given current chemo cycle.`,
        label: { en: "Engage dietician", zh: "请营养师关注" },
      });
      out.push({
        id: slug("gluc-hi"),
        severity: "urgent",
        title: {
          en: `High blood glucose — ${g} mmol/L`,
          zh: `血糖偏高 —— ${g} mmol/L`,
        },
        body: {
          en: "Above 11 is in the call-your-team range. Reach out today, flag at the next clinic.",
          zh: "超过 11 属于需当天联系医疗团队的范围。今日联系,并在下次就诊时提出。",
        },
        actions,
      });
    } else if (g >= 7.8) {
      const actions: FollowUpAction[] = [];
      const clinic = addToClinicAction(
        nextClinic,
        `Fasting / random glucose ${g} on ${filed.date}`,
      );
      if (clinic) actions.push(clinic);
      actions.push({
        kind: "engage_agent",
        agent_id: "nutrition",
        prompt: `Glucose ${g} mmol/L logged on ${filed.date}. Worth raising with dietician?`,
        label: { en: "Engage dietician", zh: "请营养师关注" },
      });
      out.push({
        id: slug("gluc-mid"),
        severity: "watch",
        title: {
          en: `Elevated blood glucose — ${g} mmol/L`,
          zh: `血糖升高 —— ${g} mmol/L`,
        },
        body: {
          en: "Above 7.8 isn't urgent but worth raising at the next clinic and flagging to the dietician.",
          zh: "高于 7.8 并非急症,但值得在下次就诊提出,并告知营养师。",
        },
        actions,
      });
    } else if (g < 4.0) {
      const nurse = leadMemberByRole(team, ["nurse", "oncologist", "gp"]);
      const actions: FollowUpAction[] = [];
      const msg = messageAction(
        nurse,
        `The patient's blood glucose is ${g} mmol/L (hypoglycaemia). Checking on next steps.`,
        locale,
      );
      if (msg) actions.push(msg);
      out.push({
        id: slug("gluc-lo"),
        severity: "urgent",
        title: {
          en: `Low blood glucose — ${g} mmol/L`,
          zh: `低血糖 —— ${g} mmol/L`,
        },
        body: {
          en: "Below 4.0 — treat the low first (15 g fast carbs), then contact the team.",
          zh: "低于 4.0 —— 先处理低血糖(15 g 快速碳水),再联系团队。",
        },
        actions,
      });
    }
  }

  // -------- Temperature ------------------------------------------------
  if (
    filed.kind === "daily" &&
    typeof filed.patch.fever_temp === "number" &&
    filed.patch.fever_temp >= 38
  ) {
    const nurse = leadMemberByRole(team, ["nurse", "oncologist"]);
    const actions: FollowUpAction[] = [];
    const msg = messageAction(
      nurse,
      `The patient has a fever of ${filed.patch.fever_temp}°C on ${filed.date}.`,
      locale,
    );
    if (msg) actions.push(msg);
    out.push({
      id: slug("fever"),
      severity: "urgent",
      title: {
        en: `Fever — ${filed.patch.fever_temp}°C`,
        zh: `发热 —— ${filed.patch.fever_temp}°C`,
      },
      body: {
        en: "On chemo, ≥38°C is oncology-emergency territory if neutropenic. Call the oncology line now.",
        zh: "化疗期间 ≥38°C,若有中性粒细胞减少即为肿瘤急症。立即联系肿瘤科。",
      },
      actions,
    });
  }

  // -------- Weight -----------------------------------------------------
  // Direct-file only knows today's number, not a trend. Flag the clinic
  // so the weight is reviewed against baselines on the next visit.
  if (filed.kind === "daily" && typeof filed.patch.weight_kg === "number") {
    const clinic = addToClinicAction(
      nextClinic,
      `Weight ${filed.patch.weight_kg} kg on ${filed.date}`,
    );
    if (clinic) {
      out.push({
        id: slug("weight"),
        severity: "routine",
        title: {
          en: `Weight — ${filed.patch.weight_kg} kg`,
          zh: `体重 —— ${filed.patch.weight_kg} kg`,
        },
        body: {
          en: "Added as a discussion point for the next clinic so the trend is reviewed against baseline.",
          zh: "已作为下次就诊讨论项加入,以便与基线比对。",
        },
        actions: [clinic],
      });
    }
  }

  return out;
}
