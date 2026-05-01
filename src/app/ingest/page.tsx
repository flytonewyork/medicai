"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { latestIngestedDocuments } from "~/lib/db/queries";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CameraCapture } from "~/components/ingest/camera-capture";
import { BulkQueue } from "~/components/ingest/bulk-queue";
import { UniversalDrop } from "~/components/ingest/universal-drop";
import { PhoneCallNote } from "~/components/ingest/phone-note";
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
} from "lucide-react";

// Slice 10: opinionated upload landing. Five named cards take the
// patient straight to a focused capture flow with the right Claude
// prompt for that document type. The 6th "Other / mixed" path is the
// previous catch-all for anything that doesn't fit a named slot.
//
// Each named entry routes through /api/ai/ingest-universal with
// `expected_kind` so the parse prioritises the matching ops and
// doesn't fabricate ops outside the expected scope.

type CardKind =
  | "clinic_letter"
  | "phone_call_note"
  | "lab_report"
  | "imaging_report"
  | "appointment_schedule"
  | "prescription"
  | "other";

const CARDS: ReadonlyArray<{
  kind: CardKind;
  icon: typeof FileText;
  en: { title: string; subtitle: string };
  zh: { title: string; subtitle: string };
}> = [
  {
    kind: "clinic_letter",
    icon: FileText,
    en: {
      title: "Clinic letter or referral",
      subtitle: "Consult summary, treatment plan, referral. Photo or paste.",
    },
    zh: {
      title: "门诊信 / 转诊",
      subtitle: "看诊小结、治疗计划、转诊。拍照或粘贴。",
    },
  },
  {
    kind: "phone_call_note",
    icon: Phone,
    en: {
      title: "Phone call from clinic",
      subtitle: "Type or dictate what they said — appointments + prep extracted.",
    },
    zh: {
      title: "诊所来电记录",
      subtitle: "输入或口述电话内容 — 自动识别预约和准备事项。",
    },
  },
  {
    kind: "lab_report",
    icon: FlaskConical,
    en: {
      title: "Lab or pathology report",
      subtitle: "Bloods, tumour markers, biopsy. PDF or photo.",
    },
    zh: {
      title: "化验 / 病理报告",
      subtitle: "血液、肿瘤标志物、活检。PDF 或照片。",
    },
  },
  {
    kind: "imaging_report",
    icon: ImageIcon,
    en: {
      title: "Imaging or scan report",
      subtitle: "PET, CT, MRI, ultrasound report. PDF or photo.",
    },
    zh: {
      title: "影像 / 扫描报告",
      subtitle: "PET / CT / MRI / 超声报告。PDF 或照片。",
    },
  },
  {
    kind: "appointment_schedule",
    icon: CalendarDays,
    en: {
      title: "Appointment schedule",
      subtitle: "Calendar export (.ics), clinic week, scheduling block.",
    },
    zh: {
      title: "预约日程",
      subtitle: "日历订阅 (.ics)、诊所周排表。",
    },
  },
  {
    kind: "prescription",
    icon: Pill,
    en: {
      title: "Prescription",
      subtitle: "New medication. PDF, photo, or paste the script.",
    },
    zh: {
      title: "处方",
      subtitle: "新处方药。PDF、照片或粘贴。",
    },
  },
  {
    kind: "other",
    icon: Upload,
    en: {
      title: "Other / mixed documents",
      subtitle: "Anything else. AI classifies and fans out.",
    },
    zh: {
      title: "其他 / 混合文档",
      subtitle: "任何其他文件。AI 自动分类并归档。",
    },
  },
];

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function IngestPage() {
  const locale = useLocale();

  const [picked, setPicked] = useState<CardKind | null>(null);
  const [draft, setDraft] = useState<IngestDraft | null>(null);
  const [appliedResults, setAppliedResults] = useState<IngestApplyResult[] | null>(null);

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
      const latest =
        itemsRef.current.find((i) => i.id === item.id) ?? item;
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
    setPicked(null);
    setDraft(null);
    setAppliedResults(null);
  }

  const recent = useLiveQuery(() => latestIngestedDocuments(8));

  // Mid-flow: a draft is being reviewed.
  if (draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow={locale === "zh" ? "导入" : "Ingest"}
          title={
            locale === "zh"
              ? "确认要导入的内容"
              : "Review what we'll save"
          }
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

  // Mid-flow: a card was picked, render the focused capture for it.
  if (picked) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <Button variant="ghost" onClick={reset}>
          <ArrowLeft className="h-4 w-4" />
          {locale === "zh" ? "返回" : "Back"}
        </Button>
        <FocusedCapture
          kind={picked}
          locale={locale}
          onDraft={setDraft}
          enqueueFiles={(fs) => void enqueueFiles(fs)}
          fileInputRef={fileInputRef}
        />
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
      </div>
    );
  }

  // Default landing: named cards.
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "导入" : "Ingest"}
        title={
          locale === "zh"
            ? "导入临床文档"
            : "Import a clinical document"
        }
        subtitle={
          locale === "zh"
            ? "选一个类别 — AI 会按照对应的字段精准归档。"
            : "Pick the type — AI reads it with the right focus and files it cleanly."
        }
        action={
          <Link href="/ingest/pending">
            <Button variant="secondary" size="sm">
              {locale === "zh" ? "待出结果" : "Pending results"}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const copy = locale === "zh" ? c.zh : c.en;
          return (
            <button
              key={c.kind}
              type="button"
              onClick={() => setPicked(c.kind)}
              className="flex items-start gap-3 rounded-md border border-ink-100 bg-paper-2/40 px-3.5 py-3 text-left hover:border-[var(--tide-2)] hover:bg-paper-2"
            >
              <Icon
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tide-2)]"
                aria-hidden
              />
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-ink-900">
                  {copy.title}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-500">
                  {copy.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {recent && recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow">
            {locale === "zh" ? "最近导入" : "Recent"}
          </h2>
          <ul className="divide-y divide-ink-100/80 rounded-[var(--r-md)] border border-ink-100/80 bg-paper-2">
            {recent.map((d) => (
              <li key={d.id} className="flex items-center justify-between p-3">
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

// Focused capture for a picked document type. Phone-call notes get
// the dedicated PhoneCallNote component (text + voice with the right
// "Source: phone call." prefix); everything else gets the universal
// drop-in (camera + paste + bulk file picker) with `expectedKind`
// threaded through.
function FocusedCapture({
  kind,
  locale,
  onDraft,
  enqueueFiles,
  fileInputRef,
}: {
  kind: CardKind;
  locale: "en" | "zh";
  onDraft: (d: IngestDraft) => void;
  enqueueFiles: (fs: FileList | File[] | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  const card = CARDS.find((c) => c.kind === kind)!;
  const copy = locale === "zh" ? card.zh : card.en;
  const Icon = card.icon;

  // Phone-call surface uses its own component — it's text + voice
  // with the right server-side prefix already.
  if (kind === "phone_call_note") {
    return (
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-900">
          <Icon className="h-4 w-4 text-[var(--tide-2)]" aria-hidden />
          {copy.title}
        </div>
        <PhoneCallNote onDraft={onDraft} />
      </div>
    );
  }

  // Generic capture: text paste / camera / file picker. expected_kind
  // is the only thing that varies vs. the catch-all "other" path.
  const expectedKind: IngestDocumentKind | "appointment_schedule" | undefined =
    kind === "other" ? undefined : kind;

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-900">
        <Icon className="h-4 w-4 text-[var(--tide-2)]" aria-hidden />
        {copy.title}
      </div>
      <p className="text-[12px] text-ink-500">{copy.subtitle}</p>

      <UniversalDrop onDraft={onDraft} expectedKind={expectedKind} />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
            {locale === "zh" ? "或者上传文件" : "Or upload files"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CameraCapture
              onPhoto={(f) => enqueueFiles([f])}
              label={
                locale === "zh" ? "拍一张照片" : "Snap a photo"
              }
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
    </div>
  );
}
