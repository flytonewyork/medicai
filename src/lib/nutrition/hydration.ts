import { db, now } from "~/lib/db/dexie";
import type { FluidKind, FluidLog } from "~/types/nutrition";
import type { EnteredBy } from "~/types/clinical";

export const FLUID_KIND_LABEL: Record<
  FluidKind,
  { en: string; zh: string; emoji: string }
> = {
  water: { en: "Water", zh: "水", emoji: "💧" },
  tea: { en: "Tea", zh: "茶", emoji: "🍵" },
  coffee: { en: "Coffee", zh: "咖啡", emoji: "☕" },
  broth: { en: "Bone broth", zh: "骨头汤", emoji: "🍲" },
  electrolyte: { en: "Electrolyte", zh: "电解质饮料", emoji: "🥤" },
  soup: { en: "Soup", zh: "汤", emoji: "🥣" },
  other: { en: "Other", zh: "其他", emoji: "🥛" },
};

// Default daily target — patient values doc says ~2L/day baseline,
// more on infusion days. Not personalised yet; the dashboard surfaces
// it as a soft target rather than a hard cap.
export const DEFAULT_FLUID_TARGET_ML = 2000;

export interface LogFluidInput {
  date: string;
  logged_at?: string;
  kind: FluidKind;
  volume_ml: number;
  notes?: string;
  entered_by: EnteredBy;
  entered_by_user_id?: string;
}

export async function logFluid(input: LogFluidInput): Promise<number> {
  const t = now();
  return (await db.fluid_logs.add({
    date: input.date,
    logged_at: input.logged_at ?? t,
    kind: input.kind,
    volume_ml: Math.max(0, Math.round(input.volume_ml)),
    notes: input.notes,
    entered_by: input.entered_by,
    entered_by_user_id: input.entered_by_user_id,
    created_at: t,
  })) as number;
}

export async function listFluidsForDate(date: string): Promise<FluidLog[]> {
  const rows = await db.fluid_logs.where("date").equals(date).toArray();
  rows.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  return rows;
}

export async function listFluidsBetween(
  startDate: string,
  endDate: string,
): Promise<FluidLog[]> {
  return db.fluid_logs
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function deleteFluid(id: number): Promise<void> {
  await db.fluid_logs.delete(id);
}

export interface FluidDailyTotals {
  total_ml: number;
  by_kind: Partial<Record<FluidKind, number>>;
  count: number;
}

export function sumFluids(
  rows: ReadonlyArray<FluidLog>,
): FluidDailyTotals {
  const by_kind: Partial<Record<FluidKind, number>> = {};
  let total = 0;
  for (const r of rows) {
    total += r.volume_ml;
    by_kind[r.kind] = (by_kind[r.kind] ?? 0) + r.volume_ml;
  }
  return { total_ml: total, by_kind, count: rows.length };
}

// Common quick-add presets surfaced in the UI as one-tap buttons.
// Volumes match real-world references (cup ≈ 240 ml, mug ≈ 350 ml,
// bottle ≈ 500 ml). Tweaking these is harmless — the patient can
// always edit a row's volume manually.
export const FLUID_QUICK_ADD: Array<{
  kind: FluidKind;
  volume_ml: number;
  label_en: string;
  label_zh: string;
}> = [
  { kind: "water", volume_ml: 240, label_en: "Cup of water", label_zh: "一杯水" },
  { kind: "water", volume_ml: 500, label_en: "Bottle of water", label_zh: "一瓶水" },
  { kind: "tea", volume_ml: 240, label_en: "Cup of tea", label_zh: "一杯茶" },
  { kind: "broth", volume_ml: 250, label_en: "Mug of broth", label_zh: "一碗汤" },
  { kind: "electrolyte", volume_ml: 500, label_en: "Electrolyte drink", label_zh: "电解质饮料" },
];
