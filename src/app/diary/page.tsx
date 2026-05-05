"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  Mic,
  Loader2,
  FlaskConical,
  ClipboardList,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { syncPendingVoiceMemoAudio } from "~/lib/voice-memo/cloud";
import { db } from "~/lib/db/dexie";
import { buildDiaryDays, type DiaryDay } from "~/lib/diary/build";
import { todayISO } from "~/lib/utils/date";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/ui/page-header";
import { Alert } from "~/components/ui/alert";
import { EmptyState } from "~/components/ui/empty-state";
import { VoiceMemoCard } from "~/components/diary/voice-memo-card";
import type { AgentRunRow } from "~/types/agent";

// /diary — the patient's daily timeline. One section per day, newest
// first, combining:
//   · voice memos (with playback + transcript)
//   · daily-form summary
//   · free-text logs from /log
//   · labs received that day
//   · agent reports run from those inputs
//
// The page is also the primary capture surface for voice memos that
// aren't otherwise tied to /log or meal-ingest — a big mic button at
// the top records, transcribes, and persists in one motion.

const WINDOW_DAYS_DEFAULT = 14;

export default function DiaryPage() {
  const locale = useLocale();

  // useLiveQuery on each table keeps the diary fresh as new rows land
  // — recording a memo, opening /daily, syncing labs all reflect here
  // without a refresh.
  const memoCount = useLiveQuery(() => db.voice_memos.count(), [], 0);
  const dailyCount = useLiveQuery(() => db.daily_entries.count(), [], 0);
  const logCount = useLiveQuery(() => db.log_events.count(), [], 0);
  const labCount = useLiveQuery(() => db.labs.count(), [], 0);
  const runCount = useLiveQuery(() => db.agent_runs.count(), [], 0);

  const [windowDays, setWindowDays] = useState(WINDOW_DAYS_DEFAULT);
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const to = todayISO();
    const fromDate = new Date(to);
    fromDate.setDate(fromDate.getDate() - windowDays);
    const from = fromDate.toISOString().slice(0, 10);
    // Hard timeout so a hung Dexie query (corrupt index, OPFS lock,
    // huge backlog) can't trap the user on an infinite spinner. 10s
    // is well past any healthy aggregation; past that, surface an
    // error and let the user retry / open a different page.
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setLoadError("timeout");
      setLoading(false);
    }, 10000);
    void buildDiaryDays({ from, to, includeEmpty: true })
      .then((rows) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setDays(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setLoadError(err instanceof Error ? err.message : "unknown");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // Re-run whenever any underlying table changes row count or the
    // window expands. Cheap because the aggregator reads each table
    // once and bins in memory.
  }, [memoCount, dailyCount, logCount, labCount, runCount, windowDays]);

  // Best-effort: try to flush any voice-memo audio that's still waiting
  // to upload. Runs on mount and never throws into render.
  useEffect(() => {
    void syncPendingVoiceMemoAudio();
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={todayISO()}
        title={locale === "zh" ? "日记" : "Diary"}
        subtitle={
          locale === "zh"
            ? "语音、日常、化验、智能体记录都在这里。"
            : "Voice memos, daily form, labs, and agent reports — one timeline."
        }
      />

      {/* Slice 8: /log is the canonical compose surface — text +
        voice + tags + AI fan-out all in one. /diary stays focused
        on the timeline view, with one prominent CTA so the patient
        knows where to start a new entry. */}
      <Link
        href="/log"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-5 py-3 text-[14px] font-medium text-paper hover:scale-[1.02] transition-transform"
      >
        <Mic className="h-4 w-4" />
        {locale === "zh" ? "新建一条记录" : "New entry"}
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-ink-500">
          {locale === "zh"
            ? `最近 ${windowDays} 天`
            : `Last ${windowDays} days`}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setWindowDays((n) => n + 14)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {locale === "zh" ? "再加 14 天" : "Show 14 more"}
        </Button>
      </div>

      {loadError ? (
        <Alert variant="warn" role="alert">
          {locale === "zh"
            ? "日记加载失败，请刷新页面重试。"
            : "Diary failed to load. Try refreshing the page."}
        </Alert>
      ) : loading && days.length === 0 ? (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {locale === "zh" ? "正在整理日记…" : "Loading diary…"}
          </div>
        </Card>
      ) : days.every((d) => !d.has_content) ? (
        <EmptyState
          icon={Mic}
          title={
            locale === "zh"
              ? "还没有记录"
              : "Nothing recorded yet"
          }
          description={
            locale === "zh"
              ? "轻点麦克风录第一段日记，或去「日志」「日常」补充。"
              : "Tap the mic above to record your first memo, or open /log or /daily."
          }
        />
      ) : (
        <ol className="space-y-6">
          {days
            .filter((d) => d.has_content)
            .map((d) => (
              <DayBlock key={d.day} day={d} locale={locale} />
            ))}
        </ol>
      )}
    </div>
  );
}

