"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { latestIngestedDocuments } from "~/lib/db/queries";
import { useLocale } from "~/hooks/use-translate";
import { todayISO } from "~/lib/utils/date";
import { postJson } from "~/lib/utils/http";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CameraCapture } from "~/components/ingest/camera-capture";
import { BulkQueue } from "~/components/ingest/bulk-queue";
import {
  UniversalDrop,
  type CapturedIngestInput,
} from "~/components/ingest/universal-drop";
import { PreviewDiff } from "~/components/ingest/preview-diff";
import type {
  IngestApplyResult,
  IngestDocumentKind,
  IngestDraft,
} from "~/types/ingest";
import {
  parseBulkItem,
  processBulkItem,
  saveBulkItem,
  type BulkItem,
} from "~/lib/ingest/bulk";
import {
  Upload,
  FileText,
  Phone,
  FlaskConical,
  Image as ImageIcon,
  CalendarDays,
  Pill,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// Single-channel-in: one dropzone for documents (paste, photo, PDF,
// DOCX). The AI infers the document type after reading; the patient
// confirms the inferred kind on the preview rather than picking from a
// menu before capture. This keeps the doctrine that "AI parses,
// classifies, attributes, and fans the input out — the patient never
// picks a form, a tab, or a category".
//
// Bulk-file uploads still use the lower bulk queue for multi-file
// imports (calendar exports + PDFs at once); single capture goes
// through UniversalDrop.

type ReclassifyKind =
  | "clinic_letter"
  | "phone_call_note"
  | "lab_report"
  | "imaging_report"
  | "appointment_schedule"
  | "prescription";

const RECLASSIFY_OPTIONS: ReadonlyArray<{
  kind: ReclassifyKind;
  icon: typeof FileText;
  en: string;
  zh: string;
}> = [
  { kind: "clinic_letter", icon: FileText, en: "Clinic letter", zh: "门诊信" },
  {
    kind: "phone_call_note",
    icon: Phone,
    en: "Phone call note",
    zh: "电话记录",
  },
  {
    kind: "lab_report",
    icon: FlaskConical,
    en: "Lab report",
    zh: "化验报告",
  },
  {
    kind: "imaging_report",
    icon: ImageIcon,
    en: "Imaging report",
    zh: "影像报告",
  },
  {
    kind: "appointment_schedule",
    icon: CalendarDays,
    en: "Appointment schedule",
    zh: "预约日程",
  },
  { kind: "prescription", icon: Pill, en: "Prescription", zh: "处方" },
];

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function IngestPage() {
  const locale = useLocale();

  const [draft, setDraft] = useState<IngestDraft | null>(null);
  const [appliedResults, setAppliedResults] = useState<
    IngestApplyResult[] | null
  >(null);
  // The captured input is held here so we can re-run the parse with a
  // different `expected_kind` if the patient says the AI guessed wrong.
  const [lastInput, setLastInput] = useState<CapturedIngestInput | null>(null);
  // `expectedKind` is only set after the patient explicitly reclassifies.
  // First read always lets the model infer.
  const [expectedKind, setExpectedKind] = useState<
    IngestDocumentKind | "appointment_schedule" | undefined
  >(undefined);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);

  const [items, setItems] = useState<BulkItem[]>([]);
  const itemsRef = useRef<BulkItem[]>([]);
  itemsRef.current = items;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutate = useCallback((id: string, patch: Partial<BulkItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    itemsRef.current = itemsRef.current.map((i) =>
      i.id === id ? { ...i, ...patch } : i,
    );
  }, []);

  async function enqueueFiles(files: FileList | File[] | null) {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const newItems: BulkItem[] = arr.map((f) => ({
      id: newId(),
      file: f,
      status: "queued",
    }));
    setItems((prev) => [...prev, ...newItems]);
    itemsRef.current = [...itemsRef.current, ...newItems];
    for (const item of newItems) {
      await processBulkItem(item, mutate);
      const latest = itemsRef.current.find((i) => i.id === item.id) ?? item;
      if (latest.status === "parsing" && latest.ocrText) {
        await parseBulkItem(latest, "heuristic", true, mutate);
      }
    }
  }

  async function reparseItem(id: string, method: "heuristic" | "claude" | "vision") {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    await parseBulkItem(item, method, true, mutate);
  }

  async function saveItem(id: string) {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    await saveBulkItem(item, mutate);
  }

  async function saveAll() {
    const ready = itemsRef.current.filter((i) => i.status === "ready");
    for (const item of ready) {
      await saveBulkItem(item, mutate);
    }
  }

  function discardItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id);
  }

  function clearAll() {
    setItems([]);
    itemsRef.current = [];
  }

  function reset() {
    setDraft(null);
    setAppliedResults(null);
    setLastInput(null);
    setExpectedKind(undefined);
    setReclassifyError(null);
  }

  async function reclassifyAs(kind: ReclassifyKind) {
    if (!lastInput) return;
    setReclassifying(true);
    setReclassifyError(null);
    try {
      const data = await postJson<{ draft: IngestDraft }>(
        "/api/ai/ingest-universal",
        {
          ...lastInput,
          expected_kind: kind,
          today: todayISO(),
          locale,
        },
      );
      setDraft(data.draft);
      setExpectedKind(kind);
    } catch (err) {
      setReclassifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setReclassifying(false);
    }
  }

  const recent = useLiveQuery(() => latestIngestedDocuments(8));

  // After a draft returns: confirmation banner + preview-diff. The
  // banner names what the AI inferred and lets the patient reclassify
  // if they disagree.
  if (draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <PageHeader
          eyebrow={locale === "zh" ? "导入" : "Ingest"}
          title={
            locale === "zh"
              ? "确认要导入的内容"
              : "Review what we'll save"
          }
        />
        <DetectedKindBanner
          draft={draft}
          locale={locale}
          canReclassify={!!lastInput}
          reclassifying={reclassifying}
          reclassifyError={reclassifyError}
          currentExpected={expectedKind}
          onReclassify={(k) => void reclassifyAs(k)}
        />
        <PreviewDiff
          draft={draft}
          onApplied={(rs) => setAppliedResults(rs)}
          onDiscard={reset}
        />
        {appliedResults && (
          <Button variant="ghost" onClick={reset}>
            <ArrowLeft className="h-4 w-4" />
            {locale === "zh" ? "导入更多" : "Import more"}
          </Button>
        )}
      </div>
    );
  }

  // Default landing: single dropzone + bulk-file affordance.
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "导入" : "Ingest"}
        title={
          locale === "zh" ? "导入临床文档" : "Import a clinical document"
        }
        subtitle={
          locale === "zh"
            ? "粘贴、拍照或上传文件 — AI 自动识别类型并归档。识别错了可以在确认页改。"
            : "Paste, photograph, or upload anything clinical — the AI infers the type and files it. You can reclassify on the confirmation step if it guessed wrong."
        }
        action={
          <Link href="/ingest/pending">
            <Button variant="secondary" size="sm">
              {locale === "zh" ? "待出结果" : "Pending results"}
            </Button>
          </Link>
        }
      />

      <UniversalDrop onDraft={setDraft} onCaptured={setLastInput} />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
            {locale === "zh"
              ? "或者上传一份或多份文件"
              : "Or upload one or more files"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CameraCapture
              onPhoto={(f) => enqueueFiles([f])}
              label={locale === "zh" ? "拍一张照片" : "Snap a photo"}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {locale === "zh" ? "选择文件" : "Choose files"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              onChange={(e) => {
                enqueueFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <p className="text-[11px] text-ink-500">
            {locale === "zh"
              ? "PDF、照片、DOCX 都可以。一次可上传多份。"
              : "PDFs, photos, DOCX — drop as many as you like."}
          </p>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <BulkQueue
          items={items}
          apiKeyConfigured={true}
          onParseHeuristic={(id) => void reparseItem(id, "heuristic")}
          onParseClaude={(id) => void reparseItem(id, "claude")}
          onSave={(id) => void saveItem(id)}
          onSaveAll={() => void saveAll()}
          onDiscard={discardItem}
          onReset={clearAll}
        />
      )}

      {recent && recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow">
            {locale === "zh" ? "最近导入" : "Recent"}
          </h2>
          <ul className="divide-y divide-ink-100/80 rounded-[var(--r-md)] border border-ink-100/80 bg-paper-2">
            {recent.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-900">
                    {d.filename}
                  </div>
                  <div className="mono text-[10.5px] uppercase tracking-wider text-ink-400">
                    {d.kind} · {d.status}
                    {d.extraction_method ? ` · ${d.extraction_method}` : ""}
                  </div>
                </div>
                <div className="mono text-[10.5px] text-ink-400">
                  {new Date(d.uploaded_at).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Banner that surfaces the AI's inferred document kind and offers a
// dropdown to re-run the parse with an explicit `expected_kind` if the
// guess was wrong. When `canReclassify` is false (the captured input
// wasn't stashed — defensive against future capture surfaces), the
// banner is informational only.
function DetectedKindBanner({
  draft,
  locale,
  canReclassify,
  reclassifying,
  reclassifyError,
  currentExpected,
  onReclassify,
}: {
  draft: IngestDraft;
  locale: "en" | "zh";
  canReclassify: boolean;
  reclassifying: boolean;
  reclassifyError: string | null;
  currentExpected: IngestDocumentKind | "appointment_schedule" | undefined;
  onReclassify: (k: ReclassifyKind) => void;
}) {
  const detectedLabel = humanLabel(draft.detected_kind, locale);
  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start gap-2.5">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ok,#15803d)]"
            aria-hidden
          />
          <div className="flex-1">
            <div className="text-[13px] text-ink-900">
              {locale === "zh" ? (
                <>
                  AI 把这份识别为 <strong>{detectedLabel}</strong>。
                </>
              ) : (
                <>
                  AI read this as a <strong>{detectedLabel}</strong>.
                </>
              )}
              {currentExpected && (
                <span className="ml-1.5 mono text-[10.5px] uppercase tracking-wider text-ink-400">
                  {locale === "zh" ? "已重读" : "re-read"}
                </span>
              )}
            </div>
            {draft.summary && (
              <div className="mt-0.5 text-[12px] text-ink-500">
                {draft.summary}
              </div>
            )}
          </div>
        </div>

        {canReclassify && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-ink-500">
              {locale === "zh" ? "类型不对？换为：" : "Wrong type? Re-read as:"}
            </span>
            {RECLASSIFY_OPTIONS.filter(
              (o) => (o.kind as string) !== draft.detected_kind,
            ).map((o) => {
              const label = locale === "zh" ? o.zh : o.en;
              return (
                <Button
                  key={o.kind}
                  variant="secondary"
                  size="sm"
                  disabled={reclassifying}
                  onClick={() => onReclassify(o.kind)}
                >
                  <o.icon className="h-3 w-3" />
                  {label}
                </Button>
              );
            })}
            {reclassifying && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                {locale === "zh" ? "重新识别中…" : "Re-reading…"}
              </span>
            )}
          </div>
        )}

        {reclassifyError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2 text-[12px] text-[var(--warn)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{reclassifyError}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function humanLabel(kind: IngestDocumentKind, locale: "en" | "zh"): string {
  const map: Record<IngestDocumentKind, { en: string; zh: string }> = {
    clinic_letter: { en: "clinic letter", zh: "门诊信" },
    appointment_letter: { en: "appointment letter", zh: "预约通知" },
    appointment_email: { en: "appointment email", zh: "预约邮件" },
    pre_appointment_instructions: {
      en: "pre-appointment instructions",
      zh: "就诊前注意事项",
    },
    phone_call_note: { en: "phone call note", zh: "电话记录" },
    lab_report: { en: "lab report", zh: "化验报告" },
    imaging_report: { en: "imaging report", zh: "影像报告" },
    ctdna_report: { en: "ctDNA report", zh: "ctDNA 报告" },
    prescription: { en: "prescription", zh: "处方" },
    discharge_summary: { en: "discharge summary", zh: "出院小结" },
    treatment_protocol: { en: "treatment protocol", zh: "治疗方案" },
    decision_record: { en: "decision record", zh: "决策记录" },
    handwritten_note: { en: "handwritten note", zh: "手写笔记" },
    other: { en: "document", zh: "文件" },
  };
  return locale === "zh" ? map[kind].zh : map[kind].en;
}
