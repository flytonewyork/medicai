"use client";

import { MetricTile } from "~/components/ui/metric-tile";
import { useBodyMetrics } from "~/hooks/use-metrics";
import { useLocale } from "~/hooks/use-translate";

export function BodyMetricsGrid() {
  const m = useBodyMetrics();
  const locale = useLocale();

  const weightDelta =
    typeof m.weightChangePct === "number"
      ? `${m.weightChangePct > 0 ? "+" : ""}${m.weightChangePct.toFixed(1)}%`
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricTile
        label={locale === "zh" ? "体重" : "Weight"}
        value={typeof m.latestWeight === "number" ? m.latestWeight.toFixed(1) : "—"}
        unit="kg"
        delta={weightDelta}
        direction={m.weightDirection}
        goodDirection="up"
        footnote={
          m.weightDirection === "none"
            ? locale === "zh"
              ? "未记录基线或今日体重"
              : "Set baseline + log today's weight"
            : locale === "zh"
              ? "相对基线"
              : "vs baseline"
        }
      />
      <MetricTile
        label="BMI"
        value={typeof m.bmi === "number" ? m.bmi.toFixed(1) : "—"}
        unit={m.bmiLabel}
        footnote={
          typeof m.bmi !== "number"
            ? locale === "zh"
              ? "先在设置里填身高"
              : "Add height in settings"
            : undefined
        }
      />
      <MetricTile
        label={locale === "zh" ? "蛋白质（7 天均值）" : "Protein (7-day avg)"}
        value={typeof m.proteinAvg7d === "number" ? Math.round(m.proteinAvg7d) : "—"}
        unit="g/day"
        footnote={
          typeof m.proteinAvg7d === "number" && m.proteinAvg7d < 1.2 * 60
            ? locale === "zh"
              ? "目标 ≈ 每公斤 1.2–1.5 g"
              : "Target ≈ 1.2–1.5 g per kg"
            : undefined
        }
      />
      <MetricTile
        label={locale === "zh" ? "每周运动" : "Weekly exercise"}
        value={m.exerciseMinutes7d}
        unit="min"
        footnote={
          locale === "zh"
            ? `阻力训练 ${m.resistanceDays7d} / 7 天`
            : `${m.resistanceDays7d} / 7 days resistance`
        }
      />
    </div>
  );
}
