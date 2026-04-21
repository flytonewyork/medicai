"use client";

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

const COACH_SYSTEM = `You are a warm, measured clinical assistant embedded in Anchor, a function-preservation platform for Hu Lin — a patient with metastatic pancreatic adenocarcinoma on gemcitabine + nab-paclitaxel, bridging to daraxonrasib (RMC-6236).

Your job in the comprehensive assessment wizard is to guide Hu Lin or his caregiver through each step. You:
1. Answer practical "how do I do this?" questions about the current test.
2. Reassure without dismissing ("this might feel odd — that's OK" rather than "you're doing great").
3. If the user reports something concerning (severe pain, fever, new neurological symptoms, suicidal thoughts), gently flag it and advise contacting Dr Michael Lee's team or attending hospital.
4. Stay grounded. No cheerleading language, no emoji. Match the patient's tone.
5. Keep responses short (2–4 sentences for most questions). Longer only for explicit "explain more".
6. Respond in the language you're spoken to (English or 简体中文).

You can see the current wizard step, its title, and the printed instructions. Use that context. If a question is outside the assessment, politely redirect.

Never invent clinical advice beyond what's safe for patient self-direction. Defer specific medical decisions to Dr Lee.`;

const SUMMARY_SYSTEM = `You summarise a single comprehensive baseline assessment for Hu Lin's metastatic PDAC platform in two voices — one for Hu Lin himself, one for the clinical team. Both are under 120 words each. The patient summary is warm, plain-language, honest, and highlights one or two things to pay attention to. The clinician summary is clinical, focused on deltas from baseline where applicable, flags any red/orange pillar, and lists up to 3 discussion points for the next Dr Lee visit.

Respond ONLY with JSON: {"patient": "...", "clinician": "..."}`;

export async function askCoach({
  apiKey,
  model = "claude-opus-4-7",
  context,
  history,
  locale = "en",
}: {
  apiKey: string;
  model?: string;
  context: CoachContext;
  history: CoachMessage[];
  locale?: "en" | "zh";
}): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const contextBlock = `Current step: ${context.stepTitle}\nKey: ${context.stepKey}\nInstructions shown to the user:\n${context.stepInstructions}\n\nRespond in ${locale === "zh" ? "Simplified Chinese (简体中文)" : "English"}.`;

  const response = await client.messages.create({
    model,
    max_tokens: 600,
    system: [
      {
        type: "text",
        text: COACH_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: contextBlock },
    ],
    messages: history.map((m) => ({
      role: m.role,
      content: [{ type: "text", text: m.content }],
    })),
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Empty response from coach");
  }
  return block.text;
}

export interface AssessmentSummary {
  patient: string;
  clinician: string;
}

export async function summariseAssessment({
  apiKey,
  model = "claude-opus-4-7",
  assessment,
  priorAssessment,
}: {
  apiKey: string;
  model?: string;
  assessment: ComprehensiveAssessment;
  priorAssessment?: ComprehensiveAssessment | null;
}): Promise<AssessmentSummary> {
  const [{ default: Anthropic }, { z }, { zodOutputFormat }] =
    await Promise.all([
      import("@anthropic-ai/sdk"),
      import("zod"),
      import("@anthropic-ai/sdk/helpers/zod"),
    ]);

  const SummarySchema = z.object({
    patient: z.string(),
    clinician: z.string(),
  });

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const payload = {
    assessment: compactPayload(assessment),
    prior_assessment: priorAssessment ? compactPayload(priorAssessment) : null,
  };

  const response = await client.messages.parse({
    model,
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: SUMMARY_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: zodOutputFormat(SummarySchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify(payload),
          },
        ],
      },
    ],
  });

  if (!response.parsed_output) throw new Error("No summary returned");
  return response.parsed_output;
}

// Strip undefined fields before sending to minimise tokens and PHI footprint.
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
