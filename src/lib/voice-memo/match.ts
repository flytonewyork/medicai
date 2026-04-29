import { db } from "~/lib/db/dexie";
import type { Appointment } from "~/types/appointment";
import type { Imaging, LabResult } from "~/types/clinical";
import type { VoiceMemoParsedFields } from "~/types/voice-memo";

// Matching helpers for the voice-memo apply step. Job is to answer:
// "did dad already have an appointment on the books for this scan /
// blood test, or is this an unprompted mention?" Linking the memo to
// existing rows preserves the schedule's source-of-truth status; only
// truly novel mentions create new clinical entries (and even those
// require an explicit "Add new scan/test" tap on the preview).

const APPOINTMENT_LOOKBACK_DAYS = 14;
const APPOINTMENT_LOOKAHEAD_DAYS = 7;

type ImagingModality = NonNullable<
  VoiceMemoParsedFields["imaging_results"]
>[number]["modality"];

// Map the memo's lowercase modality enum to the Imaging table's
// uppercase one. Memo enum widens to "xray" / "bone_scan" which the
// Imaging table doesn't have — those collapse to "other" so we never
// drop an entry on a typo-by-design.
export function mapModality(m: ImagingModality): Imaging["modality"] {
  switch (m) {
    case "ct":
      return "CT";
    case "mri":
      return "MRI";
    case "pet":
      return "PET";
    case "ultrasound":
      return "US";
    default:
      return "other";
  }
}

// Words that strongly suggest a particular modality when found in an
// appointment title. Order matters — PET wins over CT because a
// "PET-CT" appointment is technically both but most clinically a PET.
const MODALITY_KEYWORDS: Record<ImagingModality, string[]> = {
  pet: ["pet"],
  mri: ["mri"],
  ct: ["ct ", "ct-", "ct,", "ct.", "ct\\b", "computed tomography"],
  ultrasound: ["ultrasound", "us "],
  xray: ["x-ray", "xray", "x ray"],
  bone_scan: ["bone scan", "bone-scan"],
  other: [],
};

// Find a recent appointment that this imaging memo is most likely
// reporting on. Returns null when no match — caller surfaces an
// "Add new scan/test" CTA in that case.
//
// Window: 14 days back, 7 days forward (memo can describe a result
// that arrived right after the scan, or a result the patient already
// got even though our local appointment hasn't been marked attended).
export async function findAppointmentForImaging(
  modality: ImagingModality,
  memoDay: string,
): Promise<Appointment | null> {
  const window = appointmentWindow(memoDay);
  const candidates = await db.appointments
    .where("starts_at")
    .between(window.from, window.to, true, true)
    .toArray();
  return pickBestImagingMatch(candidates, modality);
}

