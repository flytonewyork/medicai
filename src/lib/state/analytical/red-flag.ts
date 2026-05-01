// Acute red-flag filter.
//
// Per the design rule: the platform does NOT compete with the clinical
// team on acute events the team already covers (fever, jaundice,
// dyspnoea, sudden severe pain). Its job at this tier is exactly two
// things:
//
//   1. Hold the acute observation OUT of the chronic residual stream
//      so detrend / CUSUM don't misinterpret a real acute event as a
//      slow toxicity drift.
//   2. Surface ONE protocolised feed item with the clinical action,
//      then stay quiet — no follow-up nudges, no "are you OK" check-
//      ins, 24h auto-mute on acknowledge.
//
// This module owns rule (1) and emits the AcuteFlag descriptor that
// the feed composer uses to do (2). Pure functions — no Dexie, no
// Date.now.
import type { Observation } from "../types";
import type { LocalizedText } from "~/types/treatment";
import type { AcuteFlag, AcuteKind } from "./types";

// Thresholds. These are clinical, not statistical — chosen against
// CTCAE v5 / NCCN antiemesis / generally-accepted acute care
// thresholds. Tightening or loosening any of these requires a
// clinical-review note in the PR; do not tune them from data.
const FEVER_C = 38.0;            // CTCAE grade 1 fever / GnP unit threshold
const PAIN_SPIKE_DELTA = 3;      // 0-10 scale, vs prior day
const FEBRILE_NEUTROPENIA_NADIR_DAYS: ReadonlySet<number> = new Set([
  // Days 10-21 of a 28-day MPACT cycle — covers the operational
  // window in which a temperature ≥38°C should be treated as suspected
  // FN until proven otherwise.
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
]);

const PROTOCOL_ACTIONS: Record<AcuteKind, LocalizedText> = {
  fever: {
    en: "Temperature ≥ 38°C — call the GnP unit on the number in your treatment plan.",
    zh: "体温 ≥ 38°C — 请按照治疗计划中的电话号码联系化疗病房。",
  },
  fn_suspected: {
    en: "Fever during your nadir window — call the GnP unit now and follow the febrile neutropenia plan.",
    zh: "化疗低谷期发热 — 请立即联系化疗病房，按发热性中性粒细胞减少症方案处理。",
  },
  pain_spike: {
    en: "Sudden pain change — review your breakthrough plan and call the team if it doesn't settle.",
    zh: "疼痛突然变化 — 请按爆发痛方案处理，如未缓解请联系医疗团队。",
  },
  jaundice: {
    en: "New yellowing of the eyes or skin — contact the team today; this may relate to your stent.",
    zh: "眼睛或皮肤新发黄染 — 请今天联系医疗团队，可能与胆道支架有关。",
  },
  dyspnoea: {
    en: "New shortness of breath — contact the team today and rest.",
    zh: "新发呼吸急促 — 请今天联系医疗团队并休息。",
  },
  bleeding: {
    en: "Unexplained bleeding or new bruising — contact the team today.",
    zh: "不明原因出血或新发瘀斑 — 请今天联系医疗团队。",
  },
  neuro_emergency: {
    en: "Sudden weakness, severe headache, or new confusion — call emergency services or the GnP unit.",
    zh: "突发无力、剧烈头痛或新发意识混乱 — 请呼叫急救或联系化疗病房。",
  },
};

export interface AcuteContext {
  // The metric being evaluated. Acute flags are metric-specific —
  // a fever flag fires on body_temperature_c, not on grip.
  metric_id: string;
  cycle_day?: number;
  // Most recent observation for the metric (the candidate for flagging).
  current: Observation;
  // Optional prior observation (most recent before `current`); used
  // for delta-based acute rules like pain_spike.
  prior?: Observation | null;
  // Optional patient-flag observations from the daily entry — these
  // ride alongside numeric metrics on the same day. Keyed by metric
  // id so the filter can reach across sibling fields without rebuilding
  // a full snapshot.
  daily_flags?: Partial<Record<string, boolean>>;
}

const FLAG_METRIC_TO_KIND: Record<string, AcuteKind> = {
  jaundice_flag: "jaundice",
  dyspnoea_flag: "dyspnoea",
  bleeding_flag: "bleeding",
  neuro_emergency_flag: "neuro_emergency",
};

function makeFlag(
  kind: AcuteKind,
  obs: Observation,
  metric_id: string,
): AcuteFlag {
  return {
    kind,
    observation_ref: `${metric_id}:${obs.date}`,
    protocol_action: PROTOCOL_ACTIONS[kind],
    excluded_from_residual: true,
  };
}

/**
 * Decide whether `current` is an acute event for `metric_id`. Returns
 * a single AcuteFlag or null. Multiple kinds are not stacked — the
 * highest-acuity kind wins (FN > fever > others) so the patient sees
 * one item per event, never a pile-on.
 */
export function detectAcute(ctx: AcuteContext): AcuteFlag | null {
  const { metric_id, current, prior, cycle_day, daily_flags } = ctx;

  // Body temperature path: fever, possibly upgraded to FN suspected.
  if (metric_id === "body_temperature_c") {
    if (Number.isFinite(current.value) && current.value >= FEVER_C) {
      const inNadir =
        cycle_day != null && FEBRILE_NEUTROPENIA_NADIR_DAYS.has(cycle_day);
      return makeFlag(
        inNadir ? "fn_suspected" : "fever",
        current,
        metric_id,
      );
    }
  }

  // Pain delta path: spike of >3 points vs the most recent prior reading.
  if (metric_id === "pain_worst" || metric_id === "pain_current") {
    if (
      prior &&
      Number.isFinite(current.value) &&
      Number.isFinite(prior.value) &&
      current.value - prior.value >= PAIN_SPIKE_DELTA
    ) {
      return makeFlag("pain_spike", current, metric_id);
    }
  }

  // Pure-flag observations (jaundice, dyspnoea, bleeding, neuro): the
  // metric_id IS the flag; value > 0 means the patient ticked it.
  const flagKind = FLAG_METRIC_TO_KIND[metric_id];
  if (flagKind && current.value > 0) {
    return makeFlag(flagKind, current, metric_id);
  }

  // Sibling-flag check: when evaluating a numeric metric that lives in
  // the same daily entry as one of the patient flags, we treat the
  // sibling flag as an acute event for that day. This lets the filter
  // exclude the sibling numeric (e.g. weight) on a jaundice day where
  // hydration / cholestasis are confounding.
  if (daily_flags) {
    for (const [sibling, kind] of Object.entries(FLAG_METRIC_TO_KIND)) {
      if (daily_flags[sibling]) {
        return makeFlag(kind, current, metric_id);
      }
    }
  }

  return null;
}

/**
 * Convenience: given a series of observations and a per-day acute
 * context, return the set of dates that should be excluded from the
 * residual stream. detrend.ts consumes this set directly via
 * `acute_excluded_dates`.
 */
export function acuteExcludedDates(args: {
  metric_id: string;
  observations: readonly Observation[];
  cycle_day_for: (date: string) => number | undefined;
  daily_flags_for?: (date: string) => Partial<Record<string, boolean>> | undefined;
}): Set<string> {
  const { metric_id, observations, cycle_day_for, daily_flags_for } = args;
  const excluded = new Set<string>();
  let prior: Observation | null = null;
  for (const obs of observations) {
    const flag = detectAcute({
      metric_id,
      current: obs,
      prior,
      cycle_day: cycle_day_for(obs.date),
      daily_flags: daily_flags_for?.(obs.date),
    });
    if (flag) excluded.add(obs.date);
    prior = obs;
  }
  return excluded;
}
