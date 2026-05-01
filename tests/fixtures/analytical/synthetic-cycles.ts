// Synthetic-cycle fixture generator. The single most important piece
// of test infrastructure for the analytical layer — every property-
// based assertion (residuals are N(0,1) on stationary input, CUSUM
// detects injected drift, acute filter holds out spikes) sits on top
// of this module.
//
// Deterministic: every generator takes a numeric `seed` and uses a
// simple LCG so test outputs are reproducible without depending on
// the host's RNG.
import type { Observation } from "~/lib/state/types";
import type { CycleStub } from "~/lib/state/analytical";

// Mulberry32: small, fast, deterministic 32-bit PRNG. Returns a
// generator function in [0, 1).
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform: convert two uniforms to one standard normal.
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function toIsoDate(epochDays: number): string {
  return new Date(epochDays * 86_400_000).toISOString().slice(0, 10);
}

function toEpochDays(iso: string): number {
  return Math.floor(Date.parse(iso) / 86_400_000);
}

export interface SyntheticCycleSpec {
  metric_id: string;
  protocol_cycle_length_days: number;     // typically 28
  n_cycles: number;
  cycle1_start: string;                    // ISO date
  baseline: number;                        // raw-units baseline value
  daily_noise_sd: number;                  // raw-units SD per day
  // Optional within-cycle signature in raw units (e.g. fatigue trough
  // on day 4). Indexed by cycle_day 1..N. If omitted, signal is flat
  // at `baseline`.
  cycle_signature?: (cycle_day: number) => number;
  // Inject a step-change drift starting at the given cycle/day. After
  // onset, value drops by `magnitude_per_day` raw-units per day.
  injected_drift?: {
    onset_cycle: number;                   // 1-based
    onset_cycle_day: number;               // 1-based
    magnitude_per_day: number;             // raw units / day; negative for "lower"
  };
  // Inject discrete acute spikes on specific dates.
  acute_events?: Array<{
    date: string;                          // ISO date
    delta: number;                         // added on top of the day's value
  }>;
  seed: number;
}

export interface SyntheticSeries {
  observations: Observation[];
  cycles: CycleStub[];
  ground_truth: {
    drift_onset_iso: string | null;
    acute_iso: string[];
  };
}

/**
 * Generate a deterministic synthetic observation series with
 * matching cycle stubs. The series has one observation per day for
 * `n_cycles` × `protocol_cycle_length_days` days.
 */
export function generateSyntheticSeries(spec: SyntheticCycleSpec): SyntheticSeries {
  const rng = mulberry32(spec.seed);
  const startDay = toEpochDays(spec.cycle1_start);
  if (Number.isNaN(startDay)) {
    throw new Error(`bad cycle1_start: ${spec.cycle1_start}`);
  }
  const totalDays = spec.n_cycles * spec.protocol_cycle_length_days;
  const observations: Observation[] = [];
  const cycles: CycleStub[] = [];
  for (let c = 1; c <= spec.n_cycles; c++) {
    const start = startDay + (c - 1) * spec.protocol_cycle_length_days;
    cycles.push({
      start_date: toIsoDate(start),
      cycle_number: c,
      cycle_length_days: spec.protocol_cycle_length_days,
    });
  }

  const acuteSet = new Map<string, number>();
  for (const ev of spec.acute_events ?? []) {
    acuteSet.set(ev.date, (acuteSet.get(ev.date) ?? 0) + ev.delta);
  }

  let driftOnsetIso: string | null = null;

  for (let i = 0; i < totalDays; i++) {
    const dayEpoch = startDay + i;
    const date = toIsoDate(dayEpoch);
    const cycleIndex = Math.floor(i / spec.protocol_cycle_length_days);
    const cycleDay = (i % spec.protocol_cycle_length_days) + 1;
    const cycleNumber = cycleIndex + 1;

    let value = spec.baseline;
    if (spec.cycle_signature) {
      value += spec.cycle_signature(cycleDay) - spec.baseline;
      // The signature returns absolute expected value at this cycle_day;
      // we add (signature - baseline) so the noise still centres on
      // baseline + signature delta.
    }
    value += gaussian(rng) * spec.daily_noise_sd;

    if (spec.injected_drift) {
      const { onset_cycle, onset_cycle_day, magnitude_per_day } =
        spec.injected_drift;
      const onsetEpoch =
        startDay +
        (onset_cycle - 1) * spec.protocol_cycle_length_days +
        (onset_cycle_day - 1);
      if (dayEpoch === onsetEpoch && driftOnsetIso === null) {
        driftOnsetIso = date;
      }
      if (dayEpoch >= onsetEpoch) {
        const daysSinceOnset = dayEpoch - onsetEpoch;
        value += magnitude_per_day * daysSinceOnset;
      }
    }

    const acute = acuteSet.get(date);
    if (acute) value += acute;

    observations.push({ date, value });

    // Touch cycleNumber so the unused-variable lint stays quiet — and
    // more importantly so the index→cycleNumber relationship is
    // clearly an invariant of the generator.
    void cycleNumber;
  }

  return {
    observations,
    cycles,
    ground_truth: {
      drift_onset_iso: driftOnsetIso,
      acute_iso: spec.acute_events?.map((e) => e.date) ?? [],
    },
  };
}

/** Smooth piecewise function approximating ANC nadir trajectory for tests. */
export function ancCycleSignature(cycle_day: number): number {
  // Anchored to cycle-curves.json:anc — peaks ~3.5 on day 1, nadir
  // ~1.3 on day 18, recovery to ~3.5 by day 28.
  if (cycle_day <= 4) return 3.5 - 0.3 * (cycle_day - 1);
  if (cycle_day <= 18) return 2.6 - (1.3 / 14) * (cycle_day - 4);
  return 1.3 + (2.2 / 10) * (cycle_day - 18);
}

/** Flat signature — useful for unit tests of stationary residuals. */
export function flatSignature(value: number): (cycle_day: number) => number {
  return () => value;
}
