"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { MetricChart, type MetricPoint } from "~/components/labs/metric-chart";
import { BarScale } from "~/components/ui/bar-scale";
import { Sparkles, ChevronRight, Share2 } from "lucide-react";
import { computeSymptomScore, computeToxicityScore } from "~/lib/calculations/pillars";
import { cn } from "~/lib/utils/cn";

type MetricKey =
  | "ca199"
  | "weight"
  | "albumin"
  | "symptom"
  | "toxicity";

interface Metric {
  key: MetricKey;
  label: { en: string; zh: string };
  unit: string;
  yMax: number;
  refRange?: [number, number];
  goodDirection: "up" | "down" | "stable";
  read: { en: string; zh: string };
}

const METRICS: Metric[] = [
  {
    key: "ca199",
    label: { en: "CA 19-9", zh: "CA 19-9" },
    unit: "U/mL",
    yMax: 500,
    refRange: [0, 37],
    goodDirection: "down",
    read: {
      en: "The primary PDAC tumour marker. A sustained fall points to treatment response; a rise for three consecutive readings is a yellow-zone trigger.",
      zh: "PDAC 的主要肿瘤标志物。持续下降提示治疗有效；连续三次上升触发黄色警示。",
    },
  },
  {
    key: "weight",
    label: { en: "Body weight", zh: "体重" },
    unit: "kg",
    yMax: 100,
    goodDirection: "stable",
    read: {
      en: "Sustained weight stability vs baseline is a first-line function signal. >5% loss over 90 days is a yellow-zone trigger.",
      zh: "体重相对基线稳定是最早的功能信号。90 天内下降 >5% 触发黄色警示。",
    },
  },
  {
    key: "albumin",
    label: { en: "Albumin", zh: "白蛋白" },
    unit: "g/L",
    yMax: 50,
    refRange: [35, 50],
    goodDirection: "up",
    read: {
      en: "Visceral-protein reserve. Drops below 30 g/L trigger a nutrition review.",
      zh: "内脏蛋白储备。< 30 g/L 触发营养复查。",
    },
  },
  {
    key: "symptom",
    label: { en: "Symptom burden", zh: "症状负担" },
    unit: "/100",
    yMax: 100,
    refRange: [70, 100],
    goodDirection: "up",
    read: {
      en: "Daily-entry composite (pain, nausea, fatigue, appetite, GI, respiratory). Higher = fewer symptoms.",
      zh: "每日记录的综合分（疼痛、恶心、疲劳、食欲、消化道、呼吸）。分数越高症状越少。",
    },
  },
  {
    key: "toxicity",
    label: { en: "Toxicity tolerance", zh: "毒性耐受" },
    unit: "/100",
    yMax: 100,
    refRange: [70, 100],
    goodDirection: "up",
    read: {
      en: "Treatment-toxicity composite (neuropathy, mucositis, cognitive, skin). Higher = less toxicity.",
      zh: "治疗毒性综合分（神经病变、口腔炎、认知、皮肤）。分数越高毒性越低。",
    },
  },
];

