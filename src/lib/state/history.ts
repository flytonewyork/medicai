// Unified activity aggregator — pulls every time-stamped row from the
// Dexie tables and produces a single chronological stream for the
// /history view. Pure function: caller does the Dexie reads and passes
// the rows in so this module is trivially testable and stays decoupled
// from storage.
import type {
  CareTeamContact,
  ChangeSignalRow,
  DailyEntry,
  Decision,
  Imaging,
  LabResult,
  LifeEvent,
  SignalEventRow,
} from "~/types/clinical";
import type { TreatmentCycle } from "~/types/treatment";
import type { Medication, MedicationEvent } from "~/types/medication";

export type HistoryCategory =
  | "signal"
  | "action"
  | "medication"
  | "care_team"
  | "lab"
  | "imaging"
  | "treatment"
  | "check_in"
  | "decision"
  | "life_event";

export type HistoryTone = "info" | "positive" | "caution" | "warning";

export interface LocalizedText {
  en: string;
  zh: string;
}

export interface HistoryEntry {
  // Stable identifier composed from source table + id + variant, so the
  // UI can key off it across re-renders even when new rows arrive.
  id: string;
  category: HistoryCategory;
  at: string;              // ISO
  title: LocalizedText;
  detail?: LocalizedText;
  tone: HistoryTone;
  href?: string;
}

export interface AggregateInputs {
  signals: readonly ChangeSignalRow[];
  signalEvents: readonly SignalEventRow[];
  medications: readonly Medication[];
  medicationEvents: readonly MedicationEvent[];
  careTeamContacts: readonly CareTeamContact[];
  labs: readonly LabResult[];
  imaging: readonly Imaging[];
  cycles: readonly TreatmentCycle[];
  dailyEntries: readonly DailyEntry[];
  decisions: readonly Decision[];
  lifeEvents: readonly LifeEvent[];
  // Optional filter window — only include entries within the last N days.
  // Undefined ⇒ include all.
  windowDays?: number;
  now?: string;            // for tests
}

const DAYS_MS = 86_400_000;

function inWindow(iso: string | undefined, fromMs: number | null): boolean {
  if (!iso) return false;
  if (fromMs == null) return true;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= fromMs;
}

// ─── Entry builders ───────────────────────────────────────────────────────

function signalEntries(
  signals: readonly ChangeSignalRow[],
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const s of signals) {
    out.push({
      id: `signal-emitted-${s.id}`,
      category: "signal",
      at: s.detected_at,
      title: {
        en: titleFromSignal(s, "emitted"),
        zh: titleFromSignalZh(s, "emitted"),
      },
      detail: {
        en: `${s.detector} · ${s.axis}`,
        zh: `${s.detector} · ${s.axis}`,
      },
      tone: s.severity === "warning" ? "warning" : "caution",
      href: "/signals",
    });
    if (s.status === "resolved" && s.resolved_at) {
      out.push({
        id: `signal-resolved-${s.id}`,
        category: "signal",
        at: s.resolved_at,
        title: {
          en: titleFromSignal(s, "resolved"),
          zh: titleFromSignalZh(s, "resolved"),
        },
        detail: {
          en: `${s.detector} · ${s.axis}`,
          zh: `${s.detector} · ${s.axis}`,
        },
        tone: "positive",
        href: "/signals",
      });
    }
  }
  return out;
}

function titleFromSignal(
  s: ChangeSignalRow,
  kind: "emitted" | "resolved",
): string {
  const name = s.detector.replace(/_/g, " ");
  return kind === "emitted"
    ? `Signal: ${name}`
    : `Signal resolved: ${name}`;
}
function titleFromSignalZh(
  s: ChangeSignalRow,
  kind: "emitted" | "resolved",
): string {
  return kind === "emitted"
    ? `信号触发：${s.detector}`
    : `信号解决：${s.detector}`;
}

function actionEntries(
  signalEvents: readonly SignalEventRow[],
): HistoryEntry[] {
  return signalEvents
    .filter((e) => e.kind === "action_taken" && e.action_ref_id)
    .map((e) => ({
      id: `action-${e.id}`,
      category: "action" as const,
      at: e.created_at,
      title: {
        en: `Action taken: ${e.action_ref_id}`,
        zh: `采取行动：${e.action_ref_id}`,
      },
      detail: e.action_kind
        ? { en: e.action_kind, zh: e.action_kind }
        : undefined,
      tone: "positive" as const,
      href: "/signals",
    }));
}

