"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  Mic,
  ChevronRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  Circle,
  CloudOff,
  CloudUpload,
} from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { db } from "~/lib/db/dexie";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/ui/page-header";
import { EmptyState } from "~/components/ui/empty-state";
import type { VoiceMemo } from "~/types/voice-memo";

// Reverse-chronological list of every voice memo. Each row shows
// timestamp, duration, a transcript snippet, the source (diary / log
// / meal / phone), the parse state (parsing / pending review / logged
// to forms), and a cloud-sync indicator. Tap → /memos/[id] detail
// view with the preview form and audit trail.

export default function MemosPage() {
  const locale = useLocale();
  const memos = useLiveQuery(
    () =>
      db.voice_memos
        .orderBy("recorded_at")
        .reverse()
        .toArray(),
    [],
    [] as VoiceMemo[],
  );

  const loading = memos === undefined;
  const list = memos ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "语音记录" : "Memos"}
        subtitle={
          locale === "zh"
            ? "倒序列出每一段录音。点开可看到完整文字、AI 解读、以及登入到表单的内容。"
            : "Every recording, newest first. Tap one to see the full transcript, AI breakdown, and what was logged to your forms."
        }
      />

      {loading ? (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {locale === "zh" ? "载入中…" : "Loading…"}
          </div>
        </Card>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Mic}
          title={
            locale === "zh"
              ? "还没有录音"
              : "No memos yet"
          }
          description={
            locale === "zh"
              ? "去「日记」轻点麦克风录第一段。"
              : "Open the diary and tap the mic to record your first."
          }
        />
      ) : (
        <ol className="space-y-2">
          {list.map((m) => (
            <li key={m.id}>
              <MemoRow memo={m} locale={locale} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MemoRow({ memo, locale }: { memo: VoiceMemo; locale: "en" | "zh" }) {
  const state = parseState(memo);
  const time = formatWhen(memo.recorded_at, locale);
  const duration = formatDuration(memo.duration_ms);
  const snippet = describe(memo, locale);
  const cloudSynced = Boolean(memo.audio_path);

  return (
    <Link
      href={`/memos/${memo.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 rounded-lg"
    >
      <Card className="p-3 hover:bg-paper-2/40 transition-colors">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-700">
            <Mic className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-500">
              <span className="font-medium tabular-nums">{time}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{duration}</span>
              <span aria-hidden>·</span>
              <span>{sourceLabel(memo.source_screen, locale)}</span>
              <span className="ml-auto inline-flex items-center gap-1">
                {cloudSynced ? (
                  <CloudUpload className="h-3 w-3 text-ink-400" aria-hidden />
                ) : (
                  <CloudOff className="h-3 w-3 text-ink-400" aria-hidden />
                )}
                <StateChip state={state} locale={locale} />
              </span>
            </div>
            <p
              className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-900"
              title={snippet}
            >
              {snippet}
            </p>
          </div>
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-ink-300"
            aria-hidden
          />
        </div>
      </Card>
    </Link>
  );
}

function StateChip({
  state,
  locale,
}: {
  state: ReturnType<typeof parseState>;
  locale: "en" | "zh";
}) {
  if (state === "parsing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        {locale === "zh" ? "识别中" : "parsing"}
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tide-2)]/12 px-1.5 py-0.5 text-[10px] text-[var(--tide-2)]">
        <Circle className="h-2.5 w-2.5" />
        {locale === "zh" ? "待审核" : "review"}
      </span>
    );
  }
  if (state === "logged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
        <CheckCircle2 className="h-2.5 w-2.5" />
        {locale === "zh" ? "已登入" : "logged"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500">
      <Sparkles className="h-2.5 w-2.5" />
      {locale === "zh" ? "仅文字" : "text only"}
    </span>
  );
}

type State = "parsing" | "pending" | "logged" | "transcript_only";

function parseState(memo: VoiceMemo): State {
  if (!memo.parsed_fields) return memo.transcript ? "parsing" : "transcript_only";
  if (memo.parsed_fields.applied_patches?.length) return "logged";
  return "pending";
}

function describe(memo: VoiceMemo, locale: "en" | "zh"): string {
  const parsed = memo.parsed_fields;
  if (parsed) {
    const headline = headlineFromParse(parsed, locale);
    if (headline) return headline;
  }
  const text = memo.transcript.trim();
  if (text) return text.length > 140 ? text.slice(0, 140) + "…" : text;
  return locale === "zh" ? "（无可识别文字）" : "(no transcript)";
}

function headlineFromParse(
  parsed: NonNullable<VoiceMemo["parsed_fields"]>,
  locale: "en" | "zh",
): string | null {
  // Prefer a one-line summary that captures the memo's flavour: a
  // clinic visit beats numbers, numbers beat personal, personal beats
  // empty.
  const visit = parsed.clinical?.clinic_visit?.summary;
  if (visit) return visit.length > 140 ? visit.slice(0, 140) + "…" : visit;

  const dailyBits: string[] = [];
  if (typeof parsed.energy === "number") {
    dailyBits.push(`${locale === "zh" ? "精力" : "energy"} ${parsed.energy}/10`);
  }
  if (typeof parsed.pain_current === "number") {
    dailyBits.push(`${locale === "zh" ? "疼痛" : "pain"} ${parsed.pain_current}/10`);
  }
  if (typeof parsed.sleep_quality === "number") {
    dailyBits.push(`${locale === "zh" ? "睡眠" : "sleep"} ${parsed.sleep_quality}/10`);
  }
  if (dailyBits.length) return dailyBits.join(" · ");

  if (parsed.personal?.mood_narrative) return parsed.personal.mood_narrative;
  if (parsed.notes) return parsed.notes;
  return null;
}

function formatWhen(iso: string, locale: "en" | "zh"): string {
  const d = parseISO(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return format(d, "HH:mm");
  }
  return format(d, locale === "zh" ? "M月d日 HH:mm" : "d MMM, HH:mm");
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function sourceLabel(
  source: VoiceMemo["source_screen"],
  locale: "en" | "zh",
): string {
  if (locale === "zh") {
    switch (source) {
      case "log":
        return "日志";
      case "meal_ingest":
        return "饮食";
      case "phone_note":
        return "电话";
      case "diary":
      default:
        return "日记";
    }
  }
  switch (source) {
    case "log":
      return "log";
    case "meal_ingest":
      return "meal";
    case "phone_note":
      return "phone";
    case "diary":
    default:
      return "diary";
  }
}
