"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  Mic,
  MicOff,
  Loader2,
  FlaskConical,
  ClipboardList,
  Sparkles,
  CalendarDays,
  CheckCircle2,
  X,
  Undo2,
  ChevronRight,
} from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { useVoiceTranscription } from "~/hooks/use-voice-transcription";
import { syncPendingVoiceMemoAudio } from "~/lib/voice-memo/cloud";
import { undoAppliedPatch } from "~/lib/voice-memo/apply";
import { db } from "~/lib/db/dexie";
import { buildDiaryDays, type DiaryDay } from "~/lib/diary/build";
import { todayISO } from "~/lib/utils/date";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/ui/page-header";
import { Alert } from "~/components/ui/alert";
import { EmptyState } from "~/components/ui/empty-state";
import { VoiceMemoCard } from "~/components/diary/voice-memo-card";
import { cn } from "~/lib/utils/cn";
import type { AgentRunRow } from "~/types/agent";
import type { AppliedPatch, VoiceMemo } from "~/types/voice-memo";

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
  const enteredBy = useUIStore((s) => s.enteredBy);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const to = todayISO();
    const fromDate = new Date(to);
    fromDate.setDate(fromDate.getDate() - windowDays);
    const from = fromDate.toISOString().slice(0, 10);
    void buildDiaryDays({ from, to, includeEmpty: true }).then((rows) => {
      if (cancelled) return;
      setDays(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
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

  // The most recently captured memo id — used to drive the inline
  // preview/undo card under the recorder. Cleared when the patient
  // dismisses the preview or starts a new recording.
  const [lastMemoId, setLastMemoId] = useState<number | null>(null);
  const voice = useVoiceTranscription({
    locale,
    source: "diary",
    enteredBy,
    onPersisted: ({ memo_id }) => setLastMemoId(memo_id),
    onTranscribed: () => {
      // Persistence is handled by the hook; we just need to refresh
      // the visible window. Counting Dexie tables already triggers
      // useLiveQuery, so this callback can stay no-op.
    },
  });
  const recording = voice?.status === "recording";
  useEffect(() => {
    if (recording) setLastMemoId(null);
  }, [recording]);

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

      <RecorderCard voice={voice} locale={locale} />

      {lastMemoId !== null && (
        <RecentMemoCard
          memoId={lastMemoId}
          locale={locale}
          onDismiss={() => setLastMemoId(null)}
        />
      )}

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

      {loading && days.length === 0 ? (
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

function RecorderCard({
  voice,
  locale,
}: {
  voice: ReturnType<typeof useVoiceTranscription>;
  locale: "en" | "zh";
}) {
  if (!voice) {
    return (
      <Alert variant="info" role="status">
        {locale === "zh"
          ? "此浏览器不支持录音。请使用 iOS Safari 或最新 Chrome。"
          : "This browser can't record audio. Use Safari on iOS or current Chrome."}
      </Alert>
    );
  }

  const recording = voice.status === "recording";
  const transcribing = voice.status === "transcribing";

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (recording) voice.stop();
            else void voice.start();
          }}
          disabled={transcribing}
          aria-label={
            recording
              ? locale === "zh" ? "停止录音" : "Stop recording"
              : locale === "zh" ? "开始录音" : "Start recording"
          }
          aria-pressed={recording}
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-all",
            recording
              ? "bg-[var(--warn,#d97706)] text-white"
              : "bg-ink-900 text-paper hover:scale-105",
            transcribing && "opacity-60",
          )}
        >
          {recording && (
            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--warn,#d97706)]/40" />
          )}
          {transcribing ? (
            <Loader2 className="relative h-6 w-6 animate-spin" />
          ) : recording ? (
            <MicOff className="relative h-6 w-6" />
          ) : (
            <Mic className="relative h-6 w-6" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink-900">
            {recording
              ? locale === "zh" ? "正在录音" : "Recording"
              : transcribing
                ? locale === "zh" ? "正在识别…" : "Transcribing…"
                : locale === "zh" ? "今天怎么样？" : "How's today?"}
          </div>
          <div className="text-[12px] text-ink-500">
            {recording
              ? locale === "zh"
                ? "把要记的事说一遍，再轻点停止。"
                : "Say what you want to remember, then tap stop."
              : transcribing
                ? locale === "zh"
                  ? "录音已结束，正在生成文字。"
                  : "Recording done, transcribing."
                : locale === "zh"
                  ? "轻点录音，AI 会保存录音并整理文字。"
                  : "Tap to record. We keep the audio and the transcript."}
          </div>
        </div>
      </div>
      {transcribing && voice.liveText && (
        <div className="mt-3 rounded-md bg-paper-2/60 px-3 py-2 text-[13px] leading-relaxed text-ink-900">
          <span className="text-ink-500 text-[10.5px] uppercase tracking-wider">
            {locale === "zh" ? "正在识别" : "Live"}
          </span>
          <p className="mt-1 whitespace-pre-wrap">{voice.liveText}</p>
        </div>
      )}
      {voice.error && (
        <Alert variant="warn" role="alert" className="mt-3">
          {locale === "zh"
            ? `录音出错：${voice.error}`
            : `Voice error: ${voice.error}`}
        </Alert>
      )}
    </Card>
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

// Inline preview that follows the recorder. Drives the post-record UX:
// transcribing → showing applied patches with Undo → showing a Review
// CTA when the parse came back medium/low confidence and nothing
// auto-applied. Dismissible — the patient closes it when they're done.
function RecentMemoCard({
  memoId,
  locale,
  onDismiss,
}: {
  memoId: number;
  locale: "en" | "zh";
  onDismiss: () => void;
}) {
  const memo = useLiveQuery<VoiceMemo | undefined>(
    () => db.voice_memos.get(memoId) as Promise<VoiceMemo | undefined>,
    [memoId],
  );
  if (!memo) return null;

  const parsed = memo.parsed_fields;
  const liveApplied = (parsed?.applied_patches ?? []).filter(
    (p) => !p.undone_at,
  );
  const transcribing = !memo.transcript.trim();
  const parsing = Boolean(memo.transcript.trim()) && !parsed;

  let body: React.ReactNode;
  if (transcribing) {
    body = (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {locale === "zh" ? "正在识别…" : "Transcribing…"}
      </span>
    );
  } else if (parsing) {
    body = (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {locale === "zh" ? "AI 正在解读…" : "Claude reading the memo…"}
      </span>
    );
  } else if (liveApplied.length > 0) {
    body = (
      <AppliedSummary
        memoId={memoId}
        patches={liveApplied}
        locale={locale}
      />
    );
  } else if (parsed && parsed.confidence !== "high") {
    body = (
      <Link
        href={`/memos/${memoId}`}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--tide-2)] hover:underline"
      >
        {locale === "zh"
          ? `识别可信度：${parsed.confidence === "medium" ? "中" : "低"} — 审核并登入`
          : `Confidence: ${parsed.confidence} — review and log`}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    );
  } else {
    body = (
      <span className="text-[12px] text-ink-500">
        {locale === "zh"
          ? "AI 没有从这段录音里抽出可登入的内容。"
          : "Claude didn't pull anything loggable from this memo."}
      </span>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
            {locale === "zh" ? "刚才的录音" : "Just recorded"}
          </div>
          <div className="mt-1.5">{body}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={locale === "zh" ? "关闭" : "Dismiss"}
          className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:text-ink-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </Card>
  );
}

function AppliedSummary({
  memoId,
  patches,
  locale,
}: {
  memoId: number;
  patches: AppliedPatch[];
  locale: "en" | "zh";
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onUndo(index: number) {
    setBusy(index);
    setError(null);
    const r = await undoAppliedPatch(memoId, index);
    setBusy(null);
    if (!r.ok) setError(r.error ?? "Undo failed");
  }

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {locale === "zh"
          ? `已登入 ${patches.length} 项`
          : `Logged ${patches.length} item${patches.length === 1 ? "" : "s"}`}
      </div>
      <ul className="space-y-1.5">
        {patches.map((p, i) => (
          <li
            key={`${p.applied_at}-${i}`}
            className="flex items-start justify-between gap-3 rounded-md border border-ink-100 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-ink-900">
                {tableLabel(p.table, locale)}
              </div>
              <div className="text-[11.5px] text-ink-700">
                {summariseFields(p.fields)}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUndo(i)}
              disabled={busy === i}
            >
              {busy === i ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              {locale === "zh" ? "撤销" : "Undo"}
            </Button>
          </li>
        ))}
      </ul>
      <Link
        href={`/memos/${memoId}`}
        className="inline-flex items-center gap-1 text-[11.5px] text-ink-500 hover:text-ink-900 hover:underline"
      >
        {locale === "zh" ? "查看详情" : "Open memo"}
        <ChevronRight className="h-3 w-3" aria-hidden />
      </Link>
      {error && (
        <p className="text-[11.5px] text-[var(--warn)]">{error}</p>
      )}
    </div>
  );
}

function tableLabel(
  table: AppliedPatch["table"],
  locale: "en" | "zh",
): string {
  if (locale === "zh") {
    if (table === "daily_entries") return "日常表";
    if (table === "life_events") return "门诊记录";
    return "预约";
  }
  if (table === "daily_entries") return "Daily form";
  if (table === "life_events") return "Clinic visit";
  return "Appointment";
}

function summariseFields(
  fields: AppliedPatch["fields"],
): string {
  return Object.entries(fields)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}
