"use client";

import { z } from "zod";

const LabsSchema = z.object({
  ca199: z.number().nullable().optional(),
  albumin: z.number().nullable().optional(),
  hemoglobin: z.number().nullable().optional(),
  neutrophils: z.number().nullable().optional(),
  platelets: z.number().nullable().optional(),
  creatinine: z.number().nullable().optional(),
  bilirubin: z.number().nullable().optional(),
  alt: z.number().nullable().optional(),
  ast: z.number().nullable().optional(),
  crp: z.number().nullable().optional(),
  magnesium: z.number().nullable().optional(),
  phosphate: z.number().nullable().optional(),
});

const ImagingSchema = z.object({
  date: z.string().nullable().optional(),
  modality: z.enum(["CT", "MRI", "PET", "US", "other"]).nullable().optional(),
  findings_summary: z.string().nullable().optional(),
  recist_status: z.enum(["CR", "PR", "SD", "PD"]).nullable().optional(),
});

const CtdnaSchema = z.object({
  date: z.string().nullable().optional(),
  platform: z
    .enum(["signatera", "natera", "guardant", "other"])
    .nullable()
    .optional(),
  detected: z.boolean().nullable().optional(),
  value: z.number().nullable().optional(),
});

export const ExtractionSchema = z.object({
  kind: z.enum([
    "lab_report",
    "imaging_report",
    "ctdna_report",
    "referral",
    "clinic_letter",
    "other",
  ]),
  document_date: z.string().nullable().optional(),
  labs: LabsSchema.nullable().optional(),
  imaging: ImagingSchema.nullable().optional(),
  ctdna: CtdnaSchema.nullable().optional(),
  summary: z.string(),
  pending_items: z
    .array(
      z.object({
        test_name: z.string(),
        category: z.enum([
          "imaging",
          "lab",
          "ctdna",
          "ngs",
          "referral",
          "other",
        ]),
      }),
    )
    .default([]),
});

export type ClaudeExtraction = z.infer<typeof ExtractionSchema>;

const SYSTEM_PROMPT = `You are a clinical document parser. You receive text extracted by OCR from a patient's medical document (lab report, radiology report, referral, clinic letter, or ctDNA result).

Your job is to extract structured fields into the given schema. Rules:
1. If a field is not present or unclear, omit it or set it to null. Never invent values.
2. Normalise lab values to SI units:
   - albumin, haemoglobin → g/L (multiply g/dL by 10)
   - creatinine → umol/L (multiply mg/dL by 88.4)
   - neutrophils → ×10^9/L
3. Dates must be ISO YYYY-MM-DD. If ambiguous (e.g. 03/04/2026), assume DD/MM/YYYY (Australian convention).
4. For imaging: include the IMPRESSION paragraph in findings_summary. RECIST status only if the radiologist explicitly states CR/PR/SD/PD.
5. Classify the document by 'kind'. Default to 'other' if unclear.
6. Write a one-sentence plain-language summary.
7. Extract 'pending_items' only for tests or referrals the document says are PLANNED — not the results in this document.`;

export async function extractWithClaude({
  apiKey,
  text,
  model = "claude-opus-4-7",
}: {
  apiKey: string;
  text: string;
  model?: string;
}): Promise<ClaudeExtraction> {
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/zod"),
  ]);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.parse({
    model,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract structured fields from the following OCR text:\n\n---\n${text}\n---`,
          },
        ],
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Claude returned no parsed output");
  }
  return response.parsed_output;
}
