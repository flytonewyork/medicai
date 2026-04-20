"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import type { DailyEntry, Settings } from "~/types/clinical";

export interface BodyMetrics {
  latestWeight?: number;
  weightChangePct?: number;
  weightDirection: "up" | "down" | "flat" | "none";
  bmi?: number;
  bmiLabel?: string;
  proteinAvg7d?: number;
  exerciseMinutes7d?: number;
  resistanceDays7d?: number;
  walkingMinutes7d?: number;
  practicePct28d?: number;
  daysLogged7d: number;
}

function bmiCategory(b: number): string {
  if (b < 18.5) return "Underweight";
  if (b < 25) return "Healthy";
  if (b < 30) return "Overweight";
  return "Obese";
}

export function useBodyMetrics(): BodyMetrics {
  const entries = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(28).toArray(),
  );
  const settings = useLiveQuery(() => db.settings.toArray());
  const baseline = settings?.[0];

  return useMemo(
    () => computeMetrics(entries ?? [], baseline),
    [entries, baseline],
  );
}

function computeMetrics(
  entries: DailyEntry[],
  baseline: Settings | undefined,
): BodyMetrics {
  const ordered = entries.slice().reverse();
  const last7 = ordered.slice(-7);

  const weights = ordered
    .map((e) => e.weight_kg)
    .filter((v): v is number => typeof v === "number");
  const latestWeight = weights[weights.length - 1];

  let weightChangePct: number | undefined;
  let weightDirection: BodyMetrics["weightDirection"] = "none";
  if (typeof latestWeight === "number" && baseline?.baseline_weight_kg) {
    weightChangePct =
      ((latestWeight - baseline.baseline_weight_kg) / baseline.baseline_weight_kg) *
      100;
    if (Math.abs(weightChangePct) < 1) weightDirection = "flat";
    else weightDirection = weightChangePct > 0 ? "up" : "down";
  }

  let bmi: number | undefined;
  let bmiLabel: string | undefined;
  if (typeof latestWeight === "number" && baseline?.height_cm) {
    const h = baseline.height_cm / 100;
    bmi = latestWeight / (h * h);
    bmiLabel = bmiCategory(bmi);
  }

  const proteins = last7
    .map((e) => e.protein_grams)
    .filter((v): v is number => typeof v === "number");
  const proteinAvg7d =
    proteins.length > 0
      ? proteins.reduce((a, b) => a + b, 0) / proteins.length
      : undefined;

  const exerciseMinutes7d = last7.reduce(
    (sum, e) => sum + (e.walking_minutes ?? 0) + (e.other_exercise_minutes ?? 0),
    0,
  );
  const walkingMinutes7d = last7.reduce(
    (sum, e) => sum + (e.walking_minutes ?? 0),
    0,
  );
  const resistanceDays7d = last7.filter((e) => e.resistance_training).length;

  const sessions28 = ordered.reduce(
    (sum, e) =>
      sum +
      (e.practice_morning_completed ? 1 : 0) +
      (e.practice_evening_completed ? 1 : 0),
    0,
  );
  const practicePct28d =
    ordered.length > 0 ? (sessions28 / (ordered.length * 2)) * 100 : undefined;

  return {
    latestWeight,
    weightChangePct,
    weightDirection,
    bmi,
    bmiLabel,
    proteinAvg7d,
    exerciseMinutes7d,
    resistanceDays7d,
    walkingMinutes7d,
    practicePct28d,
    daysLogged7d: last7.length,
  };
}

export const __test__ = { computeMetrics };
