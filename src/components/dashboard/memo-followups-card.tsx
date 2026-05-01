"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Mic,
  MicOff,
  Loader2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { useVoiceTranscription } from "~/hooks/use-voice-transcription";
import { Card } from "~/components/ui/card";
import { Alert } from "~/components/ui/alert";
import { cn } from "~/lib/utils/cn";

// Dashboard surface for the AI nurse's follow-up questions. Reads
// the most recent voice memo; if its parse left 1–2 follow-ups, we
// show them with the same recording flow as /diary inline. Once dad
// records an answer, the new memo becomes the most recent — its own
// follow-ups (or none) replace the surface, so the card naturally
// disappears when the dialogue is "complete".
//
// Auto-hides when:
//   · No memos exist
//   · Latest memo has no parsed_fields yet (still parsing)
//   · Latest memo has no follow-up questions
//   · Latest memo is older than 48h (stale prompts feel intrusive)

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export function MemoFollowUpsCard() {
  const locale = useLocale();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const latestMemo = useLiveQuery(
    () =>
      db.voice_memos
        .orderBy("recorded_at")
        .reverse()
        .first(),
    [],
  );

  const [showRecorder, setShowRecorder] = useState(false);
  const voice = useVoiceTranscription({
    locale,
    source: "diary",
    enteredBy,
    onTranscribed: () => {
      // The new memo becomes the latest → useLiveQuery picks it up
      // and this component re-renders with the new (or no) follow-ups.
    },
  });

  // Reset the recorder UI whenever we move to a new memo's follow-ups
  // (i.e. the patient just answered the previous batch).
  useEffect(() => {
    setShowRecorder(false);
  }, [latestMemo?.id]);

  if (!latestMemo) return null;
  const questions = latestMemo.parsed_fields?.follow_up_questions ?? [];
  if (questions.length === 0) return null;

  const recordedAt = new Date(latestMemo.recorded_at).getTime();
  if (Date.now() - recordedAt > STALE_AFTER_MS) return null;

  const recording = voice?.status === "recording";
  const transcribing = voice?.status === "transcribing";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--tide-2)]">
            <Sparkles className="h-3 w-3" aria-hidden />
            {locale === "zh" ? "AI 想问" : "AI nurse asks"}
          </div>
          <ul className="mt-2 space-y-1.5">
            {questions.map((q, i) => (
              <li
                key={i}
                className="text-[13.5px] italic leading-snug text-ink-900"
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href={`/memos/${latestMemo.id}`}
          aria-label={locale === "zh" ? "查看详情" : "Open memo"}
          className="shrink-0 text-ink-400 hover:text-ink-700"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-3 border-t border-ink-100 pt-3">
        {!voice ? (
          <Alert variant="info" role="status" className="text-[12px]">
            {locale === "zh"
              ? "此浏览器不支持录音，去 /diary 用其他设备答复。"
              : "This browser can't record audio. Open /diary on another device to answer."}
          </Alert>
        ) : !showRecorder && !recording && !transcribing ? (
          <button
            type="button"
            onClick={() => {
              setShowRecorder(true);
              void voice.start();
            }}
            className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-[13px] font-medium text-paper hover:scale-[1.02] transition-transform"
          >
            <Mic className="h-3.5 w-3.5" />
            {locale === "zh" ? "录音回答" : "Record answer"}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (recording) voice.stop();
                else void voice.start();
              }}
              disabled={transcribing}
              aria-label={
                recording
                  ? locale === "zh" ? "停止录音" : "Stop"
                  : locale === "zh" ? "开始录音" : "Record"
              }
              className={cn(
                "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-md transition-all",
                recording
                  ? "bg-[var(--warn,#d97706)] text-white"
                  : "bg-ink-900 text-paper",
                transcribing && "opacity-60",
              )}
            >
              {recording && (
                <span className="absolute inset-0 animate-ping rounded-full bg-[var(--warn,#d97706)]/40" />
              )}
              {transcribing ? (
                <Loader2 className="relative h-5 w-5 animate-spin" />
              ) : recording ? (
                <MicOff className="relative h-5 w-5" />
              ) : (
                <Mic className="relative h-5 w-5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ink-900">
                {recording
                  ? locale === "zh" ? "正在录音…" : "Recording…"
                  : transcribing
                    ? locale === "zh" ? "正在识别…" : "Transcribing…"
                    : locale === "zh" ? "再次轻点开始" : "Tap to start"}
              </div>
              {transcribing && voice.liveText && (
                <div className="mt-1 line-clamp-2 text-[11.5px] text-ink-500">
                  {voice.liveText}
                </div>
              )}
            </div>
          </div>
        )}
        {voice?.error && (
          <p className="mt-2 text-[11.5px] text-[var(--warn)]">
            {voice.error}
          </p>
        )}
      </div>
    </Card>
  );
}
