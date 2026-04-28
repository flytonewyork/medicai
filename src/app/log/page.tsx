"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { tagInput } from "~/lib/log/tag";
import { agentsForTags } from "~/agents/routing";
import { runAgentClient } from "~/lib/log/run-agents";
import { parseDirectFile, type DirectFileResult } from "~/lib/log/direct-file";
import { applyDirectFile } from "~/lib/log/direct-file-apply";
import { FollowUpsCard } from "~/components/log/follow-ups-card";
import { useUIStore } from "~/stores/ui-store";
import { LOG_TAGS, type AgentId, type LogTag } from "~/types/agent";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Textarea } from "~/components/ui/field";
import { Alert } from "~/components/ui/alert";
import { PageHeader } from "~/components/ui/page-header";
import { cn } from "~/lib/utils/cn";
import {
  Send,
  Sparkles,
  Check,
  Loader2,
  ArrowLeft,
  Mic,
  MicOff,
  Keyboard,
} from "lucide-react";
import { useVoiceTranscription } from "~/hooks/use-voice-transcription";

const TAG_LABELS: Record<LogTag, { en: string; zh: string }> = {
  diet: { en: "diet", zh: "饮食" },
  toxicity: { en: "toxicity", zh: "毒性反应" },
  physical: { en: "physical", zh: "活动" },
  symptom: { en: "symptom", zh: "症状" },
  tumour: { en: "tumour", zh: "肿瘤" },
  mental: { en: "mental", zh: "心情" },
  treatment: { en: "treatment", zh: "化疗" },
  labs: { en: "labs", zh: "化验" },
  // Legacy-module tags (slice 5). These can surface in the /log UI when
  // the free-text tagger picks them up, but they don't fan out to any
  // clinical agent — the biographer (slice 13) consumes them separately.
  memory: { en: "memory", zh: "回忆" },
  social: { en: "gathering", zh: "聚会" },
  cooking: { en: "cooking", zh: "做菜" },
  practice: { en: "practice", zh: "修行" },
  legacy_voice: { en: "voice memo", zh: "语音" },
  legacy_session: { en: "legacy session", zh: "传承" },
};

const AGENT_LABELS: Record<AgentId, { en: string; zh: string }> = {
  nutrition: { en: "nutrition", zh: "营养" },
  toxicity: { en: "toxicity", zh: "毒性反应" },
  clinical: { en: "clinical", zh: "临床" },
  rehabilitation: { en: "rehabilitation", zh: "康复" },
  treatment: { en: "treatment", zh: "化疗" },
  psychology: { en: "psychology", zh: "心理" },
};

type RunState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "running"; total: number; done: AgentId[]; failed: AgentId[] }
  | { kind: "done"; ran: AgentId[]; failed: AgentId[] }
  | {
      kind: "filed";
      summary: { en: string; zh: string };
      target: "lab" | "daily";
      rowId: number;
      filed: DirectFileResult;
    }
  | { kind: "error"; message: string };

