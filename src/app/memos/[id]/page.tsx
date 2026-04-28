"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Mic,
  Pause,
  Play,
  Loader2,
  RefreshCw,
  Send,
  CheckCircle2,
  CalendarPlus,
  ClipboardList,
  Heart,
  ChevronRight,
} from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { db } from "~/lib/db/dexie";
import { reparseVoiceMemo } from "~/lib/voice-memo/parse";
import { retranscribeVoiceMemo } from "~/lib/voice-memo/retranscribe";
import {
  applyMemoPatches,
  extractDailyShape,
  type DailyOverridePatch,
} from "~/lib/voice-memo/apply";
import { resolveVoiceMemoAudioUrl } from "~/lib/voice-memo/cloud";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/ui/page-header";
import { Alert } from "~/components/ui/alert";
import type {
  AppliedPatch,
  VoiceMemo,
  VoiceMemoParsedFields,
} from "~/types/voice-memo";
import { cn } from "~/lib/utils/cn";

// Memo detail. Shows the full transcript, audio playback, and Claude's
// structured parse as a PREVIEW FORM the patient confirms before any
// daily-tracking field, life event, or appointment row is created.
// Once applied, the audit trail at the bottom records exactly what
// got written to which Dexie table.

export default function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = use(params);
  const id = Number(idStr);
  const locale = useLocale();
  const router = useRouter();

  const memo = useLiveQuery<VoiceMemo | undefined>(
    () =>
      Number.isFinite(id)
        ? (db.voice_memos.get(id) as Promise<VoiceMemo | undefined>)
        : Promise.resolve(undefined),
    [id],
  );

  if (memo === undefined) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {locale === "zh" ? "载入中…" : "Loading…"}
          </div>
        </Card>
      </div>
    );
  }
  if (memo === null || !memo) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Alert variant="warn" role="alert">
          {locale === "zh" ? "找不到这段录音。" : "Memo not found."}
        </Alert>
        <div className="mt-4">
          <Button variant="ghost" onClick={() => router.push("/memos")}>
            <ArrowLeft className="h-4 w-4" />
            {locale === "zh" ? "返回列表" : "Back to memos"}
          </Button>
        </div>
      </div>
    );
  }

  return <MemoDetail memo={memo} locale={locale} />;
}

function MemoDetail({
  memo,
  locale,
}: {
  memo: VoiceMemo;
  locale: "en" | "zh";
}) {
  const router = useRouter();
  const parsed = memo.parsed_fields;
  const applied = parsed?.applied_patches ?? [];
  const hasParse = Boolean(parsed);

  const recorded = parseISO(memo.recorded_at);
  const dateLabel = format(
    recorded,
    locale === "zh" ? "yyyy年M月d日" : "EEE, d MMM yyyy",
  );
  const timeLabel = format(recorded, "HH:mm");

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <div>
        <Button variant="ghost" onClick={() => router.push("/memos")}>
          <ArrowLeft className="h-4 w-4" />
          {locale === "zh" ? "全部录音" : "All memos"}
        </Button>
      </div>
      <PageHeader
        eyebrow={`${dateLabel} · ${timeLabel}`}
        title={
          locale === "zh"
            ? "录音详情"
            : "Memo"
        }
        subtitle={
          hasParse
            ? locale === "zh"
              ? "下面是 AI 听到的内容。确认无误后再写入表单。"
              : "Here's what the AI heard. Review, then choose what to log."
            : locale === "zh"
              ? "正在识别…"
              : "Parsing…"
        }
      />

      <PlaybackCard memo={memo} locale={locale} />
      <TranscriptCard memo={memo} locale={locale} />

      {parsed ? (
        <PreviewForm memo={memo} parsed={parsed} locale={locale} />
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {locale === "zh"
              ? "AI 正在解读，请稍等。"
              : "Claude is reading the memo. Hold on a moment."}
          </div>
        </Card>
      )}

      {parsed?.personal && <PersonalCard personal={parsed.personal} locale={locale} />}

      {applied.length > 0 && (
        <AuditCard patches={applied} locale={locale} />
      )}
    </div>
  );
}

