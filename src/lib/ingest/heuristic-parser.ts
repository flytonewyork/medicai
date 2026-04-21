import type { LabResult } from "~/types/clinical";

export interface ParsedExtraction {
  document_date?: string;
  labs?: Partial<Omit<LabResult, "id" | "created_at" | "updated_at">>;
  imaging?: {
    date?: string;
    modality?: "CT" | "MRI" | "PET" | "US" | "other";
    findings_summary?: string;
    recist_status?: "CR" | "PR" | "SD" | "PD";
  };
  ctdna?: {
    date?: string;
    platform?: "signatera" | "natera" | "guardant" | "other";
    detected?: boolean;
    value?: number;
  };
}

interface LabPattern {
  key: keyof Omit<LabResult, "id" | "created_at" | "updated_at" | "source" | "notes" | "date">;
  patterns: RegExp[];
  normalise?: (n: number, unit: string) => number;
}

// Common aliases in AU / US / UK lab reports
const LAB_PATTERNS: LabPattern[] = [
  {
    key: "ca199",
    patterns: [
      /ca\s*19[-\s]?9[^\d\-]*([\d,.]+)/i,
      /carbohydrate\s+antigen\s*19[-\s]?9[^\d\-]*([\d,.]+)/i,
    ],
  },
  {
    key: "albumin",
    patterns: [/(?:^|\s)albumin\s*[:\s]*([\d.]+)\s*(g\/l|g\/dl)?/im],
    normalise: (n, unit) => (unit?.toLowerCase() === "g/dl" ? n * 10 : n),
  },
  {
    key: "hemoglobin",
    patterns: [
      /(?:haemo?globin|hgb|hb)\s*[:\s]*([\d.]+)\s*(g\/l|g\/dl)?/im,
    ],
    normalise: (n, unit) => (unit?.toLowerCase() === "g/dl" ? n * 10 : n),
  },
  {
    key: "neutrophils",
    patterns: [
      /neutrophils?[^\n]*?([\d.]+)\s*(x\s*10\^?9\/l|x10\^9\/l|\/nl|\*10\^9\/l)?/im,
    ],
  },
  {
    key: "platelets",
    patterns: [
      /platelets?[^\n]*?([\d,]+)(?:\s*x\s*10\^?9\/l)?/im,
      /\bplt\b[^\n]*?([\d,]+)/im,
    ],
    normalise: (n) => n,
  },
  {
    key: "creatinine",
    patterns: [/creatinine\s*[:\s]*([\d.]+)\s*(umol\/l|µmol\/l|mg\/dl)?/im],
    normalise: (n, unit) =>
      unit?.toLowerCase() === "mg/dl" ? Math.round(n * 88.4) : n,
  },
  {
    key: "bilirubin",
    patterns: [/bilirubin[^:\n]*[:\s]+([\d.]+)/im],
  },
  { key: "alt", patterns: [/\balt\b[^:\n]*[:\s]+([\d.]+)/im] },
  { key: "ast", patterns: [/\bast\b[^:\n]*[:\s]+([\d.]+)/im] },
  { key: "crp", patterns: [/(?:^|\s)crp\s*[:\s]*([\d.]+)/im] },
  {
    key: "magnesium",
    patterns: [/magnesium\s*[:\s]*([\d.]+)/im],
  },
  { key: "phosphate", patterns: [/phosphate\s*[:\s]*([\d.]+)/im] },
  // Additional mPDAC-relevant analytes
  { key: "cea", patterns: [/\bcea\b[^:\n]*[:\s]+([\d.]+)/im] },
  { key: "ldh", patterns: [/\bldh\b[^:\n]*[:\s]+([\d.]+)/im] },
  {
    key: "prealbumin",
    patterns: [/pre[\s-]?albumin\s*[:\s]*([\d.]+)/im],
  },
  {
    key: "hematocrit",
    patterns: [/(?:haematocrit|hematocrit|hct)\s*[:\s]*([\d.]+)/im],
  },
  {
    key: "wbc",
    patterns: [/\b(?:wbc|white\s*(?:cell|blood)\s*count)\b[^\n]*?([\d.]+)/im],
  },
  {
    key: "lymphocytes",
    patterns: [/lymphocytes?\s*[:\s]*([\d.]+)/im],
  },
  { key: "ggt", patterns: [/\bggt\b[^:\n]*[:\s]+([\d.]+)/im] },
  { key: "alp", patterns: [/\b(?:alp|alkaline\s*phosphatase)\b[^:\n]*[:\s]+([\d.]+)/im] },
  { key: "urea", patterns: [/\b(?:urea|bun)\b\s*[:\s]*([\d.]+)/im] },
  { key: "sodium", patterns: [/\b(?:sodium|na\+?)\b\s*[:\s]*([\d.]+)/im] },
  { key: "potassium", patterns: [/\b(?:potassium|k\+?)\b\s*[:\s]*([\d.]+)/im] },
  { key: "calcium", patterns: [/\bcalcium\b\s*[:\s]*([\d.]+)/im] },
  { key: "glucose", patterns: [/\b(?:glucose|fasting\s*glucose|bsl)\b\s*[:\s]*([\d.]+)/im] },
  { key: "hba1c", patterns: [/\bhba1c\b\s*[:\s]*([\d.]+)/im] },
  { key: "ferritin", patterns: [/\bferritin\b\s*[:\s]*([\d.]+)/im] },
  {
    key: "vit_d",
    patterns: [/\b(?:vit(?:amin)?\s*d|25[\s-]oh[\s-]d)\b[^\n]*?([\d.]+)/im],
  },
  { key: "b12", patterns: [/\b(?:b12|cobalamin|vit(?:amin)?\s*b12)\b[^\n]*?([\d.]+)/im] },
  { key: "folate", patterns: [/\bfolate\b\s*[:\s]*([\d.]+)/im] },
  { key: "inr", patterns: [/\binr\b\s*[:\s]*([\d.]+)/im] },
  { key: "tsh", patterns: [/\btsh\b\s*[:\s]*([\d.]+)/im] },
];