export default function LabsPage() {
  const locale = useLocale();
  const [metricKey, setMetricKey] = useState<MetricKey>("ca199");

  const labs = useLiveQuery(() =>
    db.labs.orderBy("date").reverse().limit(20).toArray(),
  );
  const dailies = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(28).toArray(),
  );
  const assessments = useLiveQuery(() =>
    db.comprehensive_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(8)
      .toArray(),
  );

  const orderedLabs = (labs ?? []).slice().reverse();
  const orderedDailies = (dailies ?? []).slice().reverse();
  const orderedAssessments = (assessments ?? []).slice().reverse();

  const points: MetricPoint[] = useMemo(() => {
    switch (metricKey) {
      case "ca199":
        return orderedLabs
          .filter((l) => typeof l.ca199 === "number")
          .map((l) => ({ date: l.date, value: l.ca199 as number }));
      case "albumin":
        return orderedLabs
          .filter((l) => typeof l.albumin === "number")
          .map((l) => ({ date: l.date, value: l.albumin as number }));
      case "weight":
        return orderedDailies
          .filter((d) => typeof d.weight_kg === "number")
          .map((d) => ({ date: d.date, value: d.weight_kg as number }));
      case "symptom":
        return orderedAssessments
          .map((a) => ({
            date: a.assessment_date,
            score: computeSymptomScore(a),
          }))
          .filter(
            (
              p,
            ): p is { date: string; score: number } =>
              typeof p.score === "number",
          )
          .map((p) => ({ date: p.date, value: Math.round(p.score) }));
      case "toxicity":
        return orderedAssessments
          .map((a) => ({
            date: a.assessment_date,
            score: computeToxicityScore(a),
          }))
          .filter(
            (
              p,
            ): p is { date: string; score: number } =>
              typeof p.score === "number",
          )
          .map((p) => ({ date: p.date, value: Math.round(p.score) }));
    }
  }, [metricKey, orderedLabs, orderedDailies, orderedAssessments]);

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0]!;
  const latest = points[points.length - 1];
  const first = points[0];
  const deltaPct =
    latest && first && first.value !== 0
      ? Math.round(((latest.value - first.value) / first.value) * 100)
      : null;
  const deltaGood =
    typeof deltaPct === "number"
      ? metric.goodDirection === "down"
        ? deltaPct < 0
        : metric.goodDirection === "up"
          ? deltaPct > 0
          : Math.abs(deltaPct) < 5
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "治疗应答" : "Treatment response"}
        title={locale === "zh" ? "化验与趋势" : "Labs & trends"}
        action={
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-paper-2 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm hover:bg-ink-100"
          >
            <Share2 className="h-3.5 w-3.5" />
            {locale === "zh" ? "分享" : "Share"}
          </button>
        }
      />

      {/* Metric selector */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:px-0">
        {METRICS.map((m) => {
          const on = m.key === metricKey;
          return (
            <button
              key={m.key}
              onClick={() => setMetricKey(m.key)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11.5px] font-medium transition-colors",
                on
                  ? "bg-ink-900 text-paper"
                  : "bg-paper-2 text-ink-700 shadow-sm hover:bg-ink-100",
              )}
            >
              {m.label[locale]}
            </button>
          );
        })}
      </div>

      {/* Hero chart */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">
              {metric.label[locale]} ·{" "}
              {locale === "zh" ? "纵向" : "longitudinal"}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <div className="serif num text-[44px] leading-none text-ink-900">
                {latest ? latest.value : "—"}
              </div>
              <div className="mono text-xs text-ink-400">{metric.unit}</div>
              {latest && (
                <div
                  className="mono ml-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--ink-400)" }}
                >
                  {format(parseISO(latest.date), "d MMM")}
                </div>
              )}
            </div>
          </div>
          {typeof deltaPct === "number" && (
            <span
              className={
                deltaGood ? "a-chip ok" : deltaPct === 0 ? "a-chip" : "a-chip warn"
              }
            >
              {deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "—"}{" "}
              {Math.abs(deltaPct)}%
            </span>
          )}
        </div>

        <MetricChart
          points={points}
          refRange={metric.refRange}
          yMax={metric.yMax}
          unit={metric.unit}
          locale={locale}
        />

        {/* x-axis labels — first, middle, last */}
        {points.length > 0 && (
          <div className="mt-1 flex justify-between pl-1 pr-[34px]">
            {points.map((p, i) => {
              if (
                i !== 0 &&
                i !== points.length - 1 &&
                i !== Math.floor(points.length / 2)
              ) {
                return null;
              }
              return (
                <div
                  key={i}
                  className="mono text-[9px]"
                  style={{ color: "var(--ink-400)" }}
                >
                  {format(parseISO(p.date), "d MMM")}
                </div>
              );
            })}
          </div>
        )}

        {/* Read card */}
        <div
          className="mt-3.5 flex items-start gap-2.5 rounded-[10px] p-2.5"
          style={{ background: "var(--tide-soft)" }}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--tide-2)" }} />
          <div className="flex-1 text-xs leading-relaxed text-ink-900">
            {metric.read[locale]}
          </div>
        </div>
      </Card>

      {/* Latest lab panel */}
      {orderedLabs.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="eyebrow">
            {locale === "zh" ? "最近化验" : "Latest lab panel"}
          </h2>
          <Card className="px-4 py-1">
            {(() => {
              const last = orderedLabs[orderedLabs.length - 1];
              if (!last) return null;
              type Row = {
                label: string;
                value?: number;
                unit: string;
                ref?: [number, number];
              };
              const rows: Row[] = ([
                { label: "CA 19-9", value: last.ca199, unit: "U/mL", ref: [0, 37] as [number, number] },
                { label: "Hb", value: last.hemoglobin, unit: "g/L", ref: [120, 160] as [number, number] },
                {
                  label: "Neut",
                  value: last.neutrophils,
                  unit: "×10⁹/L",
                  ref: [1.5, 7] as [number, number],
                },
                {
                  label: "Plt",
                  value: last.platelets,
                  unit: "×10⁹/L",
                  ref: [150, 450] as [number, number],
                },
                { label: "Albumin", value: last.albumin, unit: "g/L", ref: [35, 50] as [number, number] },
                { label: "Bili", value: last.bilirubin, unit: "µmol/L" },
                { label: "ALT", value: last.alt, unit: "U/L" },
                { label: "CRP", value: last.crp, unit: "mg/L" },
              ] as Row[]).filter((r) => typeof r.value === "number");
              return (
                <>
                  <div className="py-2 text-[11px] text-ink-400">
                    {locale === "zh" ? "采样" : "Drawn"}{" "}
                    {format(parseISO(last.date), "d MMM yyyy")}
                  </div>
                  <div className="divide-y divide-ink-100/70">
                    {rows.map((r, i) => {
                      const pct = r.ref
                        ? Math.max(
                            0,
                            Math.min(
                              1,
                              ((r.value as number) - r.ref[0]) /
                                (r.ref[1] - r.ref[0]),
                            ),
                          )
                        : 0;
                      const belowRef = r.ref && (r.value as number) < r.ref[0];
                      const aboveRef = r.ref && (r.value as number) > r.ref[1];
                      const warn = belowRef || aboveRef;
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_80px_auto] items-center gap-3 py-2.5"
                        >
                          <div>
                            <div className="text-[13.5px] font-medium text-ink-900">
                              {r.label}
                            </div>
                            {r.ref && (
                              <div className="mono mt-0.5 text-[10.5px] text-ink-400">
                                ref {r.ref[0]}–{r.ref[1]} {r.unit}
                              </div>
                            )}
                          </div>
                          {r.ref && (
                            <BarScale
                              value={pct * 10}
                              max={10}
                              w={80}
                              h={4}
                              color={warn ? "var(--warn)" : "var(--tide-2)"}
                            />
                          )}
                          {!r.ref && <span />}
                          <div
                            className={cn(
                              "num min-w-[3.5ch] text-right font-semibold",
                              warn
                                ? "text-[var(--warn)]"
                                : "text-ink-900",
                            )}
                          >
                            {r.value}
                            {warn && (
                              <span
                                className="mono ml-1 text-[9px] font-medium"
                                style={{ color: "var(--warn)" }}
                              >
                                {belowRef ? "L" : "H"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </Card>
        </section>
      )}

      {/* Go to ingest link */}
      <Link
        href="/ingest"
        className="flex items-center justify-between rounded-[var(--r-md)] border border-ink-100/70 bg-paper-2 px-4 py-3 text-[13px] font-medium text-ink-900 hover:border-ink-300"
      >
        <span>
          {locale === "zh"
            ? "上传或解析一份报告"
            : "Upload or parse a report"}
        </span>
        <ChevronRight className="h-4 w-4 text-ink-400" />
      </Link>
    </div>
  );
}
