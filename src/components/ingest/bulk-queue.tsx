"use client";

import type { BulkItem } from "~/lib/ingest/bulk";
import type { UnifiedExtraction } from "~/lib/ingest/save";
import { useLocale } from "~/hooks/use-translate";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";
import {
  Check,
  Loader2,
  AlertCircle,
  FileText,
  Trash2,
  Sparkles,
  ScanText,
  Eye,
} from "lucide-react";
import type { LocalizedText } from "~/types/localized";

const STATUS_META: Record<
  BulkItem["status"],
  { label: LocalizedText; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  queued: {
    label: { en: "Queued", zh: "排队" },
    tone: "text-ink-400",
    icon: FileText,
  },
  vision: {
    label: { en: "Claude reading image", zh: "Claude 正在读图" },
    tone: "text-[var(--tide-2)]",
    icon: Eye,
  },
  ocr: {
    label: { en: "OCR running", zh: "识别中" },
    tone: "text-ink-500",
    icon: Loader2,
  },
  ocr_failed: {
    label: { en: "OCR failed", zh: "识别失败" },
    tone: "text-[var(--warn)]",
    icon: AlertCircle,
  },
  parsing: {
    label: { en: "Structuring", zh: "结构化中" },
    tone: "text-ink-500",
    icon: Loader2,
  },
  parse_failed: {
    label: { en: "Parse failed", zh: "解析失败" },
    tone: "text-[var(--warn)]",
    icon: AlertCircle,
  },
  ready: {
    label: { en: "Ready to save", zh: "可保存" },
    tone: "text-[var(--tide-2)]",
    icon: Check,
  },
  saving: {
    label: { en: "Saving", zh: "保存中" },
    tone: "text-ink-500",
    icon: Loader2,
  },
  saved: {
    label: { en: "Saved", zh: "已保存" },
    tone: "text-[var(--ok)]",
    icon: Check,
  },
  discarded: {
    label: { en: "Discarded", zh: "已丢弃" },
    tone: "text-ink-400",
    icon: Trash2,
  },
};

export function BulkQueue({
  items,
  apiKeyConfigured,
  onParseHeuristic,
  onParseClaude,
  onSave,
  onSaveAll,
  onDiscard,
  onReset,
}: {
  items: BulkItem[];
  apiKeyConfigured: boolean;
  onParseHeuristic: (id: string) => void;
  onParseClaude: (id: string) => void;
  onSave: (id: string) => void;
  onSaveAll: () => void;
  onDiscard: (id: string) => void;
  onReset: () => void;
}) {
  const locale = useLocale();
  const readyCount = items.filter((i) => i.status === "ready").length;
  const activeCount = items.filter(
    (i) => i.status !== "saved" && i.status !== "discarded",
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="eyebrow">
          {locale === "zh"
            ? `${activeCount} 个文件 · ${readyCount} 可保存`
            : `${activeCount} file${activeCount === 1 ? "" : "s"} · ${readyCount} ready`}
        </div>
        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <Button size="sm" onClick={onSaveAll}>
              <Check className="h-3.5 w-3.5" />
              {locale === "zh" ? `全部保存（${readyCount}）` : `Save all (${readyCount})`}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onReset}>
            {locale === "zh" ? "清空" : "Clear"}
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <BulkRow
            key={item.id}
            item={item}
            locale={locale}
            apiKeyConfigured={apiKeyConfigured}
            onParseHeuristic={() => onParseHeuristic(item.id)}
            onParseClaude={() => onParseClaude(item.id)}
            onSave={() => onSave(item.id)}
            onDiscard={() => onDiscard(item.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function BulkRow({
  item,
  locale,
  apiKeyConfigured,
  onParseHeuristic,
  onParseClaude,
  onSave,
  onDiscard,
}: {
  item: BulkItem;
  locale: "en" | "zh";
  apiKeyConfigured: boolean;
  onParseHeuristic: () => void;
  onParseClaude: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const meta = STATUS_META[item.status];
  const Icon = meta.icon;
  const isBusy =
    item.status === "ocr" ||
    item.status === "vision" ||
    item.status === "parsing" ||
    item.status === "saving";

  return (
    <li
      className={cn(
        "rounded-[var(--r-md)] border border-ink-100/80 bg-paper-2 p-3",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium text-ink-900">
            {item.file.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs">
            <Icon
              className={cn(
                "h-3 w-3",
                meta.tone,
                // Only spin the loader icon; vision uses an eye that shouldn't spin.
                isBusy && Icon === Loader2 && "animate-spin",
              )}
            />
            <span className={meta.tone}>{meta.label[locale]}</span>
            {item.progress && (
              <span className="mono text-[10px] text-ink-400">
                · {item.progress}
              </span>
            )}
            {item.error && (
              <span className="text-[11px] text-[var(--warn)]">
                · {item.error.slice(0, 60)}
              </span>
            )}
          </div>
        </div>
        {item.status !== "saved" && item.status !== "discarded" && (
          <button
            type="button"
            onClick={onDiscard}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="discard"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {item.status === "ocr_failed" && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={onParseHeuristic}>
            {locale === "zh" ? "重试" : "Retry"}
          </Button>
        </div>
      )}

      {(item.ocrText && item.status === "parsing") || item.status === "parse_failed" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onParseHeuristic}>
            <ScanText className="h-3.5 w-3.5" />
            {locale === "zh" ? "本地规则" : "Local rules"}
          </Button>
          {apiKeyConfigured && (
            <Button size="sm" onClick={onParseClaude}>
              <Sparkles className="h-3.5 w-3.5" />
              {locale === "zh" ? "用 Claude" : "Claude"}
            </Button>
          )}
        </div>
      ) : null}

      {item.status === "ready" && item.extraction && (
        <div className="mt-2 space-y-1.5 rounded-md bg-[var(--paper)] p-2.5 text-[11.5px] text-ink-700">
          <ExtractionPreview extraction={item.extraction} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={onSave}>
              <Check className="h-3.5 w-3.5" />
              {locale === "zh" ? "保存" : "Save"}
            </Button>
            {apiKeyConfigured && item.method === "heuristic" && (
              <Button size="sm" variant="ghost" onClick={onParseClaude}>
                {locale === "zh" ? "改用 Claude" : "Re-parse with Claude"}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function ExtractionPreview({ extraction }: { extraction: UnifiedExtraction }) {
  return (
    <div className="space-y-0.5">
      <div>
        <span className="font-medium">Kind:</span> {extraction.kind}
      </div>
      {extraction.document_date && (
        <div>
          <span className="font-medium">Date:</span> {extraction.document_date}
        </div>
      )}
      {extraction.labs && Object.keys(extraction.labs).length > 0 && (
        <div>
          <span className="font-medium">Labs:</span>{" "}
          {Object.entries(extraction.labs)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}
        </div>
      )}
      {extraction.imaging?.modality && (
        <div>
          <span className="font-medium">Imaging:</span>{" "}
          {extraction.imaging.modality}
          {extraction.imaging.recist_status
            ? ` · ${extraction.imaging.recist_status}`
            : ""}
        </div>
      )}
      {extraction.ctdna && (
        <div>
          <span className="font-medium">ctDNA:</span>{" "}
          {extraction.ctdna.platform ?? "other"} ·{" "}
          {extraction.ctdna.detected ? "detected" : "not detected"}
        </div>
      )}
      {extraction.summary && (
        <div className="text-ink-500">{extraction.summary}</div>
      )}
    </div>
  );
}