function PlaybackCard({
  memo,
  locale,
}: {
  memo: VoiceMemo;
  locale: "en" | "zh";
}) {
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

  async function ensureUrl() {
    if (audioUrl) return audioUrl;
    if (!memo.id) return null;
    const resolved = await resolveVoiceMemoAudioUrl(memo.id);
    if (!resolved) return null;
    revokeRef.current = resolved.revoke ?? null;
    setAudioUrl(resolved.url);
    return resolved.url;
  }

  async function toggle() {
    setError(null);
    if (playing) {
      audioRef.current?.pause();
      return;
    }
    const url = await ensureUrl();
    if (!url) {
      setError(
        locale === "zh"
          ? "本设备没有保存这段录音的音频。"
          : "Audio not available on this device.",
      );
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = url;
      try {
        await audioRef.current.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  const duration = formatDuration(memo.duration_ms);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={
            playing
              ? locale === "zh" ? "暂停" : "Pause"
              : locale === "zh" ? "播放" : "Play"
          }
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-900 text-paper hover:scale-105 transition-transform"
        >
          {playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-[1px]" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink-900 inline-flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5 text-ink-400" aria-hidden />
            {locale === "zh" ? "原始录音" : "Original recording"}
          </div>
          <div className="text-[11px] text-ink-500 tabular-nums">
            {duration} ·{" "}
            {memo.audio_path
              ? locale === "zh" ? "已上传至云端" : "synced to cloud"
              : locale === "zh" ? "仅本地" : "local only"}
          </div>
          {error && (
            <p className="mt-1 text-[11px] text-[var(--warn)]">{error}</p>
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

function TranscriptCard({
  memo,
  locale,
}: {
  memo: VoiceMemo;
  locale: "en" | "zh";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !memo.transcript.trim();

  async function onRetry() {
    if (!memo.id) return;
    setBusy(true);
    setError(null);
    const r = await retranscribeVoiceMemo(memo.id);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Re-transcribe failed");
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
          {locale === "zh" ? "转写" : "Transcript"}
        </div>
        {empty && memo.audio_media_id ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRetry}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {locale === "zh" ? "重新转写" : "Re-transcribe"}
          </Button>
        ) : null}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-900">
        {memo.transcript || (
          <span className="italic text-ink-400">
            {locale === "zh"
              ? "（暂无文字 — 可重试转写）"
              : "(no transcript yet — tap re-transcribe)"}
          </span>
        )}
      </p>
      {error && (
        <p className="mt-2 text-[11.5px] text-[var(--warn)]">{error}</p>
      )}
    </Card>
  );
}

function PreviewForm({
  memo,
  parsed,
  locale,
}: {
  memo: VoiceMemo;
  parsed: VoiceMemoParsedFields;
  locale: "en" | "zh";
}) {
  // The patient may tweak any numeric or boolean before applying. We
  // initialise from extractDailyShape() so the form mirrors what
  // Claude returned and stays in sync if the parse changes via re-run.
  const initial = useMemo(() => extractDailyShape(parsed), [parsed]);
  const [edits, setEdits] = useState<DailyOverridePatch>(initial);
  useEffect(() => {
    setEdits(initial);
  }, [initial]);

  const [includeDaily, setIncludeDaily] = useState(true);
  const [includeVisit, setIncludeVisit] = useState(
    Boolean(parsed.clinical?.clinic_visit?.summary),
  );
  const [includeAppts, setIncludeAppts] = useState(
    Boolean(parsed.clinical?.appointments_mentioned?.some((a) => a.confidence === "high")),
  );
  const [busy, setBusy] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedRecently, setAppliedRecently] = useState(false);

  const dailyKeys = Object.keys(initial) as (keyof DailyOverridePatch)[];
  const hasDaily = dailyKeys.length > 0;
  const visit = parsed.clinical?.clinic_visit;
  const appts = parsed.clinical?.appointments_mentioned ?? [];
  const meds = parsed.clinical?.medications_mentioned ?? [];

  const nothingToApply =
    (!includeDaily || !hasDaily) &&
    (!includeVisit || !visit?.summary) &&
    (!includeAppts || appts.every((a) => a.confidence !== "high"));

  async function onApply() {
    if (!memo.id) return;
    setBusy(true);
    setError(null);
    try {
      await applyMemoPatches(memo.id, {
        apply_daily: includeDaily,
        apply_clinic_visit: includeVisit,
        apply_appointments: includeAppts,
        daily_overrides: edits,
      });
      setAppliedRecently(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReparse() {
    if (!memo.id) return;
    setReparsing(true);
    setError(null);
    try {
      await reparseVoiceMemo(memo.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReparsing(false);
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
            {locale === "zh" ? "AI 解读 · 待审核" : "Claude's parse · review"}
          </div>
          <div className="text-[12px] text-ink-500">
            {locale === "zh"
              ? "勾选要写入表单的内容，可以先调整数值。"
              : "Pick what to log. Adjust values first if anything's off."}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReparse}
          disabled={reparsing || busy}
        >
          {reparsing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {locale === "zh" ? "重新识别" : "Re-parse"}
        </Button>
      </div>

      {parsed.confidence !== "high" && (
        <Alert variant="info" role="status">
          {locale === "zh"
            ? "AI 信心：" + (parsed.confidence === "medium" ? "中" : "低")
              + "。建议你确认每一项再登入。"
            : `Confidence: ${parsed.confidence}. Double-check each value before logging.`}
        </Alert>
      )}

      {hasDaily && (
        <DailySection
          locale={locale}
          edits={edits}
          setEdits={setEdits}
          include={includeDaily}
          setInclude={setIncludeDaily}
        />
      )}

      {visit?.summary && (
        <VisitSection
          locale={locale}
          visit={visit}
          include={includeVisit}
          setInclude={setIncludeVisit}
        />
      )}

      {appts.length > 0 && (
        <AppointmentsSection
          locale={locale}
          appts={appts}
          include={includeAppts}
          setInclude={setIncludeAppts}
        />
      )}

      {meds.length > 0 && <MedsSection locale={locale} meds={meds} />}

      {parsed.notes && (
        <div>
          <div className="eyebrow mb-1">
            {locale === "zh" ? "笔记" : "Notes"}
          </div>
          <p className="text-[13px] italic text-ink-500">{parsed.notes}</p>
        </div>
      )}

      {!hasDaily && !visit?.summary && appts.length === 0 && meds.length === 0 && (
        <Alert variant="info" role="status">
          {locale === "zh"
            ? "AI 没有从这段录音里抽出任何临床数据。可以重新识别，或者就把它当作个人日记保存。"
            : "Claude didn't pull any clinical data from this memo. You can re-parse, or just keep it as a diary entry."}
        </Alert>
      )}

      {error && (
        <Alert variant="warn" role="alert">
          {error}
        </Alert>
      )}

      {appliedRecently && (
        <Alert
          variant="ok"
          role="status"
          icon={<CheckCircle2 className="h-4 w-4" />}
        >
          {locale === "zh"
            ? "已写入表单。下方可看到具体内容。"
            : "Logged. See the audit below for what was written."}
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          onClick={onApply}
          disabled={busy || nothingToApply}
          size="lg"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {locale === "zh" ? "登入到表单" : "Log to forms"}
        </Button>
      </div>
    </Card>
  );
}

function DailySection({
  locale,
  edits,
  setEdits,
  include,
  setInclude,
}: {
  locale: "en" | "zh";
  edits: DailyOverridePatch;
  setEdits: (next: DailyOverridePatch) => void;
  include: boolean;
  setInclude: (v: boolean) => void;
}) {
  function setNumber(key: keyof DailyOverridePatch, value: string) {
    const n = Number(value);
    const next = { ...edits } as Record<string, unknown>;
    if (value === "") {
      delete next[key as string];
    } else if (Number.isFinite(n)) {
      next[key as string] = n;
    }
    setEdits(next as DailyOverridePatch);
  }
  function toggleBool(key: keyof DailyOverridePatch) {
    const cur = (edits as Record<string, unknown>)[key as string];
    const next = { ...edits } as Record<string, unknown>;
    if (cur === true) delete next[key as string];
    else next[key as string] = true;
    setEdits(next as DailyOverridePatch);
  }

  const numericRows = (
    [
      ["energy", "energy", "精力"],
      ["sleep_quality", "sleep", "睡眠"],
      ["appetite", "appetite", "胃口"],
      ["pain_current", "pain (now)", "现疼"],
      ["pain_worst", "pain (worst)", "最痛"],
      ["mood_clarity", "mood", "心情"],
      ["nausea", "nausea", "恶心"],
      ["fatigue", "fatigue", "疲倦"],
      ["anorexia", "anorexia", "厌食"],
      ["abdominal_pain", "abdo pain", "腹痛"],
      ["neuropathy_hands", "neuro hands", "手麻"],
      ["neuropathy_feet", "neuro feet", "脚麻"],
      ["weight_kg", "weight (kg)", "体重 kg"],
      ["diarrhoea_count", "diarrhoea (n)", "腹泻次数"],
    ] as [keyof DailyOverridePatch, string, string][]
  ).filter(([key]) => (edits as Record<string, unknown>)[key as string] !== undefined);

  const boolRows = (
    [
      ["cold_dysaesthesia", "cold dysaesthesia", "冷敏感"],
      ["mouth_sores", "mouth sores", "口腔溃疡"],
      ["fever", "fever", "发烧"],
    ] as [keyof DailyOverridePatch, string, string][]
  ).filter(([key]) => (edits as Record<string, unknown>)[key as string] !== undefined);

  if (numericRows.length === 0 && boolRows.length === 0) return null;

  return (
    <div>
      <SectionHeader
        icon={ClipboardList}
        title={locale === "zh" ? "日常表" : "Daily form"}
        include={include}
        setInclude={setInclude}
        locale={locale}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {numericRows.map(([key, en, zh]) => (
          <label
            key={String(key)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border border-ink-100 px-2.5 py-1.5",
              !include && "opacity-50",
            )}
          >
            <span className="text-[12px] text-ink-700">
              {locale === "zh" ? zh : en}
            </span>
            <input
              type="number"
              value={String((edits as Record<string, unknown>)[key as string] ?? "")}
              onChange={(e) => setNumber(key, e.target.value)}
              disabled={!include}
              className="w-16 rounded border border-ink-200 px-1.5 py-0.5 text-right text-[12px] tabular-nums"
            />
          </label>
        ))}
      </div>
      {boolRows.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {boolRows.map(([key, en, zh]) => {
            const value = (edits as Record<string, unknown>)[key as string] === true;
            return (
              <button
                key={String(key)}
                type="button"
                onClick={() => toggleBool(key)}
                disabled={!include}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11.5px] border transition-colors",
                  value
                    ? "border-[var(--warn,#d97706)] bg-[var(--warn,#d97706)]/10 text-[var(--warn,#d97706)]"
                    : "border-ink-200 text-ink-500",
                  !include && "opacity-50",
                )}
              >
                {locale === "zh" ? zh : en}
                {value ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VisitSection({
  locale,
  visit,
  include,
  setInclude,
}: {
  locale: "en" | "zh";
  visit: NonNullable<NonNullable<VoiceMemoParsedFields["clinical"]>["clinic_visit"]>;
  include: boolean;
  setInclude: (v: boolean) => void;
}) {
  return (
    <div>
      <SectionHeader
        icon={Heart}
        title={locale === "zh" ? "门诊记录" : "Clinic visit"}
        include={include}
        setInclude={setInclude}
        locale={locale}
      />
      <div className={cn("mt-2 space-y-1.5 text-[13px]", !include && "opacity-50")}>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-ink-500">
          {visit.provider && <span>{visit.provider}</span>}
          {visit.location && <span>· {visit.location}</span>}
          {visit.visit_date && <span>· {visit.visit_date}</span>}
        </div>
        <p className="text-ink-900">{visit.summary}</p>
        {visit.key_points?.length ? (
          <ul className="ml-4 list-disc text-ink-700 text-[12.5px]">
            {visit.key_points.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        ) : null}
        <div className="text-[11px] text-ink-400">
          {locale === "zh"
            ? "登入后会出现在「家庭时间线」与日记页。"
            : "Once logged, this lands in the family timeline and the diary."}
        </div>
      </div>
    </div>
  );
}

function AppointmentsSection({
  locale,
  appts,
  include,
  setInclude,
}: {
  locale: "en" | "zh";
  appts: NonNullable<
    NonNullable<VoiceMemoParsedFields["clinical"]>["appointments_mentioned"]
  >;
  include: boolean;
  setInclude: (v: boolean) => void;
}) {
  return (
    <div>
      <SectionHeader
        icon={CalendarPlus}
        title={locale === "zh" ? "预约" : "Appointments"}
        include={include}
        setInclude={setInclude}
        locale={locale}
      />
      <ul className={cn("mt-2 space-y-2", !include && "opacity-50")}>
        {appts.map((a, i) => (
          <li
            key={i}
            className="rounded-md border border-ink-100 px-3 py-2 text-[13px]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-ink-900">{a.title}</div>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  a.confidence === "high"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-ink-100 text-ink-500",
                )}
              >
                {a.confidence === "high"
                  ? locale === "zh" ? "可创建" : "auto-create"
                  : locale === "zh" ? "提示" : "hint only"}
              </span>
            </div>
            <div className="text-[11.5px] text-ink-500">
              {a.starts_at && <span>{a.starts_at} </span>}
              {a.location && <span>· {a.location} </span>}
              {a.doctor && <span>· {a.doctor}</span>}
            </div>
            {a.prep && (
              <div className="mt-1 text-[12px] text-ink-700">
                {locale === "zh" ? "准备：" : "Prep: "}
                {a.prep}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-ink-400">
        {locale === "zh"
          ? "只有「可创建」会真正写入预约表，其他作为线索保留在录音里。"
          : "Only auto-create rows get written to /schedule. Hint-only entries stay on this memo as a reminder."}
      </p>
    </div>
  );
}

function MedsSection({
  locale,
  meds,
}: {
  locale: "en" | "zh";
  meds: NonNullable<
    NonNullable<VoiceMemoParsedFields["clinical"]>["medications_mentioned"]
  >;
}) {
  return (
    <div>
      <div className="eyebrow mb-1">
        {locale === "zh" ? "药物提到" : "Medications mentioned"}
      </div>
      <ul className="space-y-1 text-[13px]">
        {meds.map((m, i) => (
          <li key={i} className="text-ink-900">
            <span className="font-medium">{m.name}</span>
            {m.detail && <span className="text-ink-500"> — {m.detail}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-ink-400">
        {locale === "zh"
          ? "记录下来供参考，不会自动写入药物日志。"
          : "Captured for reference. Adherence rows aren't auto-created from memos."}
      </p>
    </div>
  );
}

function PersonalCard({
  personal,
  locale,
}: {
  personal: NonNullable<VoiceMemoParsedFields["personal"]>;
  locale: "en" | "zh";
}) {
  const groups: { label: string; items: string[] | undefined }[] = [
    {
      label: locale === "zh" ? "饮食" : "Food",
      items: personal.food_mentions,
    },
    {
      label: locale === "zh" ? "家人" : "Family",
      items: personal.family_mentions,
    },
    {
      label: locale === "zh" ? "修习" : "Practice",
      items: personal.practice_mentions,
    },
    {
      label: locale === "zh" ? "目标" : "Goals",
      items: personal.goals,
    },
  ];
  const hasAny =
    groups.some((g) => g.items && g.items.length > 0) ||
    Boolean(personal.mood_narrative) ||
    Boolean(personal.observations);
  if (!hasAny) return null;

  return (
    <Card className="p-4 space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
        {locale === "zh" ? "个人 · 仅本机" : "Personal · local only"}
      </div>
      {personal.mood_narrative && (
        <p className="text-[13.5px] italic text-ink-700">
          “{personal.mood_narrative}”
        </p>
      )}
      <div className="space-y-1.5">
        {groups
          .filter((g) => g.items && g.items.length > 0)
          .map((g) => (
            <div key={g.label} className="text-[12.5px]">
              <span className="font-medium text-ink-700">{g.label}:</span>{" "}
              <span className="text-ink-700">{g.items!.join(" · ")}</span>
            </div>
          ))}
      </div>
      {personal.observations && (
        <p className="text-[12px] text-ink-500">{personal.observations}</p>
      )}
      <p className="text-[10.5px] text-ink-400">
        {locale === "zh"
          ? "个人内容保存在本设备，不会同步到云端。"
          : "Personal content stays on this device — never synced to the cloud."}
      </p>
    </Card>
  );
}

function AuditCard({
  patches,
  locale,
}: {
  patches: AppliedPatch[];
  locale: "en" | "zh";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        {locale === "zh" ? "已写入表单" : "What got logged"}
      </div>
      <ul className="mt-2 space-y-2">
        {patches.map((p, i) => (
          <li key={i} className="text-[12.5px]">
            <Link
              href={hrefForPatch(p)}
              className="inline-flex items-center gap-1 font-medium text-[var(--tide-2)] hover:underline"
            >
              {tableLabel(p.table, locale)} · #{p.row_id}
              <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
            <div className="text-[11.5px] text-ink-500">
              {p.op === "create"
                ? locale === "zh" ? "新建" : "created"
                : locale === "zh" ? "更新" : "updated"}{" "}
              · {format(parseISO(p.applied_at), "HH:mm")}
            </div>
            <ul className="mt-1 space-y-0.5 text-[11.5px] text-ink-700">
              {Object.entries(p.fields).map(([k, v]) => (
                <li key={k}>
                  <span className="text-ink-500">{k}:</span>{" "}
                  <span className="font-medium">{String(v)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  include,
  setInclude,
  locale,
}: {
  icon: typeof ClipboardList;
  title: string;
  include: boolean;
  setInclude: (v: boolean) => void;
  locale: "en" | "zh";
}) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-900">
        <Icon className="h-3.5 w-3.5 text-[var(--tide-2)]" aria-hidden />
        {title}
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
        <input
          type="checkbox"
          checked={include}
          onChange={(e) => setInclude(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        {include
          ? locale === "zh" ? "登入" : "include"
          : locale === "zh" ? "跳过" : "skip"}
      </span>
    </label>
  );
}

function tableLabel(
  table: AppliedPatch["table"],
  locale: "en" | "zh",
): string {
  if (locale === "zh") {
    switch (table) {
      case "daily_entries":
        return "日常表";
      case "life_events":
        return "时间线事件";
      case "appointments":
        return "预约";
    }
  }
  switch (table) {
    case "daily_entries":
      return "Daily form";
    case "life_events":
      return "Life event";
    case "appointments":
      return "Appointment";
  }
}

function hrefForPatch(patch: AppliedPatch): string {
  switch (patch.table) {
    case "appointments":
      return `/schedule/${patch.row_id}`;
    case "daily_entries":
      return "/diary";
    case "life_events":
      return "/family/timeline";
  }
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
