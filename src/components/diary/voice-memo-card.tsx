"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, CloudUpload, CloudOff } from "lucide-react";
import type { VoiceMemo, VoiceMemoParsedFields } from "~/types/voice-memo";
import { resolveVoiceMemoAudioUrl } from "~/lib/voice-memo/cloud";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils/cn";

// Diary card for one voice memo. Shows the recorded time, duration,
// transcript, and an inline play button. Audio is fetched lazily —
// we don't construct an Object URL until the patient actually taps
// play, so a long diary doesn't allocate a hundred Blob URLs at once.

interface VoiceMemoCardProps {
  memo: VoiceMemo;
  locale: "en" | "zh";
}

export function VoiceMemoCard({ memo, locale }: VoiceMemoCardProps) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const revokeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      revokeRef.current?.();
    };
  }, []);

  async function ensureUrl(): Promise<string | null> {
    if (audioUrl) return audioUrl;
    if (!memo.id) return null;
    const resolved = await resolveVoiceMemoAudioUrl(memo.id);
    if (!resolved) return null;
    revokeRef.current = resolved.revoke ?? null;
    setAudioUrl(resolved.url);
    return resolved.url;
  }

  async function togglePlay() {
    setError(null);
    if (playing) {
      audioRef.current?.pause();
      return;
    }
    try {
      const url = await ensureUrl();
      if (!url) {
        setError(
          locale === "zh"
            ? "录音不可用（仅在录制设备上保存）。"
            : "Audio not available (kept on the recording device only).",
        );
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = url;
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const time = formatTime(memo.recorded_at, locale);
  const duration = formatDuration(memo.duration_ms);
  const cloudState: "synced" | "local" =
    memo.audio_path ? "synced" : "local";

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={
            playing
              ? locale === "zh" ? "暂停" : "Pause"
              : locale === "zh" ? "播放" : "Play"
          }
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            "bg-ink-900 text-paper hover:scale-105 transition-transform",
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px]" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-ink-500">
            <Mic className="h-3 w-3" aria-hidden />
            <span className="font-medium tabular-nums">{time}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{duration}</span>
            <span aria-hidden>·</span>
            <span>
              {memo.source_screen
                ? sourceLabel(memo.source_screen, locale)
                : locale === "zh"
                  ? "日记"
                  : "diary"}
            </span>
            <span
              aria-label={
                cloudState === "synced"
                  ? locale === "zh" ? "已上传至云端" : "Stored in cloud"
                  : locale === "zh" ? "仅本地" : "Local only"
              }
              className="ml-auto text-ink-400"
            >
              {cloudState === "synced" ? (
                <CloudUpload className="h-3 w-3" aria-hidden />
              ) : (
                <CloudOff className="h-3 w-3" aria-hidden />
              )}
            </span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-900">
            {memo.transcript || (
              <span className="italic text-ink-400">
                {locale === "zh"
                  ? "（无可识别文字）"
                  : "(no transcript)"}
              </span>
            )}
          </p>
          {memo.parsed_fields && (
            <ParsedFieldsRow
              parsed={memo.parsed_fields}
              locale={locale}
            />
          )}
          {error && (
            <p className="mt-1.5 text-[11px] text-[var(--warn)]">{error}</p>
          )}
        </div>
      </div>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </Card>
  );
}