function DayBlock({ day, locale }: { day: DiaryDay; locale: "en" | "zh" }) {
  const date = parseISO(day.day);
  const heading =
    day.day === todayISO()
      ? locale === "zh"
        ? "今天"
        : "Today"
      : format(date, locale === "zh" ? "M月d日 (EEE)" : "EEE, d MMM", {
          // The date-fns format engine is fine without locale config
          // for the purposes of this short header.
        });

  const dailySummary = day.daily_entry
    ? buildDailySummary(day.daily_entry, locale)
    : null;
  const reports = day.agent_runs
    .map((r) => r)
    .sort((a, b) => b.ran_at.localeCompare(a.ran_at));

  return (
    <li>
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="serif text-[18px] tracking-tight text-ink-900">
          {heading}
        </h2>
        <span className="mono text-[10.5px] uppercase tracking-wider text-ink-400">
          {day.day}
        </span>
      </div>
      <div className="space-y-2.5">
        {day.voice_memos.map((m) => (
          <VoiceMemoCard key={m.id} memo={m} locale={locale} />
        ))}
        {dailySummary && (
          <Card className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-ink-500">
              <ClipboardList className="h-3 w-3" aria-hidden />
              <span className="font-medium">
                {locale === "zh" ? "日常表" : "Daily form"}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-900">
              {dailySummary}
            </p>
          </Card>
        )}
        {day.log_events.map((l) => (
          <Card key={l.id} className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-ink-500">
              <Sparkles className="h-3 w-3" aria-hidden />
              <span className="font-medium">
                {locale === "zh" ? "日志" : "Log"}
              </span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {format(parseISO(l.at), "HH:mm")}
              </span>
              {l.input.tags.length > 0 && (
                <span className="ml-auto text-[10.5px] text-ink-400">
                  {l.input.tags.map((tag) => `#${tag}`).join(" ")}
                </span>
              )}
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-900">
              {l.input.text}
            </p>
          </Card>
        ))}
        {day.labs.length > 0 && (
          <Card className="p-3">
            <div className="flex items-center gap-2 text-[11px] text-ink-500">
              <FlaskConical className="h-3 w-3" aria-hidden />
              <span className="font-medium">
                {locale === "zh"
                  ? `${day.labs.length} 项化验`
                  : `${day.labs.length} lab${day.labs.length === 1 ? "" : "s"}`}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-ink-500">
              {locale === "zh" ? "在「化验」中查看详情。" : "See Labs for detail."}
            </p>
          </Card>
        )}
        {reports.map((r) => (
          <AgentReportCard key={r.id} run={r} locale={locale} />
        ))}
      </div>
    </li>
  );
}

function AgentReportCard({
  run,
  locale,
}: {
  run: AgentRunRow;
  locale: "en" | "zh";
}) {
  const text =
    locale === "zh"
      ? run.output.daily_report.zh
      : run.output.daily_report.en;
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-[11px] text-ink-500">
        <Sparkles className="h-3 w-3" aria-hidden />
        <span className="font-medium">
          {locale === "zh" ? `${run.agent_id} 智能体` : `${run.agent_id} agent`}
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          {format(parseISO(run.ran_at), "HH:mm")}
        </span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700">
        {text}
      </p>
    </Card>
  );
}

function buildDailySummary(
  entry: NonNullable<DiaryDay["daily_entry"]>,
  locale: "en" | "zh",
): string {
  const parts: string[] = [];
  function push(label: { en: string; zh: string }, value: string) {
    parts.push(`${locale === "zh" ? label.zh : label.en} ${value}`);
  }
  if (typeof entry.energy === "number") {
    push({ en: "energy", zh: "精力" }, `${entry.energy}/10`);
  }
  if (typeof entry.sleep_quality === "number") {
    push({ en: "sleep", zh: "睡眠" }, `${entry.sleep_quality}/10`);
  }
  if (typeof entry.pain_worst === "number") {
    push({ en: "pain", zh: "疼痛" }, `${entry.pain_worst}/10`);
  }
  if (typeof entry.mood_clarity === "number") {
    push({ en: "mood", zh: "心情" }, `${entry.mood_clarity}/10`);
  }
  if (typeof entry.weight_kg === "number") {
    push({ en: "weight", zh: "体重" }, `${entry.weight_kg.toFixed(1)} kg`);
  }
  if (parts.length === 0) {
    return locale === "zh" ? "已记录（无数值）" : "Logged (no numerics)";
  }
  return parts.join(" · ");
}

