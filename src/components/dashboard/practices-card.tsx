"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import {
  isCustomPractice,
  scheduleSummary,
} from "~/lib/medication/practices";
import { logMedicationEvent } from "~/lib/medication/log";
import { expectedDosesToday } from "~/lib/medication/log";
import type { Medication } from "~/types/medication";
import { Check, ChevronRight, Plus, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { todayISO } from "~/lib/utils/date";

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
  if (meds === undefined || todaysEvents === undefined) return null;
  if ((meds?.length ?? 0) === 0) return null;

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

      {rows.length === 0 ? (
        <div className="mt-3 flex items-center justify-between rounded-[var(--r-md)] bg-paper-2 p-3 text-[12px] text-ink-600">
          <span>
            {locale === "zh"
              ? "今日没有已排程的修习。"
              : "No practices scheduled for today."}
          </span>
          <Link href="/practices/new">
            <Button variant="ghost" size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              {locale === "zh" ? "添加" : "Add"}
            </Button>
          </Link>
        </div>
      ) : (
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
      )}
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

  const onLog = async () => {
    if (!med.id) return;
    await logMedicationEvent({
      medication: med,
      event_type: "taken",
      source: "daily_checkin",
    });
  };

  return (
    <li className="flex items-center gap-3 rounded-[var(--r-md)] bg-paper-2 px-3 py-2">
      <button
        type="button"
        onClick={onLog}
        disabled={complete}
        aria-label={complete ? "Done" : "Log practice"}
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
      <div className="min-w-0 flex-1">
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
      </div>
      <span className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-ink-400">
        {count}
      </span>
    </li>
  );
}
