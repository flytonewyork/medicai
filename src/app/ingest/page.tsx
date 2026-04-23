"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { latestIngestedDocuments } from "~/lib/db/queries";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CameraCapture } from "~/components/ingest/camera-capture";
import { BulkQueue } from "~/components/ingest/bulk-queue";
import { UniversalDrop } from "~/components/ingest/universal-drop";
import { PhoneCallNote } from "~/components/ingest/phone-note";
import { PreviewDiff } from "~/components/ingest/preview-diff";
import type { IngestApplyResult, IngestDraft } from "~/types/ingest";
import {
  parseBulkItem,
  processBulkItem,
  saveBulkItem,
  type BulkItem,
} from "~/lib/ingest/bulk";
import { Upload, Utensils, NotebookPen, ChevronRight } from "lucide-react";

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function IngestPage() {
  const locale = useLocale();

  const [draft, setDraft] = useState<IngestDraft | null>(null);
  const [appliedResults, setAppliedResults] = useState<IngestApplyResult[] | null>(null);

  const [items, setItems] = useState<BulkItem[]>([]);
  const itemsRef = useRef<BulkItem[]>([]);
  itemsRef.current = items;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutate = useCallback((id: string, patch: Partial<BulkItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
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

    // Process one at a time to avoid memory pressure. Images go directly
    // through Claude Vision (server-side key); PDFs still go through OCR
    // and then the heuristic parser auto-runs for a first-pass result.
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

  const recent = useLiveQuery(() => latestIngestedDocuments(8));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "导入" : "Ingest"}
        title={locale === "zh" ? "报告、照片、手写笔记" : "Reports, photos, handwritten notes"}
        subtitle={
          locale === "zh"
            ? "本机 OCR，可选 Claude 结构化。一次拖入多个文件。"
            : "On-device OCR. Optional Claude structuring. Drop several files at once."
        }
        action={
          <Link href="/ingest/pending">
            <Button variant="secondary" size="sm">
              {locale === "zh" ? "待出结果" : "Pending results"}
            </Button>
          </Link>
        }
      />

      {!draft && !appliedResults && (
        <>
          <PhoneCallNote onDraft={setDraft} />
          <UniversalDrop onDraft={setDraft} />
        </>
      )}

      {draft && (
        <PreviewDiff
          draft={draft}
          onApplied={(rs) => {
            setAppliedResults(rs);
          }}
          onDiscard={() => {
            setDraft(null);
            setAppliedResults(null);
          }}
        />
      )}

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <CameraCapture
              onPhoto={(f) => void enqueueFiles([f])}
              label={
                locale === "zh" ? "拍一张报告照片" : "Snap a report photo"
              }
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {locale === "zh" ? "选择多份文件" : "Choose files"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              onChange={(e) => {
                void enqueueFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <DropZone onFiles={(fs) => void enqueueFiles(fs)} locale={locale} />

          {items.length === 0 && (
            <p className="text-xs text-ink-500">
              {locale === "zh"
                ? "一次可导入多份报告 — 每份都会出现在下方队列。"
                : "Queue as many reports as you like — each one appears in the list below."}
            </p>
          )}

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
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/ingest/meal"
          className="a-card flex items-start gap-3 p-4 transition-colors hover:border-ink-300"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
            <Utensils className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {locale === "zh" ? "餐食照片 → 蛋白与热量" : "Meal photo → protein + calories"}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {locale === "zh"
                ? "拍一张盘中餐，Claude 估算宏量并建议胰酶剂量。"
                : "Snap the plate; Claude estimates macros and a PERT suggestion."}
            </div>
          </div>
          <ChevronRight className="mt-1.5 h-4 w-4 text-ink-300" />
        </Link>

        <Link
          href="/ingest/notes"
          className="a-card flex items-start gap-3 p-4 transition-colors hover:border-ink-300"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
            <NotebookPen className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {locale === "zh"
                ? "手写笔记 → 今日日志"
                : "Handwritten notes → daily log"}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {locale === "zh"
                ? "拍一张手写日记，结构化成今日条目。"
                : "Photograph a paper note; it's transcribed and structured into today's entry."}
            </div>
          </div>
          <ChevronRight className="mt-1.5 h-4 w-4 text-ink-300" />
        </Link>
      </section>

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

function DropZone({
  onFiles,
  locale,
}: {
  onFiles: (files: File[]) => void;
  locale: "en" | "zh";
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length > 0) onFiles(files);
      }}
      className={
        over
          ? "rounded-[var(--r-md)] border-2 border-dashed border-ink-700 bg-ink-100/40 px-4 py-5 text-center text-xs text-ink-700"
          : "rounded-[var(--r-md)] border-2 border-dashed border-ink-200 bg-paper px-4 py-5 text-center text-xs text-ink-500"
      }
    >
      {locale === "zh"
        ? "拖放任意数量的文件到这里（PDF / JPG / PNG / DOCX）"
        : "Drop any number of files here (PDF · JPG · PNG · DOCX)"}
    </div>
  );
}