function medicationEntries(
  events: readonly MedicationEvent[],
  meds: readonly Medication[],
): HistoryEntry[] {
  const medById = new Map<number, Medication>();
  for (const m of meds) {
    if (m.id != null) medById.set(m.id, m);
  }
  return events.map((e) => {
    const med = medById.get(e.medication_id);
    const name = med?.display_name ?? e.drug_id;
    const status =
      e.event_type === "taken"
        ? "taken"
        : e.event_type === "missed"
          ? "missed"
          : "side effect";
    return {
      id: `med-${e.id}`,
      category: "medication" as const,
      at: e.logged_at,
      title: {
        en: `${name} — ${status}`,
        zh: `${name} —— ${
          e.event_type === "taken"
            ? "已服用"
            : e.event_type === "missed"
              ? "漏服"
              : "副作用"
        }`,
      },
      detail: e.dose_taken
        ? { en: e.dose_taken, zh: e.dose_taken }
        : undefined,
      tone:
        e.event_type === "taken"
          ? ("positive" as const)
          : e.event_type === "missed"
            ? ("caution" as const)
            : ("info" as const),
      href: med?.id ? `/medications/${med.id}` : "/medications",
    };
  });
}

function careTeamEntries(
  contacts: readonly CareTeamContact[],
): HistoryEntry[] {
  return contacts
    .filter((c) => c.id != null)
    .map((c) => ({
      id: `care-${c.id}`,
      category: "care_team" as const,
      at: `${c.date}T12:00:00Z`,
      title: {
        en: `Care team · ${c.kind.replace(/_/g, " ")}`,
        zh: `医疗团队 · ${c.kind}`,
      },
      detail:
        c.with_who || c.notes
          ? {
              en: [c.with_who, c.notes].filter(Boolean).join(" — "),
              zh: [c.with_who, c.notes].filter(Boolean).join(" —— "),
            }
          : undefined,
      tone: c.follow_up_needed ? ("caution" as const) : ("info" as const),
      href: "/care-team",
    }));
}

function labEntries(labs: readonly LabResult[]): HistoryEntry[] {
  return labs
    .filter((l) => l.id != null)
    .map((l) => {
      const flagged: string[] = [];
      if (l.ca199) flagged.push(`CA19-9 ${l.ca199}`);
      if (l.neutrophils != null) flagged.push(`ANC ${l.neutrophils}`);
      if (l.hemoglobin != null) flagged.push(`Hb ${l.hemoglobin}`);
      if (l.alt != null && l.alt >= 100) flagged.push(`ALT ${l.alt}↑`);
      const detail = flagged.join(" · ");
      return {
        id: `lab-${l.id}`,
        category: "lab" as const,
        at: `${l.date}T08:00:00Z`,
        title: {
          en: `Labs received`,
          zh: `化验结果`,
        },
        detail: detail ? { en: detail, zh: detail } : undefined,
        tone: "info" as const,
        href: "/labs",
      };
    });
}

function imagingEntries(imaging: readonly Imaging[]): HistoryEntry[] {
  return imaging
    .filter((i) => i.id != null)
    .map((i) => ({
      id: `img-${i.id}`,
      category: "imaging" as const,
      at: `${i.date}T08:00:00Z`,
      title: {
        en: `Imaging · ${i.modality}${i.recist_status ? ` · ${i.recist_status}` : ""}`,
        zh: `影像 · ${i.modality}${i.recist_status ? ` · ${i.recist_status}` : ""}`,
      },
      detail: { en: i.findings_summary, zh: i.findings_summary },
      tone:
        i.recist_status === "PD"
          ? ("warning" as const)
          : i.recist_status === "PR" || i.recist_status === "CR"
            ? ("positive" as const)
            : ("info" as const),
      href: "/labs",
    }));
}

function cycleEntries(
  cycles: readonly TreatmentCycle[],
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const c of cycles) {
    if (c.id == null) continue;
    out.push({
      id: `cycle-start-${c.id}`,
      category: "treatment",
      at: `${c.start_date}T08:00:00Z`,
      title: {
        en: `Cycle ${c.cycle_number} started — ${c.protocol_id}`,
        zh: `周期 ${c.cycle_number} 开始 — ${c.protocol_id}`,
      },
      tone: "info",
      href: `/treatment/${c.id}`,
    });
    if (c.actual_end_date) {
      out.push({
        id: `cycle-end-${c.id}`,
        category: "treatment",
        at: `${c.actual_end_date}T18:00:00Z`,
        title: {
          en: `Cycle ${c.cycle_number} ended`,
          zh: `周期 ${c.cycle_number} 结束`,
        },
        tone: "info",
        href: `/treatment/${c.id}`,
      });
    }
  }
  return out;
}

