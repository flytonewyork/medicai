"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import { db, now } from "~/lib/db/dexie";
import { latestLabs } from "~/lib/db/queries";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { MetricChart, type MetricPoint } from "~/components/labs/metric-chart";
import {
  ANALYTE_BY_KEY,
  flagStatus,
  formatAnalyte,
  type AnalyteKey,
} from "~/config/lab-reference-ranges";
import { cn } from "~/lib/utils/cn";
import { todayISO } from "~/lib/utils/date";
import { runEngineAndPersist } from "~/lib/rules/engine";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { LabResult } from "~/types/clinical";

const ALL_KEYS = Object.keys(ANALYTE_BY_KEY) as AnalyteKey[];

export default function AnalyteDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ analyte: string }>();
  const key = params?.analyte as AnalyteKey | undefined;
  const def = key && ALL_KEYS.includes(key) ? ANALYTE_BY_KEY[key] : undefined;

  const labs = useLiveQuery(() => latestLabs(60));

  const [newValue, setNewValue] = useState("");
  const [newDate, setNewDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const points: MetricPoint[] = useMemo(() => {
    if (!key) return [];
    return (labs ?? [])
      .slice()
      .reverse()
      .filter((l) => typeof l[key as keyof LabResult] === "number")
      .map((l) => ({
        date: l.date,
        value: l[key as keyof LabResult] as number,
      }));
  }, [labs, key]);

  if (!def) return notFound();

  const rows = (labs ?? []).filter(
    (l) => typeof l[key as keyof LabResult] === "number",
  );
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

  const yMax = def.ref
    ? Math.max(def.ref[1] * 1.6, latest?.value ?? 0)
    : latest?.value
      ? latest.value * 1.4
      : 100;

  async function addValue() {
    const parsed = Number.parseFloat(newValue);
    if (!Number.isFinite(parsed)) return;
    setSaving(true);
    try {
      const date = newDate || todayISO();
      const existing = await db.labs.where("date").equals(date).first();
      if (existing?.id) {
        await db.labs.update(existing.id, {
          [key as string]: parsed,
          updated_at: now(),
        });
      } else {
        const row: LabResult = {
          date,
          source: "external",
          [key as string]: parsed,
          created_at: now(),
          updated_at: now(),
        } as LabResult;
        await db.labs.add(row);
      }
      setNewValue("");
      await runEngineAndPersist();
    } finally {
      setSaving(false);
    }
  }

  async function removeFromRow(row: LabResult) {
    if (!row.id) return;
    // Strip this key; if the row becomes empty, delete the row.
    const stripped: Partial<LabResult> = { ...row, updated_at: now() };
    delete (stripped as Record<string, unknown>)[key as string];
    const remainingAnalytes = ALL_KEYS.filter(
      (k) => typeof (stripped as Record<string, unknown>)[k] === "number",
    );
    if (remainingAnalytes.length === 0) {
      await db.labs.delete(row.id);
    } else {
      await db.labs.update(row.id, {
        [key as string]: undefined,
        updated_at: now(),
      });
    }
    await runEngineAndPersist();
  }

  const status = latest ? flagStatus(key as AnalyteKey, latest.value) : "normal";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <button
          type="button"
          onClick={() => router.push("/labs")}
          className="mono mb-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-3 w-3" />
          {locale === "zh" ? "返回化验" : "All labs"}
        </button>
        <PageHeader
          eyebrow={def.label[locale]}
          title={
            <>
              {latest ? (
                <span className="num">{formatAnalyte(key as AnalyteKey, latest.value)}</span>
              ) : (
                "—"
              )}
              <span className="mono ml-2 text-base font-normal text-ink-400">
                {def.unit}
              </span>
            </>
          }
          subtitle={def.note ? def.note[locale] : undefined}
        />
      </div>

      {/* Status + delta strip */}
      <div className="flex flex-wrap items-center gap-2">
        {latest && (
          <span
            className={cn(
              "a-chip",
              status === "high" ? "warn" : status === "low" ? "warn" : "ok",
            )}
          >
            {status === "high"
              ? locale === "zh"
                ? "高"
                : "High"
              : status === "low"
                ? locale === "zh"
                  ? "低"
                  : "Low"
                : locale === "zh"
                  ? "正常"
                  : "In range"}
          </span>
        )}
        {typeof deltaPct === "number" && (
          <span className={cn("a-chip", deltaGood ? "ok" : deltaPct === 0 ? "" : "warn")}>
            {deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "—"} {Math.abs(deltaPct)}%
            <span className="ml-1 text-ink-400">
              {locale === "zh" ? "自首次" : "since first"}
            </span>
          </span>
        )}
        {def.ref && (
          <span className="mono text-[10px] uppercase tracking-wider text-ink-400">
            {locale === "zh" ? "参考" : "ref"} {def.ref[0]}–{def.ref[1]} {def.unit}
          </span>
        )}
      </div>

      {/* Chart */}
      <Card className="p-4">
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
      </Card>

      {/* Quick add */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Plus className="h-4 w-4 text-ink-500" />
          <div className="eyebrow">
            {locale === "zh" ? "添加一项结果" : "Add a result"}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <Field label={`${def.label[locale]} (${def.unit})`}>
            <TextInput
              inputMode="decimal"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={def.ref ? `${def.ref[0]} – ${def.ref[1]}` : ""}
            />
          </Field>
          <Field label={locale === "zh" ? "采样日期" : "Collected"}>
            <TextInput
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button
              onClick={addValue}
              disabled={saving || !newValue.trim()}
            >
              {saving
                ? locale === "zh"
                  ? "保存中…"
                  : "Saving…"
                : locale === "zh"
                  ? "保存"
                  : "Save"}
            </Button>
          </div>
        </div>
        <Link
          href="/ingest"
          className="mt-3 flex items-center justify-between rounded-md border border-dashed border-ink-200 px-3 py-2 text-xs text-ink-500 hover:border-ink-400 hover:text-ink-900"
        >
          <span className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            {locale === "zh"
              ? "或上传一份报告 —— 自动提取多项结果"
              : "Or upload a lab report — auto-extract all analytes"}
          </span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </Card>

      {/* Clinical note */}
      {def.note && (
        <div
          className="flex items-start gap-2.5 rounded-md p-3"
          style={{ background: "var(--tide-soft)" }}
        >
          <Sparkles
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--tide-2)" }}
          />
          <div className="flex-1 text-xs leading-relaxed text-ink-900">
            {def.note[locale]}
          </div>
        </div>
      )}

      {/* History table */}
      <section className="space-y-2.5">
        <h2 className="eyebrow">
          {locale === "zh" ? "历史记录" : "History"} · {rows.length}
        </h2>
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-ink-500">
            {locale === "zh"
              ? "还没有此项结果。添加一条或上传一份报告。"
              : "No results yet. Add one above or upload a report."}
          </Card>
        ) : (
          <Card className="px-4 py-1">
            <div className="divide-y divide-ink-100/70">
              {rows.map((r) => {
                const v = r[key as keyof LabResult] as number;
                const status = flagStatus(key as AnalyteKey, v);
                return (
                  <div
                    key={r.id ?? `${r.date}-${v}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5"
                  >
                    <div>
                      <div className="text-[13.5px] font-medium text-ink-900">
                        {format(parseISO(r.date), "d MMM yyyy")}
                      </div>
                      {r.notes && (
                        <div className="mono mt-0.5 line-clamp-1 text-[10.5px] text-ink-400">
                          {r.notes}
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        "num font-semibold",
                        status === "normal"
                          ? "text-ink-900"
                          : "text-[var(--warn)]",
                      )}
                    >
                      {formatAnalyte(key as AnalyteKey, v)}
                      <span className="mono ml-1 text-[9px] font-medium text-ink-400">
                        {def.unit}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromRow(r)}
                      aria-label="delete"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-[var(--warn)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
