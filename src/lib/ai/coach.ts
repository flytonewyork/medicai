import type { ComprehensiveAssessment } from "~/types/clinical";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";
import {
  FALLBACK_HOUSEHOLD_PROFILE,
  type HouseholdProfile,
} from "~/types/household-profile";
import { postJson } from "~/lib/utils/http";

export interface CoachContext {
  stepKey: string;
  stepTitle: string;
  stepInstructions: string;
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export function buildCoachSystem(
  profile: HouseholdProfile = FALLBACK_HOUSEHOLD_PROFILE,
): string {
  const onc = profile.oncologist_name ?? "the patient's oncologist";
  return `You are a warm, measured clinical assistant embedded in Anchor, a function-preservation platform for ${profile.patient_initials} — a patient with ${profile.diagnosis_full}, bridging to daraxonrasib (RMC-6236).

Your job in the comprehensive assessment wizard is to guide ${profile.patient_initials} or their caregiver through each step. You:
1. Answer practical "how do I do this?" questions about the current test.
2. Reassure without dismissing ("this might feel odd — that's OK" rather than "you're doing great").
3. If the user reports something concerning (severe pain, fever, new neurological symptoms, suicidal thoughts), gently flag it and advise contacting ${onc}'s team or attending hospital.
4. Stay grounded. No cheerleading language, no emoji. Match the patient's tone.
5. Keep responses short (2–4 sentences for most questions). Longer only for explicit "explain more".
6. Respond in the language you're spoken to (English or 简体中文).

You can see the current wizard step, its title, and the printed instructions. Use that context. If a question is outside the assessment, politely redirect.

Never invent clinical advice beyond what's safe for patient self-direction. Defer specific medical decisions to ${onc}.`;
}

export function buildSummarySystem(
  profile: HouseholdProfile = FALLBACK_HOUSEHOLD_PROFILE,
): string {
  const onc = profile.oncologist_name ?? "the oncologist";
  return `You summarise a single comprehensive baseline assessment for ${profile.patient_initials}'s ${profile.diagnosis_short} platform in two voices — one for ${profile.patient_initials} themselves, one for the clinical team. Both are under 120 words each. The patient summary is warm, plain-language, honest, and highlights one or two things to pay attention to. The clinician summary is clinical, focused on deltas from baseline where applicable, flags any red/orange pillar, and lists up to 3 discussion points for the next ${onc} visit.

Respond ONLY with JSON: {"patient": "...", "clinician": "..."}`;
}

export async function askCoach({
  model = DEFAULT_AI_MODEL,
  context,
  history,
  locale = "en",
}: {
  model?: string;
  context: CoachContext;
  history: CoachMessage[];
  locale?: "en" | "zh";
}): Promise<string> {
  const data = await postJson<{ reply: string }>("/api/ai/coach", {
    model,
    context,
    history,
    locale,
  });
  return data.reply;
}

export interface AssessmentSummary {
  patient: string;
  clinician: string;
}

export async function summariseAssessment({
  model = DEFAULT_AI_MODEL,
  assessment,
  priorAssessment,
}: {
  model?: string;
  assessment: ComprehensiveAssessment;
  priorAssessment?: ComprehensiveAssessment | null;
}): Promise<AssessmentSummary> {
  const data = await postJson<{ result: AssessmentSummary }>(
    "/api/ai/assessment-summary",
    {
      model,
      assessment: compactPayload(assessment),
      prior_assessment: priorAssessment ? compactPayload(priorAssessment) : null,
    },
  );
  return data.result;
}

function compactPayload(
  a: ComprehensiveAssessment,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === null) continue;
    if (k === "created_at" || k === "updated_at") continue;
    out[k] = v;
  }
  return out;
}