export default function LogPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();
  const today = todayISO();

  const [text, setText] = useState("");
  const [overrideTags, setOverrideTags] = useState<Set<LogTag> | null>(null);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  // The page offers voice and typing modes. Voice never auto-starts —
  // the patient taps the mic to begin recording. Switching to typing
  // hides the mic surface for the rest of the session.
  const [editMode, setEditMode] = useState(false);

  const enteredBy = useUIStore((s) => s.enteredBy);

  // Click-to-record voice memo. The patient taps the mic, speaks, taps
  // again to stop. The recording uploads to /api/ai/transcribe (Whisper),
  // and the finalised transcript appears once — no streaming, no interim
  // words, no duplication. The hook returns null on browsers without
  // MediaRecorder so we fall back to a plain textarea cleanly.
  const voice = useVoiceTranscription({
    locale,
    onTranscribed: (chunk) => setText((cur) => (cur ? `${cur} ${chunk}` : chunk)),
  });

  const autoTags = useMemo(() => new Set(tagInput(text)), [text]);
  const tags = overrideTags ?? autoTags;
  const agentIds = useMemo(() => agentsForTags(Array.from(tags)), [tags]);

  // If the text is a simple, unambiguous data point (e.g. "blood sugar
  // 7.9 this morning", "weight 64.5 kg"), bypass the agent fan-out and
  // file it straight into labs / daily_entries. Keeps routine values out
  // of the agent pipeline. Only triggers when the user hasn't manually
  // overridden tags — explicit tag edits imply they want the full run.
  const directFile: DirectFileResult | null = useMemo(() => {
    if (overrideTags) return null;
    return parseDirectFile(text, today);
  }, [text, today, overrideTags]);

  function toggleTag(tag: LogTag) {
    const next = new Set(tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setOverrideTags(next);
  }

  async function submit() {
    if (!text.trim()) return;
    setRun({ kind: "saving" });

    // Fast path: a single structured value like "blood sugar 7.9" goes
    // straight into the right Dexie table and skips the agent run.
    if (directFile) {
      try {
        const applied = await applyDirectFile(directFile, enteredBy);
        setRun({
          kind: "filed",
          summary: directFile.summary,
          target: applied.kind,
          rowId: applied.id,
          filed: directFile,
        });
      } catch (err) {
        setRun({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (agentIds.length === 0) return;

    let logId: number;
    try {
      logId = await db.log_events.add({
        at: new Date().toISOString(),
        input: {
          text: text.trim(),
          tags: Array.from(tags),
          locale,
          at: new Date().toISOString(),
        },
      });
    } catch (err) {
      setRun({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    setRun({
      kind: "running",
      total: agentIds.length,
      done: [],
      failed: [],
    });

    const settled = await Promise.all(
      agentIds.map(async (id) => {
        try {
          await runAgentClient({
            agentId: id,
            date: today,
            locale,
            trigger: "on_demand",
            referralIds: [logId],
          });
          return { id, ok: true as const };
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[log] agent ${id} failed`, err);
          return { id, ok: false as const };
        }
      }),
    );
    const done = settled.filter((s) => s.ok).map((s) => s.id);
    const failed = settled.filter((s) => !s.ok).map((s) => s.id);
    setRun({ kind: "done", ran: done, failed });
  }

  function reset() {
    setText("");
    setOverrideTags(null);
    setRun({ kind: "idle" });
    voice?.cancel();
  }

  // A direct-filed value bypasses the agent requirement.
  const canSubmit =
    run.kind === "idle" &&
    text.trim().length > 0 &&
    (directFile !== null || agentIds.length > 0);

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={today}
        title={
          locale === "zh"
            ? "告诉我今天怎么样"
            : "Tell me what's happening"
        }
      />

      <Card className="p-5">
        {voice && !editMode ? (
          <VoiceCapture
            voice={voice}
            text={text}
            setText={setText}
            disabled={run.kind === "saving" || run.kind === "running"}
            locale={locale}
            onSwitchToTyping={() => {
              voice.cancel();
              setEditMode(true);
            }}
          />
        ) : (
          <TypingCapture
            text={text}
            setText={setText}
            disabled={run.kind === "saving" || run.kind === "running"}
            locale={locale}
            canSwitchToVoice={Boolean(voice)}
            onSwitchToVoice={() => {
              setEditMode(false);
            }}
          />
        )}

        <div className="mt-4">
          <div className="eyebrow mb-1.5">
            {locale === "zh" ? "分类" : "Tags"}
          </div>
          <div className="flex flex-wrap gap-2">
            {LOG_TAGS.map((tag) => {
              const on = tags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={run.kind === "saving" || run.kind === "running"}
                  className={cn(
                    "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                    on
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-200 bg-paper-2 text-ink-500 hover:border-ink-400",
                  )}
                >
                  #{TAG_LABELS[tag][locale]}
                </button>
              );
            })}
          </div>
          {directFile ? (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[var(--tide-2)]">
              <Check className="mt-[1px] h-3 w-3 shrink-0" />
              <span>
                {locale === "zh"
                  ? "直接归档为："
                  : "Will file directly as:"}{" "}
                <span className="font-medium">
                  {directFile.summary[locale]}
                </span>
                {" · "}
                {locale === "zh" ? "不调用智能体" : "no agents called"}
              </span>
            </p>
          ) : (
            agentIds.length > 0 && (
              <p className="mt-3 text-[11px] text-ink-500">
                {locale === "zh" ? "将通知：" : "Will notify:"}{" "}
                {agentIds.map((id) => AGENT_LABELS[id][locale]).join(" · ")}
              </p>
            )
          )}
        </div>

        {run.kind === "error" && (
          <Alert variant="warn" role="alert" className="mt-4">
            {run.message}
          </Alert>
        )}

        {(run.kind === "saving" || run.kind === "running") && (
          <Alert
            variant="info"
            role="status"
            icon={<Loader2 className="h-4 w-4 animate-spin" />}
            className="mt-4"
          >
            {run.kind === "saving"
              ? locale === "zh"
                ? "保存中…"
                : "Saving…"
              : locale === "zh"
                ? `${run.total} 个智能体在整理…`
                : `${run.total} agent${run.total === 1 ? "" : "s"} thinking…`}
          </Alert>
        )}

        {run.kind === "filed" && (
          <Alert
            variant="ok"
            role="status"
            title={locale === "zh" ? "已归档" : "Filed"}
            className="mt-4"
          >
            <div className="text-[13px]">{run.summary[locale]}</div>
            <div className="mt-1 text-[11px] opacity-80">
              {locale === "zh"
                ? run.target === "lab"
                  ? "已加入化验记录。智能体未参与解读。"
                  : "已加入今日条目。智能体未参与解读。"
                : run.target === "lab"
                  ? "Added to labs. Agents were not called."
                  : "Added to today's entry. Agents were not called."}
            </div>
          </Alert>
        )}

        {run.kind === "done" && (
          <Alert
            variant="ok"
            role="status"
            title={locale === "zh" ? "已记录" : "Logged"}
            className="mt-4"
          >
            <ul className="space-y-1 text-[12.5px]">
              {run.ran.map((id) => (
                <li key={id} className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  {AGENT_LABELS[id][locale]}
                </li>
              ))}
              {run.failed.map((id) => (
                <li
                  key={id}
                  className="flex items-center gap-1.5 text-[var(--warn)]"
                >
                  · {AGENT_LABELS[id][locale]} —{" "}
                  {locale === "zh" ? "失败" : "failed"}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          {run.kind === "done" || run.kind === "filed" ? (
            <>
              <Button variant="ghost" onClick={() => router.push("/")}>
                <ArrowLeft className="h-4 w-4" />
                {locale === "zh" ? "回到主页" : "Back to home"}
              </Button>
              <Button onClick={reset} size="lg">
                {locale === "zh" ? "再记一条" : "Log another"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => router.push("/")}>
                <ArrowLeft className="h-4 w-4" />
                {locale === "zh" ? "取消" : "Cancel"}
              </Button>
              <Button
                onClick={submit}
                disabled={!canSubmit}
                size="lg"
                className="min-w-[120px]"
              >
                <Send className="h-4 w-4" />
                {locale === "zh" ? "记录" : "Log"}
              </Button>
            </>
          )}
        </div>
      </Card>

      {run.kind === "filed" && <FollowUpsCard filed={run.filed} />}

      <p className="text-center text-[11px] text-ink-400">
        {locale === "zh"
          ? "默认语音输入，可随时切换打字。需要拍照/上传文件请到「智能识别」。"
          : "Voice by default — switch to typing anytime. For photos or document uploads, use Smart Ingest."}
      </p>
    </div>
  );
}

function VoiceCapture({
  voice,
  text,
  setText,
  disabled,
  locale,
  onSwitchToTyping,
}: {
  voice: NonNullable<ReturnType<typeof useVoiceTranscription>>;
  text: string;
  setText: (v: string) => void;
  disabled: boolean;
  locale: "en" | "zh";
  onSwitchToTyping: () => void;
}) {
  const recording = voice.status === "recording";
  const transcribing = voice.status === "transcribing";
  // The mic button drives a click-to-record loop: idle → recording →
  // transcribing → idle. While transcribing we lock the button so the
  // patient can't fire another upload while one is in flight.
  const micDisabled = disabled || transcribing;

  function handleMicTap() {
    if (recording) voice.stop();
    else void voice.start();
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleMicTap}
          disabled={micDisabled}
          aria-label={
            recording
              ? locale === "zh" ? "停止录音" : "Stop recording"
              : locale === "zh" ? "开始录音" : "Start recording"
          }
          aria-pressed={recording}
          className={cn(
            "relative flex h-20 w-20 items-center justify-center rounded-full shadow-md transition-all",
            recording
              ? "bg-[var(--warn,#d97706)] text-white"
              : "bg-ink-900 text-paper hover:scale-105",
            micDisabled && "opacity-50",
          )}
        >
          {recording && (
            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--warn,#d97706)]/40" />
          )}
          {transcribing ? (
            <Loader2 className="relative h-7 w-7 animate-spin" />
          ) : recording ? (
            <MicOff className="relative h-7 w-7" />
          ) : (
            <Mic className="relative h-7 w-7" />
          )}
        </button>
        <div className="text-[12px] text-ink-500" aria-live="polite">
          {recording
            ? locale === "zh" ? "正在录音…轻点停止" : "Recording — tap to stop"
            : transcribing
              ? locale === "zh" ? "正在识别…" : "Transcribing…"
              : text.trim()
                ? locale === "zh" ? "再次轻点继续录音" : "Tap to record more"
                : locale === "zh" ? "轻点麦克风开始" : "Tap the mic to start"}
        </div>
      </div>

      <div className="mt-4">
        <div className="eyebrow mb-1.5">
          {locale === "zh" ? "听到的内容" : "Transcript"}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          disabled={disabled || recording}
          placeholder={
            locale === "zh"
              ? "例如：早餐吃了两个鸡蛋，约 16 克蛋白；右手指尖比昨天更麻"
              : "e.g. two eggs at breakfast, ~16 g protein; right fingertips more numb than yesterday"
          }
          className="min-h-[120px] text-base"
        />
        <p className="mt-1.5 text-[11px] text-ink-400">
          {locale === "zh"
            ? "录音停止后会出现完整文字，可以随时编辑。"
            : "The full transcript appears after you stop recording — edit anytime."}
        </p>
      </div>

      {voice.error && (
        <Alert variant="warn" role="alert" className="mt-3">
          {locale === "zh"
            ? `语音识别出错：${voice.error}`
            : `Voice transcription error: ${voice.error}`}
        </Alert>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSwitchToTyping}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
        >
          <Keyboard className="h-3.5 w-3.5" />
          {locale === "zh" ? "改用打字" : "Type instead"}
        </button>
      </div>
    </div>
  );
}

function TypingCapture({
  text,
  setText,
  disabled,
  locale,
  canSwitchToVoice,
  onSwitchToVoice,
}: {
  text: string;
  setText: (v: string) => void;
  disabled: boolean;
  locale: "en" | "zh";
  canSwitchToVoice: boolean;
  onSwitchToVoice: () => void;
}) {
  return (
    <div>
      <div className="eyebrow mb-1.5">
        {locale === "zh" ? "记录" : "Log"}
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        disabled={disabled}
        placeholder={
          locale === "zh"
            ? "例如：早餐吃了两个鸡蛋，约 16 克蛋白；右手指尖比昨天更麻"
            : "e.g. two eggs at breakfast, ~16 g protein; right fingertips more numb than yesterday"
        }
        className="min-h-[140px] text-base"
        autoFocus
      />
      {canSwitchToVoice && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onSwitchToVoice}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
          >
            <Mic className="h-3.5 w-3.5" />
            {locale === "zh" ? "改用语音" : "Use voice"}
          </button>
        </div>
      )}
    </div>
  );
}
