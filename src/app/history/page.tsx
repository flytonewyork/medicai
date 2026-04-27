"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import {
  aggregateHistory,
  groupByDate,
  type HistoryCategory,
  type HistoryEntry,
  type HistoryTone,
} from "~/lib/state/history";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Compass,
  FlaskConical,
  Heart,
  Pill,
  Scan,
  Sparkles,
  Syringe,
  Users,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

type Filter = "all" | HistoryCategory;

const FILTERS: { key: Filter; en: string; zh: string }[] = [
  { key: "all", en: "All", zh: "全部" },
  { key: "signal", en: "Signals", zh: "信号" },
  { key: "action", en: "Actions", zh: "行动" },
  { key: "medication", en: "Meds", zh: "用药" },
  { key: "care_team", en: "Care team", zh: "医疗团队" },
  { key: "lab", en: "Labs", zh: "化验" },
  { key: "imaging", en: "Imaging", zh: "影像" },
  { key: "treatment", en: "Treatment", zh: "治疗" },
  { key: "check_in", en: "Check-ins", zh: "每日记录" },
  { key: "decision", en: "Decisions", zh: "决策" },
  { key: "life_event", en: "Life events", zh: "生活事件" },
];

const CATEGORY_ICON: Record<
  HistoryCategory,
  React.ComponentType<{ className?: string }>
> = {
  signal: AlertTriangle,
  action: Sparkles,
  medication: Pill,
  care_team: Users,
  lab: FlaskConical,
  imaging: Scan,
  treatment: Syringe,
  check_in: Heart,
  decision: Compass,
  life_event: Activity,
};

const TONE_STYLE: Record<
  HistoryTone,
  { bg: string; fg: string; dot: string }
> = {
  info: {
    bg: "bg-paper-2",
    fg: "text-ink-700",
    dot: "bg-ink-300",
  },
  positive: {
    bg: "bg-[var(--ok-soft)]",
    fg: "text-ink-900",
    dot: "bg-[var(--ok)]",
  },
  caution: {
    bg: "bg-[var(--sand)]/40",
    fg: "text-ink-900",
    dot: "bg-[oklch(45%_0.06_70)]",
  },
  warning: {
    bg: "bg-[var(--warn-soft)]",
    fg: "text-ink-900",
    dot: "bg-[var(--warn)]",
  },
};