export function parseHeuristic(text: string): ParsedExtraction {
  const out: ParsedExtraction = {};
  const labs: NonNullable<ParsedExtraction["labs"]> = {};

  // Document date
  const dateMatch = text.match(
    /(?:collected|sample\s*taken|report\s*date|date\s*of\s*report|specimen\s*date)[^\n]*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  );
  if (dateMatch?.[1]) out.document_date = normaliseDate(dateMatch[1]);
  else {
    const anyDate = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
    if (anyDate?.[1]) out.document_date = normaliseDate(anyDate[1]);
  }

  for (const { key, patterns, normalise } of LAB_PATTERNS) {
    for (const re of patterns) {
      const m = text.match(re);
      if (!m?.[1]) continue;
      const raw = Number(m[1].replace(/,/g, ""));
      if (!Number.isFinite(raw)) continue;
      const unit = m[2] ?? "";
      const value = normalise ? normalise(raw, unit) : raw;
      labs[key] = value;
      break;
    }
  }
  if (Object.keys(labs).length > 0) out.labs = labs;

  // Imaging (crude heuristics)
  const modalityMatch = text.match(/\b(CT|MRI|PET|PET[-\s]?CT|US|ULTRASOUND)\b/i);
  if (modalityMatch?.[1]) {
    const m = modalityMatch[1].toUpperCase();
    const modality: ParsedExtraction["imaging"] = {
      modality:
        m.startsWith("PET") ? "PET" : m === "ULTRASOUND" ? "US" : (m as "CT" | "MRI" | "US"),
    };
    const recist = text.match(/\b(CR|PR|SD|PD)\b/);
    if (recist?.[1]) modality.recist_status = recist[1] as "CR" | "PR" | "SD" | "PD";
    const impression = text.match(/impression[:\s]+([\s\S]{0,400})/i);
    if (impression?.[1]) modality.findings_summary = impression[1].trim();
    if (out.document_date) modality.date = out.document_date;
    out.imaging = modality;
  }

  // ctDNA
  if (/signatera|natera|guardant|ctdna/i.test(text)) {
    const detected = /\bdetected\b/i.test(text) && !/not\s+detected/i.test(text);
    const platform: ParsedExtraction["ctdna"] = {
      platform: /signatera/i.test(text)
        ? "signatera"
        : /natera/i.test(text)
          ? "natera"
          : /guardant/i.test(text)
            ? "guardant"
            : "other",
      detected,
      date: out.document_date,
    };
    const tumor = text.match(/(\d+\.?\d*)\s*(?:mtm\/ml|MTM\/mL|mean\s*tumor\s*molecules)/i);
    if (tumor?.[1]) platform.value = Number(tumor[1]);
    out.ctdna = platform;
  }

  return out;
}

function normaliseDate(input: string): string {
  // Accept DD/MM/YYYY, D/M/YY, with - or . separators. Return YYYY-MM-DD.
  const parts = input.split(/[\/\-\.]/).map((p) => p.trim());
  if (parts.length !== 3) return input;
  let [a, b, c] = parts as [string, string, string];
  // Heuristic: if first part is 4 digits, treat as YYYY-MM-DD.
  if (a.length === 4) {
    return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
  }
  // Otherwise treat as DD/MM/YYYY (AU default).
  if (c.length === 2) {
    const n = Number(c);
    c = n > 50 ? `19${c}` : `20${c}`;
  }
  return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
}