function formatTime(iso: string, locale: "en" | "zh"): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return locale === "zh" ? `${hh}:${mm}` : `${hh}:${mm}`;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function ParsedFieldsRow({
  parsed,
  locale,
}: {
  parsed: VoiceMemoParsedFields;
  locale: "en" | "zh";
}) {
  const chips = collectChips(parsed, locale);
  const showLowConfidenceHint =
    parsed.confidence !== "high" && (chips.length > 0 || parsed.notes);

  if (chips.length === 0 && !parsed.notes) {
    if (parsed.confidence === "low") {
      return (
        <p className="mt-1.5 text-[10.5px] italic text-ink-400">
          {locale === "zh"
            ? "（信息不足，未提取结构化字段）"
            : "(not enough detail to extract structured fields)"}
        </p>
      );
    }
    return null;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                parsed.confidence === "high"
                  ? "bg-[var(--tide-2)]/12 text-[var(--tide-2)]"
                  : "bg-ink-100 text-ink-500",
              )}
            >
              {c.label}
              <span className="font-normal opacity-70">{c.value}</span>
            </span>
          ))}
        </div>
      )}
      {parsed.notes && (
        <p className="text-[11.5px] italic text-ink-500">
          {locale === "zh" ? "笔记：" : "Notes: "}
          {parsed.notes}
        </p>
      )}
      {showLowConfidenceHint && (
        <p className="text-[10.5px] text-ink-400">
          {locale === "zh"
            ? `识别可信度：${confidenceLabel(parsed.confidence, "zh")}（高可信度才会自动写入日常表）`
            : `Confidence: ${confidenceLabel(parsed.confidence, "en")} — only high-confidence fields auto-fill the daily form.`}
        </p>
      )}
    </div>
  );
}

function collectChips(
  parsed: VoiceMemoParsedFields,
  locale: "en" | "zh",
): { label: string; value: string }[] {
  const chips: { label: string; value: string }[] = [];
  function num(label: { en: string; zh: string }, val: number | undefined, suffix = "/10") {
    if (typeof val !== "number") return;
    chips.push({
      label: locale === "zh" ? label.zh : label.en,
      value: `${val}${suffix}`,
    });
  }
  function bool(label: { en: string; zh: string }, val: boolean | undefined) {
    if (val !== true) return;
    chips.push({
      label: locale === "zh" ? label.zh : label.en,
      value: locale === "zh" ? "是" : "yes",
    });
  }
  num({ en: "energy", zh: "精力" }, parsed.energy);
  num({ en: "sleep", zh: "睡眠" }, parsed.sleep_quality);
  num({ en: "appetite", zh: "胃口" }, parsed.appetite);
  num({ en: "pain", zh: "疼痛" }, parsed.pain_current);
  num({ en: "pain (worst)", zh: "最痛" }, parsed.pain_worst);
  num({ en: "mood", zh: "心情" }, parsed.mood_clarity);
  num({ en: "nausea", zh: "恶心" }, parsed.nausea);
  num({ en: "fatigue", zh: "疲倦" }, parsed.fatigue);
  num({ en: "anorexia", zh: "厌食" }, parsed.anorexia);
  num({ en: "abdo pain", zh: "腹痛" }, parsed.abdominal_pain);
  num({ en: "neuro hands", zh: "手麻" }, parsed.neuropathy_hands, "/4");
  num({ en: "neuro feet", zh: "脚麻" }, parsed.neuropathy_feet, "/4");
  if (typeof parsed.weight_kg === "number") {
    chips.push({
      label: locale === "zh" ? "体重" : "weight",
      value: `${parsed.weight_kg.toFixed(1)} kg`,
    });
  }
  if (typeof parsed.diarrhoea_count === "number") {
    chips.push({
      label: locale === "zh" ? "腹泻" : "diarrhoea",
      value: `${parsed.diarrhoea_count}×`,
    });
  }
  bool({ en: "cold dysaesthesia", zh: "冷敏感" }, parsed.cold_dysaesthesia);
  bool({ en: "mouth sores", zh: "口腔溃疡" }, parsed.mouth_sores);
  bool({ en: "fever", zh: "发烧" }, parsed.fever);
  return chips;
}

function confidenceLabel(
  c: VoiceMemoParsedFields["confidence"],
  locale: "en" | "zh",
): string {
  if (locale === "zh") {
    if (c === "high") return "高";
    if (c === "medium") return "中";
    return "低";
  }
  return c;
}

function sourceLabel(
  source: NonNullable<VoiceMemo["source_screen"]>,
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