export default function HistoryPage() {
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const [windowDays, setWindowDays] = useState<number | null>(90);

  const signals = useLiveQuery(
    () => db.change_signals.toArray(),
    [],
  );
  const signalEvents = useLiveQuery(
    () => db.signal_events.toArray(),
    [],
  );
  const medications = useLiveQuery(() => db.medications.toArray(), []);
  const medicationEvents = useLiveQuery(
    () => db.medication_events.toArray(),
    [],
  );
  const careTeamContacts = useLiveQuery(
    () => db.care_team_contacts.toArray(),
    [],
  );
  const labs = useLiveQuery(() => db.labs.toArray(), []);
  const imaging = useLiveQuery(() => db.imaging.toArray(), []);
  const cycles = useLiveQuery(() => db.treatment_cycles.toArray(), []);
  const dailies = useLiveQuery(() => db.daily_entries.toArray(), []);
  const decisions = useLiveQuery(() => db.decisions.toArray(), []);
  const lifeEvents = useLiveQuery(() => db.life_events.toArray(), []);

  const allEntries = useMemo<HistoryEntry[]>(() => {
    if (
      !signals ||
      !signalEvents ||
      !medications ||
      !medicationEvents ||
      !careTeamContacts ||
      !labs ||
      !imaging ||
      !cycles ||
      !dailies ||
      !decisions ||
      !lifeEvents
    ) {
      return [];
    }
    return aggregateHistory({
      signals,
      signalEvents,
      medications,
      medicationEvents,
      careTeamContacts,
      labs,
      imaging,
      cycles,
      dailyEntries: dailies,
      decisions,
      lifeEvents,
      windowDays: windowDays ?? undefined,
    });
  }, [
    signals,
    signalEvents,
    medications,
    medicationEvents,
    careTeamContacts,
    labs,
    imaging,
    cycles,
    dailies,
    decisions,
    lifeEvents,
    windowDays,
  ]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? allEntries
        : allEntries.filter((e) => e.category === filter),
    [allEntries, filter],
  );

  const groupedByDate = useMemo(() => groupByDate(filtered), [filtered]);

  const countsByCategory = useMemo(() => {
    const out: Partial<Record<Filter, number>> = { all: allEntries.length };
    for (const e of allEntries) {
      out[e.category] = (out[e.category] ?? 0) + 1;
    }
    return out;
  }, [allEntries]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "全部" : "Everything"}
        title={locale === "zh" ? "活动历史" : "Activity history"}
      />

      <div className="flex items-center gap-2">
        <WindowButton
          active={windowDays === 30}
          onClick={() => setWindowDays(30)}
        >
          30d
        </WindowButton>
        <WindowButton
          active={windowDays === 90}
          onClick={() => setWindowDays(90)}
        >
          90d
        </WindowButton>
        <WindowButton
          active={windowDays === 365}
          onClick={() => setWindowDays(365)}
        >
          1y
        </WindowButton>
        <WindowButton
          active={windowDays === null}
          onClick={() => setWindowDays(null)}
        >
          {locale === "zh" ? "全部" : "All"}
        </WindowButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = countsByCategory[f.key] ?? 0;
          if (f.key !== "all" && count === 0) return null;
          return (
            <FilterChip
              key={f.key}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
              count={count}
            >
              {f.key === "all"
                ? locale === "zh"
                  ? f.zh
                  : f.en
                : locale === "zh"
                  ? f.zh
                  : f.en}
            </FilterChip>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-5 text-sm text-ink-500">
          {locale === "zh"
            ? "此过滤条件下暂无记录。"
            : "No activity in this view."}
        </Card>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(({ date, entries }) => (
            <DateGroup
              key={date}
              date={date}
              entries={entries}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WindowButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mono rounded-full border px-3 py-1 text-[10.5px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-ink-900 bg-ink-900 text-paper"
          : "border-ink-200 bg-paper text-ink-500 hover:border-ink-400",
      )}
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors",
        active
          ? "border-[var(--tide-2)] bg-[var(--tide-2)] text-paper"
          : "border-ink-200 bg-paper text-ink-600 hover:border-ink-400",
      )}
    >
      <span>{children}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "mono text-[9.5px] tracking-wider",
            active ? "text-paper/80" : "text-ink-400",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function DateGroup({
  date,
  entries,
  locale,
}: {
  date: string;
  entries: HistoryEntry[];
  locale: "en" | "zh";
}) {
  const d = parseISO(date);
  const label =
    locale === "zh"
      ? format(d, "yyyy 年 M 月 d 日 · EEEE")
      : format(d, "EEEE · d MMM yyyy");
  return (
    <section>
      <div className="eyebrow mb-2">{label}</div>
      <ul className="space-y-1.5">
        {entries.map((e) => (
          <li key={e.id}>
            <HistoryRow entry={e} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistoryRow({
  entry,
  locale,
}: {
  entry: HistoryEntry;
  locale: "en" | "zh";
}) {
  const Icon = CATEGORY_ICON[entry.category] ?? Bell;
  const tone = TONE_STYLE[entry.tone];
  const body = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--r-md)] px-3.5 py-3 transition-colors",
        tone.bg,
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-paper text-ink-700 ring-1 ring-ink-100">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className={cn("text-[13px] font-semibold", tone.fg)}>
            {entry.title[locale]}
          </div>
          <time className="mono shrink-0 text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
            {format(parseISO(entry.at), "HH:mm")}
          </time>
        </div>
        {entry.detail && (
          <div className={cn("mt-0.5 truncate text-[12px]", tone.fg)}>
            {entry.detail[locale]}
          </div>
        )}
      </div>
    </div>
  );
  if (entry.href) {
    return (
      <Link href={entry.href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

// Suppress unused-import warning for CheckCircle2 — kept for future use in
// tone variations.
void CheckCircle2;
