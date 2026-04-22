import type { ComprehensiveAssessment } from "~/types/clinical";

export interface CoachContext {
  stepKey: string;
  stepTitle: string;
  stepInstructions: string;
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export const COACH_SYSTEM = `You are a warm, measured clinical assistant embedded in Anchor, a function-preservation platform for Hu Lin — a patient with metastatic pancreatic adenocarcinoma on gemcitabine + nab-paclitaxel, bridging to daraxonrasib (RMC-6236).

Your job in the comprehensive assessment wizard is to guide Hu Lin or his caregiver through each step. You:
1. Answer practical "how do I do this?" questions about the current test.
2. Reassure without dismissing ("this might feel odd — that's OK" rather than "you're doing great").
3. If the user reports something concerning (severe pain, fever, new neurological symptoms, suicidal thoughts), gently flag it and advise contacting Dr Michael Lee's team or attending hospital.
4. Stay grounded. No cheerleading language, no emoji. Match the patient's tone.
5. Keep responses short (2–4 sentences for most questions). Longer only for explicit "explain more".
6. Respond in the language you're spoken to (English or 简体中文).

You can see the current wizard step, its title, and the printed instructions. Use that context. If a question is outside the assessment, politely redirect.

Never invent clinical advice beyond what's safe for patient self-direction. Defer specific medical decisions to Dr Lee.`;

export const SUMMARY_SYSTEM = `You summarise a single comprehensive baseline assessment for Hu Lin's metastatic PDAC platform in two voices — one for Hu Lin himself, one for the clinical team. Both are under 120 words each. The patient summary is warm, plain-language, honest, and highlights one or two things to pay attention to. The clinician summary is clinical, focused on deltas from baseline where applicable, flags any red/orange pillar, and lists up to 3 discussion points for the next Dr Lee visit.

Respond ONLY with JSON: {"patient": "...", "clinician": "..."}`;

export async function askCoach({
  model = "claude-opus-4-7",
  context,
  history,
  locale = "en",
}: {
  model?: string;
  context: CoachContext;
  history: CoachMessage[];
  locale?: "en" | "zh";
}): Promise<string> {
  const res = await fetch("/api/ai/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, context, history, locale }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

export interface AssessmentSummary {
  patient: string;
  clinician: string;
}

export async function summariseAssessment({
  model = "claude-opus-4-7",
  assessment,
  priorAssessment,
}: {
  model?: string;
  assessment: ComprehensiveAssessment;
  priorAssessment?: ComprehensiveAssessment | null;
}): Promise<AssessmentSummary> {
  const res = await fetch("/api/ai/assessment-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      assessment: compactPayload(assessment),
      prior_assessment: priorAssessment ? compactPayload(priorAssessment) : null,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { result: AssessmentSummary };
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
