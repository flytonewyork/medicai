import { z } from "zod/v4";
import type { PreparedImage } from "~/lib/ingest/image";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";
import { postJson } from "~/lib/utils/http";

const LabsSchema = z.object({
  // Tumour markers
  ca199: z.number().nullable().optional(),
  cea: z.number().nullable().optional(),
  ldh: z.number().nullable().optional(),
  // Nutrition / inflammation
  albumin: z.number().nullable().optional(),
  prealbumin: z.number().nullable().optional(),
  crp: z.number().nullable().optional(),
  // Haematology
  hemoglobin: z.number().nullable().optional(),
  hematocrit: z.number().nullable().optional(),
  wbc: z.number().nullable().optional(),
  neutrophils: z.number().nullable().optional(),
  lymphocytes: z.number().nullable().optional(),
  platelets: z.number().nullable().optional(),
  // Liver panel
  alt: z.number().nullable().optional(),
  ast: z.number().nullable().optional(),
  ggt: z.number().nullable().optional(),
  alp: z.number().nullable().optional(),
  bilirubin: z.number().nullable().optional(),
  // Renal / electrolytes
  creatinine: z.number().nullable().optional(),
  urea: z.number().nullable().optional(),
  sodium: z.number().nullable().optional(),
  potassium: z.number().nullable().optional(),
  calcium: z.number().nullable().optional(),
  magnesium: z.number().nullable().optional(),
  phosphate: z.number().nullable().optional(),
  // Metabolic
  glucose: z.number().nullable().optional(),
  hba1c: z.number().nullable().optional(),
  // Micronutrients
  ferritin: z.number().nullable().optional(),
  vit_d: z.number().nullable().optional(),
  b12: z.number().nullable().optional(),
  folate: z.number().nullable().optional(),
  // Coag / endocrine
  inr: z.number().nullable().optional(),
  tsh: z.number().nullable().optional(),
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

export const EXTRACTION_SYSTEM = `You are a clinical document parser. You receive a patient's medical document (lab report, radiology report, referral, clinic letter, or ctDNA result) either as OCR-extracted text or directly as an image.

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
7. Extract 'pending_items' only for tests or referrals the document says are PLANNED — not the results in this document.
8. When given an image, read numbers carefully — prefer the most recent / most visible value, and ignore reference-range columns when extracting the patient's result.`;

export async function extractWithClaude({
  text,
  image,
  model = DEFAULT_AI_MODEL,
}: {
  text?: string;
  image?: PreparedImage;
  model?: string;
}): Promise<ClaudeExtraction> {
  if (!text && !image) {
    throw new Error("extractWithClaude requires at least text or image input");
  }
  const data = await postJson<{ result: ClaudeExtraction }>(
    "/api/ai/ingest-report",
    { text, image, model },
  );
  return data.result;
}