function pickBestImagingMatch(
  rows: Appointment[],
  modality: ImagingModality,
): Appointment | null {
  const keywords = MODALITY_KEYWORDS[modality] ?? [];
  const scored = rows
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({ row: a, score: scoreImagingMatch(a, modality, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.row ?? null;
}

function scoreImagingMatch(
  appt: Appointment,
  modality: ImagingModality,
  keywords: string[],
): number {
  let score = 0;
  if (appt.kind === "scan") score += 5;
  else if (appt.kind === "procedure") score += 2;
  else if (appt.kind === "other") score += 1;
  // Title fuzzy-match (case-insensitive substring).
  const haystack = `${appt.title ?? ""} ${appt.notes ?? ""}`.toLowerCase();
  for (const kw of keywords) {
    if (kw.includes("\\b")) {
      // Treat as a regex word-boundary check.
      const re = new RegExp(kw.replace(/\\b/g, "\\b"), "i");
      if (re.test(haystack)) {
        score += 4;
        break;
      }
    } else if (haystack.includes(kw)) {
      score += 4;
      break;
    }
  }
  return score;
}

// Lab name → typed LabResult key. Returns null when the memo's name
// doesn't fuzzy-map to one of the known typed analytes — in that case
// the qualitative mention stays on the memo / appointment notes only.
export function mapLabName(rawName: string): keyof LabResult | null {
  const n = rawName.toLowerCase().replace(/[\s-_]+/g, " ").trim();
  // Tumour markers
  if (/(ca\s*19[\s.\-]?9|ca199)/.test(n)) return "ca199";
  if (n === "cea" || n.startsWith("cea ")) return "cea";
  if (n === "ldh" || n.startsWith("ldh ")) return "ldh";
  // Nutrition / inflammation
  if (n.includes("prealbumin")) return "prealbumin";
  if (n.includes("albumin")) return "albumin";
  if (n === "crp" || n.includes("c reactive")) return "crp";
  // Haematology
  if (n.includes("hemoglobin") || n.includes("haemoglobin") || n === "hb" || n === "hgb") return "hemoglobin";
  if (n.includes("hematocrit") || n.includes("haematocrit") || n === "hct") return "hematocrit";
  if (n === "wbc" || n.includes("white cell") || n.includes("white count")) return "wbc";
  if (n.includes("neutrophil")) return "neutrophils";
  if (n.includes("lymphocyte")) return "lymphocytes";
  if (n.includes("platelet") || n === "plt") return "platelets";
  // LFTs
  if (n === "alt") return "alt";
  if (n === "ast") return "ast";
  if (n === "ggt") return "ggt";
  if (n === "alp" || n.includes("alkaline phos")) return "alp";
  if (n.includes("bilirubin")) return "bilirubin";
  // Renal / electrolytes
  if (n.includes("creatinine")) return "creatinine";
  if (n === "urea" || n === "bun") return "urea";
  if (n === "sodium" || n === "na") return "sodium";
  if (n === "potassium" || n === "k") return "potassium";
  if (n.includes("calcium")) return "calcium";
  if (n.includes("magnesium")) return "magnesium";
  if (n.includes("phosphate")) return "phosphate";
  // Metabolic
  if (n === "glucose" || n.includes("blood sugar")) return "glucose";
  if (n.includes("hba1c") || n.includes("a1c")) return "hba1c";
  // Micronutrients
  if (n.includes("ferritin")) return "ferritin";
  if (n.includes("vitamin d") || n === "vit d") return "vit_d";
  if (n.includes("b12")) return "b12";
  if (n === "folate") return "folate";
  return null;
}

// Pull a plain number out of a free-text lab value. Tolerates
// units in either direction ("28 U/mL", "5.2 ×10^9/L"). Returns
// null when the value is qualitative ("normal", "high") so the
// caller can route accordingly.
export function extractNumericValue(value: string | undefined | null): number | null {
  if (!value) return null;
  // Strip common decoration before parseFloat.
  const cleaned = value
    .replace(/[,]/g, "")
    .replace(/[<>≤≥]/g, "")
    .trim();
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// Find an existing labs row for this date (any source). Used to
// dedupe the memo's mention against a row that's already there
// (e.g. labs were imported by Thomas earlier). When matched, the
// caller may add the memo's value to a missing analyte slot.
export async function findExistingLabRow(
  day: string,
): Promise<LabResult | null> {
  const rows = await db.labs.where("date").equals(day).toArray();
  return rows[0] ?? null;
}

export async function findAppointmentForLab(
  memoDay: string,
): Promise<Appointment | null> {
  const window = appointmentWindow(memoDay);
  const rows = await db.appointments
    .where("starts_at")
    .between(window.from, window.to, true, true)
    .toArray();
  const scored = rows
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({ row: a, score: scoreLabMatch(a) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.row ?? null;
}

function scoreLabMatch(appt: Appointment): number {
  let score = 0;
  if (appt.kind === "blood_test") score += 5;
  else if (appt.kind === "clinic") score += 1;
  return score;
}

// 14 days back, 7 days forward — clipped to a reasonable timestamp
// range so Dexie's between() index walk stays small.
function appointmentWindow(memoDay: string): { from: string; to: string } {
  const d = new Date(`${memoDay}T00:00:00`);
  const from = new Date(d);
  from.setDate(from.getDate() - APPOINTMENT_LOOKBACK_DAYS);
  const to = new Date(d);
  to.setDate(to.getDate() + APPOINTMENT_LOOKAHEAD_DAYS);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 19) + "Z",
  };
}
