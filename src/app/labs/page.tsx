"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import { latestLabs } from "~/lib/db/queries";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { MetricChart, type MetricPoint } from "~/components/labs/metric-chart";
import { BarScale } from "~/components/ui/bar-scale";
import {
  ANALYTES,
  ANALYTE_BY_KEY,
  GROUP_LABEL,
  flagStatus,
  formatAnalyte,
  type AnalyteGroup,
  type AnalyteKey,
} from "~/config/lab-reference-ranges";
import { cn } from "~/lib/utils/cn";
import {
  ChevronRight,
  Sparkles,
  Upload,
} from "lucide-react";

export default function LabsPage() {
  const locale = useLocale();
  const labs = useLiveQuery(() => latestLabs(60));

  const orderedLabs = (labs ?? []).slice().reverse();
  const hasAnyData = (labs ?? []).length > 0;

  // Hero metric: default to CA 19-9, fall back to whatever has the most data
  const [heroKey, setHeroKey] = useState<AnalyteKey>("ca199");
  const def = ANALYTE_BY_KEY[heroKey];

  const points: MetricPoint[] = useMemo(() => {
    return orderedLabs
      .filter((l) => typeof l[heroKey] === "number")
      .map((l) => ({ date: l.date, value: l[heroKey] as number }));
  }, [orderedLabs, heroKey]);

  const latest = points[points.length - 1];
  const first = points[0];
  const deltaPct =
    latest && first && first.value !== 0
      ? Math.round(((latest.value - first.value) / first.value) * 100)
      : null;
  const deltaGood =
    typeof deltaPct === "number"
      ? def.preferred === "low"
        ? deltaPct < 0
        : def.preferred === "high"
          ? deltaPct > 0
          : Math.abs(deltaPct) < 5
      : null;

  // Axis has to fit every plotted point, not just the latest — otherwise an old
  // outlier (e.g. ALT 283 on induction) renders far off-chart once values
  // settle back into range. With a ref range, keep that range visible as the
  // floor so a stable in-range series doesn't flatten against the x-axis.
  const dataMax = points.length > 0 ? Math.max(...points.map((p) => p.value)) : 0;
  const yMax = def.ref
    ? Math.max(def.ref[1] * 1.6, dataMax * 1.1)
    : dataMax > 0
      ? dataMax * 1.1
      : 100;

  // Build "latest value" map keyed by analyte from all labs
  const latestByKey = useMemo(() => {
    const out: Partial<Record<AnalyteKey, { value: number; date: string }>> = {};
    for (const l of orderedLabs) {
      for (const a of ANALYTES) {
        const v = l[a.key];
        if (typeof v === "number" && !(a.key in out)) {
          out[a.key] = { value: v, date: l.date };
        }
      }
    }
    return out;
  }, [orderedLabs]);

  // Group analytes for the panel section
  const groups: Record<AnalyteGroup, typeof ANALYTES> = {
    tumour_marker: [],
    nutrition: [],
    haematology: [],
    liver: [],
    renal: [],
    metabolic: [],
    micronutrient: [],
    other: [],
  };
  for (const a of ANALYTES) groups[a.group].push(a);

  // Popular hero picks shown as quick-switch pills
  const POPULAR: AnalyteKey[] = [
    "ca199",
    "albumin",
    "hemoglobin",
    "neutrophils",
    "platelets",
    "alt",
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "化验追踪" : "Labs"}
        title={locale === "zh" ? "化验与趋势" : "Labs & trends"}
        subtitle={
          locale === "zh"
            ? "点任意项目查看历史。上传一份报告即可自动提取多项结果。"
            : "Tap any analyte to see its history. Upload a report to auto-extract all values."
        }
      />

      {/* Unified ingest CTA — identical surface to Smart Capture. A lab
        * report is just one of the document kinds the universal parser
        * classifies; keeping two entry points out of sync produced the
        * "why are these different?" confusion. */}
      <Link
        href="/ingest"
        className="group flex items-center gap-3 rounded-[var(--r-md)] border border-ink-900 bg-ink-900 px-4 py-3.5 text-paper transition-transform hover:-translate-y-[1px]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-paper/15">
          <Upload className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold">
            {locale === "zh"
              ? "导入任何医疗资料"
              : "Drop in anything medical"}
          </div>
          <div className="mono mt-0.5 text-[10px] uppercase tracking-wider text-ink-300">
            {locale === "zh"
              ? "PDF / 图片 / DOCX · 自动识别化验、影像、就诊函"
              : "PDF · photo · DOCX · labs, imaging, letters auto-detected"}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-ink-300" />
      </Link>

      {/* Hero picker */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:px-0">
        {POPULAR.map((k) => {
          const a = ANALYTE_BY_KEY[k];
          const on = heroKey === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setHeroKey(k)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11.5px] font-medium transition-colors",
                on
                  ? "bg-ink-900 text-paper"
                  : "bg-paper-2 text-ink-700 shadow-sm hover:bg-ink-100",
              )}
            >
              {a.label[locale]}
            </button>
          );
        })}
      </div>

      {/* Hero chart */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/labs/${heroKey}`}
            className="group flex-1"
          >
            <div className="eyebrow">
              {def.label[locale]} ·{" "}
              {locale === "zh" ? "纵向" : "longitudinal"}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <div className="serif num text-[44px] leading-none text-ink-900 group-hover:underline decoration-ink-300">
                {latest ? formatAnalyte(heroKey, latest.value) : "—"}
              </div>
              <div className="mono text-xs text-ink-400">{def.unit}</div>
              {latest && (
                <div className="mono ml-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  {format(parseISO(latest.date), "d MMM")}
                </div>
              )}
            </div>
          </Link>
          {typeof deltaPct === "number" && (
            <span
              className={cn(
                "a-chip",
                deltaGood ? "ok" : deltaPct === 0 ? "" : "warn",
              )}
            >
              {deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "—"}{" "}
              {Math.abs(deltaPct)}%
            </span>
          )}
        </div>

        <MetricChart
          points={points}
          refRange={def.ref}
          yMax={yMax}
          unit={def.unit}
          locale={locale}
        />

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

        {def.note && (
          <div
            className="mt-3.5 flex items-start gap-2.5 rounded-md p-2.5"
            style={{ background: "var(--tide-soft)" }}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--tide-2)" }} />
            <div className="flex-1 text-xs leading-relaxed text-ink-900">
              {def.note[locale]}
            </div>
          </div>
        )}

        <Link
          href={`/labs/${heroKey}`}
          className="mono mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500 hover:text-ink-900"
        >
          {locale === "zh" ? "查看详情与历史" : "Open full history"}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </Card>

      {!hasAnyData && (
        <EmptyState
          title={locale === "zh" ? "还没有化验结果" : "No lab results yet"}
          description={
            locale === "zh"
              ? "上传一份最近的化验报告，或逐项手动添加。"
              : "Upload your most recent lab report or add values analyte-by-analyte."
          }
          actions={
            <>
              <Link href="/ingest">
                <Button>
                  {locale === "zh" ? "上传报告" : "Upload report"}
                </Button>
              </Link>
              <Link href="/labs/ca199">
                <Button variant="secondary">
                  {locale === "zh" ? "手动添加" : "Add manually"}
                </Button>
              </Link>
            </>
          }
        />
      )}

      {/* Analyte panel — grouped */}
      {hasAnyData && (
        <section className="space-y-6">
          {(
            [
              "tumour_marker",
              "nutrition",
              "haematology",
              "liver",
              "renal",
              "metabolic",
              "micronutrient",
              "other",
            ] as AnalyteGroup[]
          ).map((group) => {
            const items = groups[group].filter((a) => latestByKey[a.key]);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-2.5">
                <h2 className="eyebrow">{GROUP_LABEL[group][locale]}</h2>
                <Card className="px-4 py-1">
                  <div className="divide-y divide-ink-100/70">
                    {items.map((a) => {
                      const rec = latestByKey[a.key];
                      if (!rec) return null;
                      const status = flagStatus(a.key, rec.value);
                      const pct = a.ref
                        ? Math.max(
                            0,
                            Math.min(
                              1,
                              (rec.value - a.ref[0]) /
                                (a.ref[1] - a.ref[0]),
                            ),
                          )
                        : 0;
                      return (
                        <Link
                          key={a.key}
                          href={`/labs/${a.key}`}
                          className="group grid grid-cols-[1fr_80px_auto_auto] items-center gap-3 py-2.5 hover:bg-ink-100/20 rounded-md px-2 -mx-2 transition-colors"
                        >
                          <div>
                            <div className="text-[13.5px] font-medium text-ink-900">
                              {a.label[locale]}
                            </div>
                            {a.ref && (
                              <div className="mono mt-0.5 text-[10.5px] text-ink-400">
                                ref {a.ref[0]}–{a.ref[1]} {a.unit}
                              </div>
                            )}
                          </div>
                          {a.ref ? (
                            <BarScale
                              value={pct * 10}
                              max={10}
                              w={80}
                              h={4}
                              color={
                                status === "normal"
                                  ? "var(--tide-2)"
                                  : "var(--warn)"
                              }
                            />
                          ) : (
                            <span />
                          )}
                          <div
                            className={cn(
                              "num min-w-[3.5ch] text-right font-semibold",
                              status === "normal"
                                ? "text-ink-900"
                                : "text-[var(--warn)]",
                            )}
                          >
                            {formatAnalyte(a.key, rec.value)}
                            {status !== "normal" && (
                              <span
                                className="mono ml-1 text-[9px] font-medium"
                                style={{ color: "var(--warn)" }}
                              >
                                {status === "low" ? "L" : "H"}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-ink-300 group-hover:text-ink-700" />
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              </div>
            );
          })}

          {/* Missing-from-panel — analytes we track but user hasn't logged yet. */}
          {(() => {
            const logged = new Set(Object.keys(latestByKey));
            const missing = ANALYTES.filter((a) => !logged.has(a.key));
            if (missing.length === 0) return null;
            return (
              <div className="space-y-2.5">
                <h2 className="eyebrow">
                  {locale === "zh"
                    ? "尚未记录 —— 点开始追踪"
                    : "Not yet tracked — tap to start"}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {missing.map((a) => (
                    <Link
                      key={a.key}
                      href={`/labs/${a.key}`}
                      className="rounded-full border border-dashed border-ink-200 bg-paper-2 px-3 py-1 text-xs text-ink-500 hover:border-ink-400 hover:text-ink-900"
                    >
                      + {a.label[locale]}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}
