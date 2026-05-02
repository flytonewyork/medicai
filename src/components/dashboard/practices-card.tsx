"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import {
  isCustomPractice,
  scheduleSummary,
} from "~/lib/medication/practices";
import { logMedicationEvent } from "~/lib/medication/log";
import { expectedDosesToday } from "~/lib/medication/log";
import type { Medication } from "~/types/medication";
import { Check, ChevronRight, Pause, Play, Sparkles, X } from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { todayISO, formatClockSeconds } from "~/lib/utils/date";

// Best-effort duration parse: "20 min", "10 breaths", "5m", "1h". Falls back
// to 5 minutes when the dose string doesn't mention a time unit.
function durationSeconds(dose: string | undefined): number {
  if (!dose) return 5 * 60;
  const s = dose.toLowerCase();
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  if (h) return Math.round(Number(h[1]) * 3600);
  const m = s.match(/(\d+(?:\.\d+)?)\s*m(?!s)/);
  if (m) return Math.round(Number(m[1]) * 60);
  const sec = s.match(/(\d+)\s*s/);
  if (sec) return Number(sec[1]);
  return 5 * 60;
}

/**
 * Dashboard card for daily behavioural practices — breathing, meditation,
 * walking, resistance training. Shows every active behavioural-category
 * medication expected today (incl. catalogue items like qigong + custom
 * user-added) and supports tap-to-log.
 *
 * Runs independent of treatment cycle so practices stay visible on rest
 * weeks and off-cycle intervals.
 */
export function PracticesCard() {
  const locale = useLocale();
  const meds = useLiveQuery(
    () =>
      db.medications
        .where("category")
        .equals("behavioural")
        .filter((m) => m.active)
        .toArray(),
    [],
  );
  const today = todayISO();
  const todaysEvents = useLiveQuery(
    () =>
      db.medication_events
        .where("logged_at")
        .startsWith(today)
        .toArray(),
    [today],
  );

  const rows = useMemo(() => {
    return (meds ?? [])
      .map((m) => {
        const due = expectedDosesToday(m.schedule);
        const logged = (todaysEvents ?? []).filter(
          (e) => e.medication_id === m.id && e.event_type === "taken",
        ).length;
        return { med: m, due, logged };
      })
      .filter((r) => r.due > 0 || r.logged > 0)
      .sort(
        (a, b) =>
          (a.logged < a.due ? 0 : 1) - (b.logged < b.due ? 0 : 1),
      );
  }, [meds, todaysEvents]);

  // Hide the card entirely when nothing is scheduled or logged today — keeps
  // the dashboard quiet until the user has set up at least one practice.
  // We also drop the card on days where the user has practices configured
  // but none are due today and none have been logged: a placeholder "no
  // practices scheduled" panel is dead UI on the dashboard, and the
  // /practices route + FAB still let the patient add one.
  if (meds === undefined || todaysEvents === undefined) return null;
  if ((meds?.length ?? 0) === 0) return null;
  if (rows.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="eyebrow">
            {locale === "zh" ? "今日修习" : "Practices today"}
          </div>
          <div className="serif mt-1 text-[16px] text-ink-900">
            {locale === "zh"
              ? "每日行为节奏"
              : "Your daily rhythm"}
          </div>
        </div>
        <Link
          href="/practices"
          className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900"
        >
          {locale === "zh" ? "管理" : "Manage"}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map(({ med, due, logged }) => (
          <PracticeRow
            key={med.id}
            med={med}
            due={due}
            logged={logged}
            locale={locale}
          />
        ))}
      </ul>
    </Card>
  );
}

function PracticeRow({
  med,
  due,
  logged,
  locale,
}: {
  med: Medication;
  due: number;
  logged: number;
  locale: "en" | "zh";
}) {
  const catalogue = DRUGS_BY_ID[med.drug_id];
  const name =
    (locale === "zh" ? catalogue?.name.zh : catalogue?.name.en) ??
    med.display_name ??
    med.drug_id;
  const complete = due > 0 && logged >= due;
  const count = `${logged}/${Math.max(due, 1)}`;
  const custom = isCustomPractice(med);

  const total = useMemo(() => durationSeconds(med.dose), [med.dose]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Single interval keyed on running/paused state, not on `remaining` —
  // the previous version re-created the interval every tick, which on
  // slow renders briefly let two intervals overlap and double-decrement.
  const isRunning = remaining !== null;
  useEffect(() => {
    if (!isRunning || paused) return;
    const id = setInterval(() => {
      setRemaining((r) => (r === null ? r : r - 1));
    }, 1000);
    tickRef.current = id;
    return () => {
      clearInterval(id);
      if (tickRef.current === id) tickRef.current = null;
    };
  }, [isRunning, paused]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0) {
      void finishSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const onLog = async () => {
    if (!med.id) return;
    await logMedicationEvent({
      medication: med,
      event_type: "taken",
      source: "daily_checkin",
    });
  };

  const startSession = () => {
    setPaused(false);
    setRemaining(total);
  };

  const cancelSession = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRemaining(null);
    setPaused(false);
  };

  const finishSession = async () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRemaining(null);
    setPaused(false);
    await onLog();
  };

  const running = remaining !== null;

  return (
    <li className="rounded-[var(--r-md)] bg-paper-2 px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onLog}
          disabled={complete}
          aria-label={complete ? "Done" : "Mark done without timer"}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
            complete
              ? "border-[var(--ok)] bg-[var(--ok)] text-white"
              : "border-ink-300 bg-paper hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]",
          )}
        >
          {complete ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={running ? undefined : startSession}
          disabled={complete || running}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <div
            className={cn(
              "truncate text-[13px] font-medium",
              complete ? "text-ink-500 line-through" : "text-ink-900",
            )}
          >
            {name}
            {custom && (
              <span className="mono ml-2 text-[9px] uppercase tracking-[0.12em] text-ink-400">
                custom
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-500">
            {med.dose} · {scheduleSummary(med.schedule, locale)}
          </div>
        </button>
        {!running && !complete && (
          <button
            type="button"
            onClick={startSession}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
            aria-label={locale === "zh" ? "开始" : "Start"}
          >
            <Play className="h-3 w-3" />
            {locale === "zh" ? "开始" : "Start"}
          </button>
        )}
        {!running && (
          <span className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-ink-400">
            {count}
          </span>
        )}
      </div>
      {running && (
        <div className="mt-2 flex items-center gap-2 border-t border-ink-100 pt-2">
          <span className="mono text-[18px] font-medium tabular-nums text-ink-900">
            {formatClockSeconds(remaining ?? 0)}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:border-[var(--tide-2)]"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {paused
              ? locale === "zh"
                ? "继续"
                : "Resume"
              : locale === "zh"
                ? "暂停"
                : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => void finishSession()}
            className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2 py-1 text-[11px] text-paper hover:bg-ink-700"
          >
            <Check className="h-3 w-3" />
            {locale === "zh" ? "完成" : "Done"}
          </button>
          <button
            type="button"
            onClick={cancelSession}
            className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-500 hover:text-ink-900"
          >
            <X className="h-3 w-3" />
            {locale === "zh" ? "取消" : "Cancel"}
          </button>
        </div>
      )}
    </li>
  );
}
