"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { UploadZone } from "~/components/ingest/upload-zone";
import { useLocale, useT } from "~/hooks/use-translate";
import { ocrFile } from "~/lib/ingest/ocr";
import { parseHeuristic } from "~/lib/ingest/heuristic-parser";
import { extractWithClaude } from "~/lib/ingest/claude-parser";
import {
  fromClaude,
  fromHeuristic,
  saveExtraction,
  type UnifiedExtraction,
} from "~/lib/ingest/save";
import type { IngestedDocument } from "~/types/clinical";
import { Sparkles, ScanText, Loader2, Check } from "lucide-react";
import Link from "next/link";

type Phase =
  | "idle"
  | "ocr"
  | "ocr_done"
  | "structuring"
  | "structured"
  | "saving"
  | "saved"
  | "error";

export default function IngestPage() {
  const t = useT();
  const locale = useLocale();
  const settings = useLiveQuery(() => db.settings.toArray());
  const apiKey = settings?.[0]?.anthropic_api_key;
  const docs = useLiveQuery(() =>
    db.ingested_documents.orderBy("uploaded_at").reverse().limit(15).toArray(),
  );

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<string>("");
  const [ocrText, setOcrText] = useState<string>("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [docId, setDocId] = useState<number | null>(null);
  const [extraction, setExtraction] = useState<UnifiedExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setPhase("idle");
    setProgress("");
    setOcrText("");
    setOcrConfidence(null);
    setDocId(null);
    setExtraction(null);
    setError(null);
  }

  async function handleFile(f: File) {
    reset();
    setFile(f);
    setPhase("ocr");
    setError(null);

    const newDoc: IngestedDocument = {
      filename: f.name,
      mime_type: f.type || "application/octet-stream",
      size_bytes: f.size,
      kind: "other",
      uploaded_at: now(),
      status: "ocr_pending",
      created_at: now(),
      updated_at: now(),
    };
    const newId = (await db.ingested_documents.add(newDoc)) as number;
    setDocId(newId);

    try {
      const r = await ocrFile(f, (phase, p) => {
        setProgress(`${phase} — ${Math.round((p ?? 0) * 100)}%`);
      });
      setOcrText(r.text);
      setOcrConfidence(r.confidence);
      await db.ingested_documents.update(newId, {
        ocr_text: r.text,
        ocr_confidence: r.confidence,
        status: "ocr_complete",
        updated_at: now(),
      });
      setPhase("ocr_done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
      await db.ingested_documents.update(newId, {
        status: "error",
        error_message: msg,
        updated_at: now(),
      });
    }
  }

  async function runHeuristic() {
    if (!ocrText) return;
    setPhase("structuring");
    const parsed = parseHeuristic(ocrText);
    const unified = fromHeuristic(parsed);
    setExtraction(unified);
    if (docId) {
      await db.ingested_documents.update(docId, {
        extraction_method: "heuristic",
        kind: unified.kind,
        status: "extracted",
        updated_at: now(),
      });
    }
    setPhase("structured");
  }

  async function runClaude() {
    if (!ocrText || !apiKey) return;
    setPhase("structuring");
    setError(null);
    try {
      const model = settings?.[0]?.default_ai_model ?? "claude-opus-4-7";
      const claude = await extractWithClaude({ apiKey, text: ocrText, model });
      const unified = fromClaude(claude);
      setExtraction(unified);
      if (docId) {
        await db.ingested_documents.update(docId, {
          extraction_method: "claude",
          extraction_model: model,
          kind: unified.kind,
          status: "extracted",
          updated_at: now(),
        });
      }
      setPhase("structured");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("ocr_done");
    }
  }

  async function confirmSave() {
    if (!extraction || !docId) return;
    setPhase("saving");
    const doc = await db.ingested_documents.get(docId);
    if (!doc) return;
    await saveExtraction(doc, extraction);
    setPhase("saved");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "报告导入" : "Ingest reports"}
        subtitle={
          locale === "zh"
            ? "OCR 在本机进行。结构化可选择本地规则或你的 Claude API Key。"
            : "OCR runs on your device. Structuring uses local rules or your own Claude API key — never our servers."
        }
        action={
          <Link href="/ingest/pending">
            <Button variant="secondary">
              {locale === "zh" ? "待出结果" : "Pending results"}
            </Button>
          </Link>
        }
      />

      {phase === "idle" && <UploadZone onFile={handleFile} />}

      {phase !== "idle" && file && (
        <Card>
          <CardHeader>
            <CardTitle>{file.name}</CardTitle>
            <div className="mt-1 text-xs text-slate-500">
              {formatBytes(file.size)} · {file.type || "unknown"}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(phase === "ocr") && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "zh" ? "本机 OCR 中" : "Running OCR on device"} — {progress}
              </div>
            )}

            {phase === "error" && error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}

            {ocrText && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {locale === "zh" ? "OCR 输出（可编辑）" : "OCR output (editable)"}
                    {ocrConfidence != null && (
                      <span className="ml-2 text-slate-400">
                        · {Math.round(ocrConfidence)}%
                      </span>
                    )}
                  </span>
                </div>
                <textarea
                  className="h-48 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                />
              </div>
            )}

            {(phase === "ocr_done" || phase === "structured" || phase === "structuring") && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={runHeuristic}
                  disabled={phase === "structuring"}
                  variant="secondary"
                >
                  <ScanText className="h-4 w-4" />
                  {locale === "zh" ? "本地规则解析" : "Parse with local rules"}
                </Button>
                <Button
                  onClick={runClaude}
                  disabled={!apiKey || phase === "structuring"}
                >
                  <Sparkles className="h-4 w-4" />
                  {locale === "zh" ? "用 Claude 解析" : "Parse with Claude"}
                </Button>
                {!apiKey && (
                  <Link
                    href="/settings"
                    className="text-xs text-slate-500 underline"
                  >
                    {locale === "zh"
                      ? "在设置里填 API Key 解锁"
                      : "Add your API key in Settings to enable"}
                  </Link>
                )}
              </div>
            )}

            {phase === "structuring" && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "zh" ? "结构化中" : "Structuring"}
              </div>
            )}

            {extraction && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {locale === "zh" ? "即将保存" : "Ready to save"}
                </div>
                <ExtractionPreview extraction={extraction} />
                {phase === "structured" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button onClick={confirmSave}>
                      <Check className="h-4 w-4" />
                      {locale === "zh" ? "确认并保存" : "Save to Anchor"}
                    </Button>
                    <Button variant="ghost" onClick={reset}>
                      {locale === "zh" ? "丢弃" : "Discard"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {phase === "saved" && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {locale === "zh"
                  ? "已保存到 Anchor。新值会进入趋势和规则引擎。"
                  : "Saved to Anchor. New values flow into trends and the rule engine."}
                <div className="mt-2">
                  <Button onClick={reset} size="sm">
                    {locale === "zh" ? "继续" : "Ingest another"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {docs && docs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {locale === "zh" ? "最近导入" : "Recent ingestions"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium">{d.filename}</div>
                    <div className="text-xs text-slate-500">
                      {d.kind.replace("_", " ")} · {d.status} ·{" "}
                      {d.extraction_method ?? "—"}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(d.uploaded_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExtractionPreview({ extraction }: { extraction: UnifiedExtraction }) {
  return (
    <div className="space-y-2 text-xs">
      <div>
        <span className="font-medium">Kind:</span> {extraction.kind}
      </div>
      {extraction.document_date && (
        <div>
          <span className="font-medium">Date:</span> {extraction.document_date}
        </div>
      )}
      {extraction.summary && (
        <div>
          <span className="font-medium">Summary:</span> {extraction.summary}
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
          {extraction.imaging.findings_summary
            ? ` — ${extraction.imaging.findings_summary.slice(0, 140)}`
            : ""}
        </div>
      )}
      {extraction.ctdna && (
        <div>
          <span className="font-medium">ctDNA:</span>{" "}
          {extraction.ctdna.platform} ·{" "}
          {extraction.ctdna.detected ? "detected" : "not detected"}
          {extraction.ctdna.value ? ` · ${extraction.ctdna.value}` : ""}
        </div>
      )}
      {extraction.pending_items && extraction.pending_items.length > 0 && (
        <div>
          <span className="font-medium">Pending:</span>{" "}
          {extraction.pending_items.map((p) => p.test_name).join(", ")}
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
