// Lightweight pattern matcher for short, structured log entries. The /log
// surface normally tags free-text and fans it out to the specialist agents
// so the super-brain can react. But a lot of what the patient actually types is
// a single vital or lab value — "blood sugar 7.9 this morning", "weight
// 64.5 kg", "walked 20 min". Running the full agent fan-out on those
// wastes latency and tokens; they're just data points.
//
// `parseDirectFile(text)` returns a tagged union with the target Dexie
// table + patch and a human summary of what was filed. Returning `null`
// means the text isn't a simple data point and should fall through to
// the normal tag-and-fan-out flow.
//
// The parser is deliberately conservative:
//   - Exactly one readable value per line is required.
//   - A trailing unit ("kg", "min", "mg/dL", "mmol/L") is required for
//     anything ambiguous (weight vs glucose would otherwise collide).
//   - Glucose accepts "blood sugar" / "blood glucose" / "bsl" / "bgl";
//     pure numbers without a keyword are never inferred as glucose.

import { todayISO } from "~/lib/utils/date";
import type { DailyEntry, LabResult } from "~/types/clinical";
import type { LocalizedText } from "~/types/localized";

export type DirectFileResult =
  | {
      kind: "lab";
      date: string;
      patch: Partial<LabResult> & { date: string; source: "patient_self_report" };
      summary: LocalizedText;
      icon: "lab";
    }
  | {
      kind: "daily";
      date: string;
      patch: Partial<DailyEntry>;
      summary: LocalizedText;
      icon: "daily";
    };

const DAY_PART_RE = /\b(this morning|morning|am|afternoon|pm|evening|tonight|today|now)\b/i;

function timeOfDay(text: string): LocalizedText {
  const m = DAY_PART_RE.exec(text);
  const hit = m?.[1]?.toLowerCase();
  if (!hit) return { en: "today", zh: "今日" };
  if (hit === "this morning" || hit === "morning" || hit === "am")
    return { en: "this morning", zh: "上午" };
  if (hit === "afternoon")
    return { en: "this afternoon", zh: "下午" };
  if (hit === "pm" || hit === "evening" || hit === "tonight")
    return { en: "this evening", zh: "晚上" };
  return { en: "today", zh: "今日" };
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDirectFile(
  raw: string,
  today: string = todayISO(),
): DirectFileResult | null {
  const text = raw.trim();
  if (!text) return null;
  // Too long → probably a multi-topic note; don't try to direct-file.
  if (text.length > 160) return null;

  // --- Blood glucose ----------------------------------------------------
  // "blood sugar 7.9", "BGL 5.3 mmol/L", "blood glucose this morning 6.1"
  const glucose = text.match(
    /\b(?:blood\s+(?:sugar|glucose)|bsl|bgl|glucose)\b[^\d]{0,30}(\d+(?:\.\d+)?)/i,
  );
  if (glucose) {
    const value = num(glucose[1]);
    if (value !== null) {
      const when = timeOfDay(text);
      return {
        kind: "lab",
        date: today,
        patch: {
          date: today,
          glucose: value,
          source: "patient_self_report",
        },
        summary: {
          en: `Blood glucose — ${value} ${when.en}`,
          zh: `血糖 —— ${value} ${when.zh}`,
        },
        icon: "lab",
      };
    }
  }

  // --- Weight -----------------------------------------------------------
  // "weight 68.2 kg", "weighed 68.2 kg", "68.2kg"
  const weight = text.match(
    /\b(?:weight|weighed|mass)\b[^\d]{0,10}(\d+(?:\.\d+)?)\s*kg\b/i,
  );
  if (weight) {
    const value = num(weight[1]);
    if (value !== null) {
      return {
        kind: "daily",
        date: today,
        patch: { weight_kg: value },
        summary: {
          en: `Weight — ${value} kg`,
          zh: `体重 —— ${value} kg`,
        },
        icon: "daily",
      };
    }
  }

  // --- Temperature ------------------------------------------------------
  // "temp 37.8", "temperature 38.1 C"
  const temp = text.match(
    /\btemp(?:erature)?\b[^\d]{0,10}(\d+(?:\.\d+)?)/i,
  );
  if (temp) {
    const value = num(temp[1]);
    if (value !== null && value >= 32 && value <= 42) {
      return {
        kind: "daily",
        date: today,
        patch: { fever_temp: value, fever: value >= 38 },
        summary: {
          en: `Temperature — ${value}°C`,
          zh: `体温 —— ${value}°C`,
        },
        icon: "daily",
      };
    }
  }

  // --- Walking minutes --------------------------------------------------
  // "walked 20 min", "30 min walk", "walk 25 minutes"
  const walk = text.match(
    /(?:\bwalked?\b[^\d]{0,10}(\d+)\s*(?:min|minutes|m)\b|(\d+)\s*(?:min|minutes|m)\s+walk\b)/i,
  );
  if (walk) {
    const value = num(walk[1] ?? walk[2]);
    if (value !== null && value > 0 && value < 500) {
      return {
        kind: "daily",
        date: today,
        patch: { walking_minutes: value },
        summary: {
          en: `Walking — ${value} min`,
          zh: `步行 —— ${value} 分钟`,
        },
        icon: "daily",
      };
    }
  }

  // --- Steps ------------------------------------------------------------
  // "4200 steps", "steps 5200"
  const steps = text.match(
    /\b(\d{3,6})\s*steps\b|\bsteps\b[^\d]{0,8}(\d{3,6})/i,
  );
  if (steps) {
    const value = num(steps[1] ?? steps[2]);
    if (value !== null && value > 0 && value < 200000) {
      return {
        kind: "daily",
        date: today,
        patch: { steps: value },
        summary: {
          en: `Steps — ${value.toLocaleString()}`,
          zh: `步数 —— ${value.toLocaleString()}`,
        },
        icon: "daily",
      };
    }
  }

  // --- Protein grams ----------------------------------------------------
  // "protein 62 g", "had 30g protein"
  const protein = text.match(
    /(?:\bprotein\b[^\d]{0,10}(\d+(?:\.\d+)?)\s*g\b|(\d+(?:\.\d+)?)\s*g\s+protein\b)/i,
  );
  if (protein) {
    const value = num(protein[1] ?? protein[2]);
    if (value !== null && value > 0 && value < 500) {
      return {
        kind: "daily",
        date: today,
        patch: { protein_grams: value },
        summary: {
          en: `Protein — ${value} g`,
          zh: `蛋白质 —— ${value} g`,
        },
        icon: "daily",
      };
    }
  }

  return null;
}
