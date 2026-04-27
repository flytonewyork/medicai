"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { runEngineAndPersist } from "~/lib/rules/engine";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";
import { Check, Thermometer } from "lucide-react";

const SCALES = [
  {
    key: "energy",
    good: "high" as const,
    labelEn: "Energy",
    labelZh: "精力",
    anchorLoEn: "none",
    anchorHiEn: "full",
    anchorLoZh: "无",
    anchorHiZh: "充沛",
  },
  {
    key: "pain",
    good: "low" as const,
    labelEn: "Pain",
    labelZh: "疼痛",
    anchorLoEn: "none",
    anchorHiEn: "worst",
    anchorLoZh: "无",
    anchorHiZh: "最痛",
  },
  {
    key: "nausea",
    good: "low" as const,
    labelEn: "Nausea",
    labelZh: "恶心",
    anchorLoEn: "none",
    anchorHiEn: "severe",
    anchorLoZh: "无",
    anchorHiZh: "严重",
  },
] as const;

type ScaleKey = (typeof SCALES)[number]["key"];

export function QuickCheckinCard() {
  const locale = useLocale();
  const t = useT();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const today = todayISO();
  const existing = useLiveQuery(
    () => db.daily_entries.where("date").equals(today).first(),
    [today],
  );
  const [values, setValues] = useState<Record<ScaleKey, number>>({
    energy: 5,
    pain: 0,
    nausea: 0,
  });
  const [fever, setFever] = useState(false);
  const [feverTemp, setFeverTemp] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // After save, the live query picks up `existing` and unmounts this card.
  // The transient "Saved" flash below bridges the gap so the patient sees
  // acknowledgment before the card disappears.
  if (existing && !justSaved) return null;

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const ts = now();
      const tempNum = Number.parseFloat(feverTemp);
      // Only write the three scales the patient actually touched +
      // fever (which has its own toggle). Per CLINICAL_FRAMEWORK.md,
      // every clinical field is optional — undefined means "not
      // entered today", which is the correct semantic when the
      // patient took the 30-second card path. Hardcoding 5s for
      // sleep / appetite / mood would lie to the rule engine and
      // pollute trends.
      await db.daily_entries.add({
        date: today,
        entered_at: ts,
        entered_by: enteredBy,
        energy: values.energy,
        pain_worst: values.pain,
        pain_current: values.pain,
        nausea: values.nausea,
        fever,
        fever_temp: fever && Number.isFinite(tempNum) ? tempNum : undefined,
        created_at: ts,
        updated_at: ts,
      });
      try {
        await runEngineAndPersist();
      } catch (engineErr) {
        // Entry is saved; zone engine failed. Log and warn but don't lose
        // the data by re-throwing.
        // eslint-disable-next-line no-console
        console.warn("[zone-engine] evaluation failed after quick-checkin", engineErr);
        setSaveError(
          locale === "zh"
            ? "已记录，但提醒评估失败。"
            : "Saved, but the alert check didn't run.",
        );
      }
      setJustSaved(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[quick-checkin] save failed", err);
      setSaveError(
        locale === "zh"
          ? "保存失败，请再试一次。"
          : "Couldn't save — please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (justSaved) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-ink-900">
              {locale === "zh" ? "今日已记录" : "Saved for today"}
            </div>
            <p className="mt-0.5 text-[12.5px] text-ink-500">
              {locale === "zh"
                ? "想补充细节？"
                : "Want to add detail?"}{" "}
              <Link
                href="/daily/new"
                className="text-[var(--tide-2)] hover:underline"
              >
                {locale === "zh" ? "完整日志" : "Full log"}
              </Link>
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">
            {locale === "zh" ? "今日记录 · 快速" : "Today's check-in · quick"}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {locale === "zh"
              ? "三个滑块 —— 30 秒就好。详情可以稍后补。"
              : "Three sliders. 30 seconds. Add detail later if you want."}
          </p>
        </div>
        <Link
          href="/daily/new"
          className="mono text-[10px] uppercase tracking-wider text-ink-400 hover:text-ink-900"
        >
          {locale === "zh" ? "完整日志 →" : "Full log →"}
        </Link>
      </div>

      <div className="mt-4 space-y-4">
        {SCALES.map((s) => (
          <ScaleRow
            key={s.key}
            label={locale === "zh" ? s.labelZh : s.labelEn}
            anchorLo={locale === "zh" ? s.anchorLoZh : s.anchorLoEn}
            anchorHi={locale === "zh" ? s.anchorHiZh : s.anchorHiEn}
            value={values[s.key]}
            onChange={(v) =>
              setValues((prev) => ({ ...prev, [s.key]: v }))
            }
          />
        ))}
        <FeverRow
          locale={locale}
          fever={fever}
          temp={feverTemp}
          onFeverChange={setFever}
          onTempChange={setFeverTemp}
        />
      </div>

      {saveError && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-xs text-[var(--warn)]"
        >
          {saveError}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-wider text-ink-400">
          {today}
        </div>
        <Button onClick={save} disabled={saving} size="lg">
          <Check className="h-4 w-4" />
          {saving
            ? t("common.saving")
            : locale === "zh"
              ? "保存今日"
              : "Save today"}
        </Button>
      </div>
    </Card>
  );
}

function ScaleRow({
  label,
  anchorLo,
  anchorHi,
  value,
  onChange,
}: {
  label: string;
  anchorLo?: string;
  anchorHi?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink-900">{label}</span>
        <span className="serif num text-xl leading-none text-ink-900">
          {value}
          <span className="ml-0.5 mono text-[10px] font-normal text-ink-400">
            /10
          </span>
        </span>
      </div>
      {(anchorLo || anchorHi) && (
        <div className="mt-1 flex justify-between">
          {anchorLo && (
            <span className="mono text-[9.5px] uppercase tracking-wider text-ink-400">
              0 = {anchorLo}
            </span>
          )}
          {anchorHi && (
            <span className="mono text-[9.5px] uppercase tracking-wider text-ink-400">
              10 = {anchorHi}
            </span>
          )}
        </div>
      )}
      <div className="mt-1.5 grid grid-cols-11 gap-1.5">
        {Array.from({ length: 11 }, (_, n) => {
          const on = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "h-10 rounded-md border text-[11px] font-semibold transition-colors",
                on
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 bg-paper-2 text-ink-500 hover:border-ink-400",
              )}
              aria-label={`${label} ${n}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeverRow({
  locale,
  fever,
  temp,
  onFeverChange,
  onTempChange,
}: {
  locale: "en" | "zh";
  fever: boolean;
  temp: string;
  onFeverChange: (v: boolean) => void;
  onTempChange: (v: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-[var(--r-md)] p-3"
      style={{
        background: fever ? "var(--warn-soft)" : "var(--ink-100)",
      }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{
          background: fever ? "var(--warn)" : "var(--paper-2)",
          color: fever ? "var(--paper)" : "var(--ink-500)",
        }}
      >
        <Thermometer className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-ink-900">
          {locale === "zh" ? "发热" : "Fever"}
        </div>
        <div className="text-[11px] text-ink-500">
          {locale === "zh"
            ? "体温 ≥ 38 °C 立即联系值班"
            : "≥ 38 °C is urgent — call the on-call team"}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {(
          [
            ["no", false],
            ["yes", true],
          ] as const
        ).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => onFeverChange(v)}
            className={cn(
              "h-11 min-w-[44px] rounded-md border px-4 text-sm font-semibold",
              fever === v
                ? "border-ink-900 bg-ink-900 text-paper"
                : "border-ink-200 bg-paper-2 text-ink-500",
            )}
          >
            {locale === "zh" ? (v ? "是" : "否") : v ? "Yes" : "No"}
          </button>
        ))}
      </div>
      {fever && (
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={temp}
          onChange={(e) => onTempChange(e.target.value)}
          placeholder="°C"
          className="h-11 w-24 rounded-md border border-ink-200 bg-paper-2 px-3 text-base tabular-nums"
        />
      )}
    </div>
  );
}
