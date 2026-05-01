import type { DailyEntry } from "~/types/clinical";

// Pure trend calculators for the GI / digestive surface. Take a slice
// of daily_entries (chronological order doesn't matter — the helpers
// sort defensively) and return summary numbers / series the dashboard
// can drop straight into TrendChart, Sparkline, and tile components.
//
// Why this lives separately from `~/lib/calculations/trends.ts`:
// trends.ts is generic-numeric (movingAverage, percentChange,
// linearSlope). GI-specific aggregations need to handle the new
// optional fields with care — preferring `stool_count` over the older
// `diarrhoea_count`, treating `stool_oil` || `steatorrhoea` as the
// same signal, and folding `pert_with_meals_today` into a coverage
// rate. Keeping that domain logic out of the generic helpers keeps
// trends.ts cheap and testable.

export interface GiDay {
  date: string;            // YYYY-MM-DD
  count: number | null;    // BMs (stool_count, falling back to diarrhoea_count)
  bristol: number | null;  // 1–7 or null
  oil: boolean;
  urgency: boolean;
  blood: boolean;
  pert?: NonNullable<DailyEntry["pert_with_meals_today"]>;
}

export interface GiSummary {
  // Days with any GI signal (count, bristol, oil, urgency, blood, pert).
  // Used to decide whether to render the section at all.
  days_with_data: number;
  // Mean BMs/day across days where a count was recorded. null if the
  // window has no count data.
  count_avg: number | null;
  // Predominant Bristol type across days where it was recorded. null if none.
  bristol_mode: number | null;
  // Number of days flagged steatorrhoea-like (oil or older `steatorrhoea`).
  oil_days: number;
  // Number of days the patient flagged urgency.
  urgency_days: number;
  // Number of days flagged blood / black stool. Should always trigger the
  // red zone rule too — surfaced here only as a count for the dashboard.
  blood_days: number;
  // PERT coverage: fraction in [0,1] of days where the patient said they
  // took PERT with every fatty meal, out of days where pert_with_meals_today
  // was set AND not "na" (no fatty meals). null if no eligible days.
  pert_coverage: number | null;
  // Current consecutive loose-stool day streak (most recent day backwards).
  // Loose = Bristol ≥ 6 OR count ≥ 4 OR oil flag.
  loose_streak: number;
}

const LOOSE_BRISTOL = 6;
const LOOSE_COUNT = 4;

// Project a DailyEntry into the lean GiDay shape. Older entries that
// only filled `diarrhoea_count` still contribute to `count`.
export function projectGiDay(d: DailyEntry): GiDay {
  const stool = typeof d.stool_count === "number" ? d.stool_count : null;
  const diarrhoea =
    typeof d.diarrhoea_count === "number" ? d.diarrhoea_count : null;
  return {
    date: d.date,
    count: stool ?? diarrhoea,
    bristol: typeof d.stool_bristol === "number" ? d.stool_bristol : null,
    oil: d.stool_oil === true || d.steatorrhoea === true,
    urgency: d.stool_urgency === true,
    blood: d.stool_blood === true,
    pert: d.pert_with_meals_today,
  };
}

function hasAnyGiSignal(g: GiDay): boolean {
  return (
    g.count !== null ||
    g.bristol !== null ||
    g.oil ||
    g.urgency ||
    g.blood ||
    g.pert !== undefined
  );
}

// Most recent N days of GI projections, oldest → newest. Days without
// a daily_entry row are emitted as null-filled placeholders so charts
// can show the full window with gaps.
export function buildGiSeries(
  entries: readonly DailyEntry[],
  todayISO: string,
  days: number,
): GiDay[] {
  const byDate = new Map<string, GiDay>();
  for (const e of entries) byDate.set(e.date, projectGiDay(e));

  const out: GiDay[] = [];
  const today = parseIsoDate(todayISO);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = isoFromDate(d);
    out.push(
      byDate.get(iso) ?? {
        date: iso,
        count: null,
        bristol: null,
        oil: false,
        urgency: false,
        blood: false,
      },
    );
  }
  return out;
}

export function summariseGiSeries(series: readonly GiDay[]): GiSummary {
  const withData = series.filter(hasAnyGiSignal);

  const counts = series
    .map((g) => g.count)
    .filter((v): v is number => typeof v === "number");
  const count_avg =
    counts.length > 0
      ? round1(counts.reduce((s, v) => s + v, 0) / counts.length)
      : null;

  const bristol_mode = mode(
    series
      .map((g) => g.bristol)
      .filter((v): v is number => typeof v === "number"),
  );

  const oil_days = series.filter((g) => g.oil).length;
  const urgency_days = series.filter((g) => g.urgency).length;
  const blood_days = series.filter((g) => g.blood).length;

  const pertEligible = series.filter(
    (g) => g.pert !== undefined && g.pert !== "na",
  );
  const pert_coverage =
    pertEligible.length > 0
      ? pertEligible.filter((g) => g.pert === "all").length /
        pertEligible.length
      : null;

  // Loose-stool streak: walk most-recent → oldest until a non-loose day
  // breaks the chain. A day with no GI data is treated as a break.
  let loose_streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    const g = series[i]!;
    if (!isLooseDay(g)) break;
    loose_streak += 1;
  }

  return {
    days_with_data: withData.length,
    count_avg,
    bristol_mode,
    oil_days,
    urgency_days,
    blood_days,
    pert_coverage,
    loose_streak,
  };
}

function isLooseDay(g: GiDay): boolean {
  if (g.bristol !== null && g.bristol >= LOOSE_BRISTOL) return true;
  if (g.count !== null && g.count >= LOOSE_COUNT) return true;
  if (g.oil) return true;
  return false;
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function parseIsoDate(iso: string): Date {
  // Use UTC noon to avoid DST edge cases shifting the date.
  return new Date(iso + "T12:00:00.000Z");
}

function isoFromDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
