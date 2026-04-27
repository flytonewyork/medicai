"use client";

import { useState } from "react";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useDefaultAiModel } from "~/hooks/use-settings";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CameraCapture } from "~/components/ingest/camera-capture";
import {
  prepareImageForVision,
  type PreparedImage,
} from "~/lib/ingest/image";
import {
  structureNotes,
  type NotesStructure,
} from "~/lib/ingest/notes-vision";
import { todayISO } from "~/lib/utils/date";
import { Sparkles, Check, Loader2 } from "lucide-react";

type DailyPatch = NonNullable<NotesStructure["daily_patch"]>;

export default function NotesIngestPage() {
  const locale = useLocale();
  const model = useDefaultAiModel();

  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [structured, setStructured] = useState<NotesStructure | null>(null);
  const [busy, setBusy] = useState<"prepare" | "structure" | "save" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function onPhoto(file: File) {
    reset();
    setBusy("prepare");
    try {
      const p = await prepareImageForVision(file, { maxEdge: 1800 });
      setPrepared(p);
      const blob = new Blob([Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0))]);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runStructure() {
    if (!prepared) return;
    setBusy("structure");
    setError(null);
    try {
      const result = await structureNotes({ model, image: prepared });
      setStructured(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function applyToToday() {
    if (!structured) return;
    setBusy("save");
    try {
      const today = todayISO();
      const patch = strip(structured.daily_patch);
      const existing = await db.daily_entries
        .where("date")
        .equals(today)
        .first();
      const ts = now();
      if (existing?.id) {
        await db.daily_entries.update(existing.id, {
          ...patch,
          updated_at: ts,
        });
      } else {
        await db.daily_entries.add({
          date: today,
          entered_at: ts,
          entered_by: "hulin",
          energy: 5,
          sleep_quality: 5,
          appetite: 5,
          pain_worst: 0,
          pain_current: 0,
          mood_clarity: 5,
          nausea: 0,
          practice_morning_completed: false,
          practice_evening_completed: false,
          cold_dysaesthesia: false,
          neuropathy_hands: 0,
          neuropathy_feet: 0,
          mouth_sores: false,
          diarrhoea_count: 0,
          new_bruising: false,
          dyspnoea: false,
          fever: false,
          ...patch,
          created_at: ts,
          updated_at: ts,
        });
      }
      reset();
      alert(
        locale === "zh"
          ? "已合并到今日记录"
          : "Merged into today's daily entry",
      );
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setPrepared(null);
    setPreview(null);
    setStructured(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "手写笔记" : "Handwritten notes"}
        title={
          locale === "zh" ? "笔记转成今日日志" : "Turn notes into today's log"
        }
        subtitle={
          locale === "zh"
            ? "拍一张手写页，Claude 先原样转录再映射到日志字段。"
            : "Snap a page; Claude transcribes verbatim, then maps to daily-log fields."
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-5">
          {!prepared && (
            <div className="space-y-3">
              <CameraCapture
                onPhoto={onPhoto}
                label={locale === "zh" ? "拍一张笔记" : "Take photo of note"}
              />
              <p className="text-xs text-ink-500">
                {locale === "zh"
                  ? "光线充足、对焦清晰即可。整页或一页的一部分都行。"
                  : "Well-lit and in focus works best. Whole page or part is fine."}
              </p>
            </div>
          )}

          {preview && (
            <div className="overflow-hidden rounded-[var(--r-md)] border border-ink-100">
              {/* `preview` is a data URL from the in-memory file capture — next/image
                  can't optimise it, so a plain <img> is correct here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="note"
                className="max-h-[360px] w-full object-cover"
              />
            </div>
          )}

          {busy === "prepare" && (
            <Status
              icon={Loader2}
              text={locale === "zh" ? "准备图片" : "Preparing image"}
            />
          )}

          {prepared && !structured && busy !== "structure" && (
            <Button onClick={runStructure}>
              <Sparkles className="h-4 w-4" />
              {locale === "zh" ? "让 Claude 识别" : "Read with Claude"}
            </Button>
          )}

          {busy === "structure" && (
            <Status
              icon={Loader2}
              text={locale === "zh" ? "识别中" : "Reading"}
            />
          )}

          {structured && (
            <NotesResult
              structured={structured}
              locale={locale}
              onSave={() => void applyToToday()}
              onDiscard={reset}
              saving={busy === "save"}
            />
          )}

          {error && (
            <div className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2 text-xs text-ink-900">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Status({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-500">
      <Icon className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

function NotesResult({
  structured,
  locale,
  onSave,
  onDiscard,
  saving,
}: {
  structured: NotesStructure;
  locale: "en" | "zh";
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const patch = strip(structured.daily_patch);
  const patchEntries = Object.entries(patch).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  return (
    <div className="space-y-3">
      <div>
        <div className="eyebrow mb-1">
          {locale === "zh" ? "原文转录" : "Transcription"}
          <span className="ml-2 text-[9.5px] text-ink-400">
            · {structured.confidence}
          </span>
        </div>
        <div className="rounded-md bg-[var(--paper)] p-3 text-sm leading-relaxed text-ink-900 whitespace-pre-line">
          {structured.transcription}
        </div>
      </div>

      <div>
        <div className="eyebrow mb-1">
          {locale === "zh" ? "结构化字段" : "Structured fields"}
        </div>
        {patchEntries.length === 0 ? (
          <p className="text-xs text-ink-500">
            {locale === "zh"
              ? "没有映射到标准字段 —— 只保存转录到反思。"
              : "No fields mapped — reflection stays as free text."}
          </p>
        ) : (
          <ul className="divide-y divide-ink-100/80 rounded-md border border-ink-100/80 bg-paper-2">
            {patchEntries.map(([k, v]) => (
              <li
                key={k}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="mono text-[10.5px] uppercase tracking-wider text-ink-500">
                  {k}
                </span>
                <span className="num font-semibold text-ink-900">
                  {String(v)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {structured.ambiguities && structured.ambiguities.length > 0 && (
        <div className="rounded-md bg-[var(--sand)]/40 px-3 py-2 text-[11.5px] text-ink-900">
          <span className="mono mr-2 text-[9.5px] uppercase tracking-wider">
            {locale === "zh" ? "不确定之处" : "Unclear"}
          </span>
          {structured.ambiguities.join(" · ")}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={onSave} disabled={saving}>
          <Check className="h-4 w-4" />
          {saving
            ? locale === "zh"
              ? "保存中…"
              : "Saving…"
            : locale === "zh"
              ? "合并到今日"
              : "Merge into today"}
        </Button>
        <Button variant="ghost" onClick={onDiscard}>
          {locale === "zh" ? "再试一张" : "Try another"}
        </Button>
      </div>
    </div>
  );
}

function strip(patch: DailyPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}
