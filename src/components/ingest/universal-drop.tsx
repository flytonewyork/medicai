"use client";

import { useState } from "react";
import { prepareImageForVision } from "~/lib/ingest/image";
import { useLocale, useL } from "~/hooks/use-translate";
import { todayISO } from "~/lib/utils/date";
import { postJson } from "~/lib/utils/http";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/field";
import { ImagePlus, Loader2, Sparkles, AlertCircle } from "lucide-react";
import type { IngestDraft, IngestSourceKind } from "~/types/ingest";

// Universal entry point. Patient pastes an email body, types a quick
// note, or snaps a photo (or picks a PDF — converted to image first).
// The route returns an IngestDraft which the parent renders as a
// preview-diff. Nothing writes to Dexie from here.

export function UniversalDrop({
  onDraft,
}: {
  onDraft: (draft: IngestDraft) => void;
}) {
  const locale = useLocale();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const L = useL();

  async function parseText() {
    if (!text.trim()) return;
    await callRoute({ text, source: "paste" });
  }

  async function onPhoto(file: File) {
    setError(null);
    setBusy(true);
    try {
      const lowerName = file.name.toLowerCase();
      const isDocx =
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        lowerName.endsWith(".docx");
      if (isDocx) {
        const { docxToText } = await import("~/lib/ingest/docx");
        const extracted = await docxToText(file);
        if (!extracted.trim()) {
          throw new Error(
            "The .docx looks empty — couldn't find any readable text inside.",
          );
        }
        await callRoute({ text: extracted, source: "paste" });
        return;
      }
      const prepared = await prepareImageForVision(file, { maxEdge: 1800 });
      await callRoute({
        image: prepared,
        source: file.type === "application/pdf" ? "pdf" : "photo",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function callRoute(args: {
    text?: string;
    image?: Awaited<ReturnType<typeof prepareImageForVision>>;
    source: IngestSourceKind;
  }) {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ draft: IngestDraft }>(
        "/api/ai/ingest-universal",
        {
          text: args.text,
          image: args.image,
          source: args.source,
          today: todayISO(),
          locale,
        },
      );
      onDraft(data.draft);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
          <Sparkles className="h-3.5 w-3.5 text-[var(--tide-2)]" />
          {L("Drop in anything medical", "导入任何医疗资料")}
        </div>
        <p className="text-[12px] text-ink-500">
          {L(
            "Paste an email or text, or take a photo of a clinic letter, lab report, prescription, or pre-appointment instructions. We'll show you exactly what would change before anything saves.",
            "粘贴邮件或文字，或拍一张就诊函、化验单、处方、注意事项的照片。会先把所有变更摆出来给你看，确认后再保存。",
          )}
        </p>

        <Field label={L("Text or pasted email", "文字或粘贴邮件")}>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={L(
              "Paste the body of a clinic letter, an email, or just type what's on the page.",
              "粘贴就诊函、邮件，或直接输入文字。",
            )}
            disabled={busy}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={parseText} disabled={busy || !text.trim()}>
            {busy ? L("Reading…", "正在识别…") : L("Save", "保存")}
          </Button>
          <label
            className={
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-100/40 " +
              (busy ? "pointer-events-none opacity-50" : "")
            }
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {L("Photo / PDF / DOCX", "照片 / PDF / DOCX")}
            <input
              type="file"
              accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPhoto(f);
              }}
            />
          </label>
          {busy && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {L("Reading…", "正在识别…")}
            </span>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-[12.5px] text-[var(--warn)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