function dailyCheckinEntries(
  dailies: readonly DailyEntry[],
): HistoryEntry[] {
  return dailies
    .filter((d) => d.id != null)
    .map((d) => {
      const flags: string[] = [];
      if (d.fever) flags.push("fever");
      if (d.nausea >= 5) flags.push(`nausea ${d.nausea}`);
      if ((d.diarrhoea_count ?? 0) >= 3) flags.push(`diarrhoea ${d.diarrhoea_count}`);
      if (d.neuropathy_hands) flags.push("neuropathy hands");
      if (d.neuropathy_feet) flags.push("neuropathy feet");
      if (d.cold_dysaesthesia) flags.push("cold dysaesthesia");
      const weight =
        typeof d.weight_kg === "number" ? `${d.weight_kg} kg` : null;
      const parts = [
        `energy ${d.energy}/10`,
        `sleep ${d.sleep_quality}/10`,
        weight,
        ...flags,
      ]
        .filter(Boolean)
        .join(" · ");
      const hasFlags = flags.length > 0;
      return {
        id: `daily-${d.id}`,
        category: "check_in" as const,
        at: d.entered_at ?? `${d.date}T08:00:00Z`,
        title: {
          en: `Daily check-in`,
          zh: `每日记录`,
        },
        detail: parts ? { en: parts, zh: parts } : undefined,
        tone: (d.fever ? "warning" : hasFlags ? "caution" : "info") as HistoryTone,
        href: d.id ? `/daily/${d.id}` : "/daily",
      };
    });
}

function decisionEntries(
  decisions: readonly Decision[],
): HistoryEntry[] {
  return decisions
    .filter((d) => d.id != null)
    .map((d) => ({
      id: `decision-${d.id}`,
      category: "decision" as const,
      at: `${d.decision_date}T12:00:00Z`,
      title: { en: `Decision: ${d.title}`, zh: `决策：${d.title}` },
      detail: { en: d.decision, zh: d.decision },
      tone: "info" as const,
      href: `/decisions`,
    }));
}

function lifeEventEntries(
  events: readonly LifeEvent[],
): HistoryEntry[] {
  return events
    .filter((e) => e.id != null)
    .map((e) => ({
      id: `life-${e.id}`,
      category: "life_event" as const,
      at: `${e.event_date}T12:00:00Z`,
      title: { en: e.title, zh: e.title },
      detail: e.notes ? { en: e.notes, zh: e.notes } : undefined,
      tone: "info" as const,
      href: "/events",
    }));
}

// ─── Entry point ──────────────────────────────────────────────────────────

export function aggregateHistory(
  inputs: AggregateInputs,
): HistoryEntry[] {
  const nowMs = inputs.now
    ? Date.parse(inputs.now)
    : Date.now();
  const fromMs =
    typeof inputs.windowDays === "number"
      ? nowMs - inputs.windowDays * DAYS_MS
      : null;

  const all: HistoryEntry[] = [
    ...signalEntries(inputs.signals),
    ...actionEntries(inputs.signalEvents),
    ...medicationEntries(inputs.medicationEvents, inputs.medications),
    ...careTeamEntries(inputs.careTeamContacts),
    ...labEntries(inputs.labs),
    ...imagingEntries(inputs.imaging),
    ...cycleEntries(inputs.cycles),
    ...dailyCheckinEntries(inputs.dailyEntries),
    ...decisionEntries(inputs.decisions),
    ...lifeEventEntries(inputs.lifeEvents),
  ];

  return all
    .filter((e) => inWindow(e.at, fromMs))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * Group entries by calendar date (YYYY-MM-DD) in the order they appear.
 * Useful for rendering date headers in the UI.
 */
export function groupByDate(
  entries: readonly HistoryEntry[],
): { date: string; entries: HistoryEntry[] }[] {
  const out: { date: string; entries: HistoryEntry[] }[] = [];
  let current: { date: string; entries: HistoryEntry[] } | null = null;
  for (const e of entries) {
    const day = e.at.slice(0, 10);
    if (!current || current.date !== day) {
      current = { date: day, entries: [] };
      out.push(current);
    }
    current.entries.push(e);
  }
  return out;
}
