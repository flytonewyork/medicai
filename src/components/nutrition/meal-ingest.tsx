"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Sparkles, Type, Mic } from "lucide-react";
import { prepareImageForVision } from "~/lib/ingest/image";
import {
  parseMealPhoto,
  parseMealText,
} from "~/lib/nutrition/parser-client";
import type { ParsedMealResult } from "~/lib/nutrition/parser-schema";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/field";
import { Card } from "~/components/ui/card";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";

// Two-tab ingest. Photo and text both produce the same ParsedMealResult
// shape, which the parent screen renders into a confirmable preview.
export function MealIngest({
  onParsed,
}: {
  onParsed: (result: ParsedMealResult, source: "photo" | "text", photoDataUrl?: string) => void;
}) {
  const locale = useLocale();
  const [tab, setTab] = useState<"photo" | "text">("photo");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareImageForVision(file, { maxEdge: 1600 });
      const result = await parseMealPhoto({ image: prepared, locale });
      const dataUrl = `data:${prepared.mediaType};base64,${prepared.base64}`;
      onParsed(result, "photo", dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleText() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await parseMealText({ text, locale });
      onParsed(result, "text");
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex border-b border-ink-100/60">
        <TabBtn
          active={tab === "photo"}
          onClick={() => setTab("photo")}
          icon={Camera}
          label={locale === "zh" ? "拍照" : "Photo"}
        />
        <TabBtn
          active={tab === "text"}
          onClick={() => setTab("text")}
          icon={Type}
          label={locale === "zh" ? "文字" : "Text"}
        />
      </div>

      <div className="space-y-3 p-4">
        {tab === "photo" && (
          <div className="space-y-3">
            <div className="rounded-md border border-dashed border-ink-200 bg-paper-2/30 p-6 text-center">
              <Sparkles className="mx-auto mb-2 h-5 w-5 text-ink-400" />
              <div className="text-sm text-ink-700">
                {locale === "zh"
                  ? "用手机拍下这一餐，AI 会算好分量。"
                  : "Snap the plate. AI estimates the portion."}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {locale === "zh" ? "拍照 / 选图" : "Take or pick photo"}
                </Button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-3">
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                locale === "zh"
                  ? "例如：早餐两个煎蛋，半个牛油果，一杯黑咖啡"
                  : "e.g. 2 fried eggs, half an avocado, black coffee"
              }
              disabled={busy}
            />
            <div className="flex justify-end">
              <Button onClick={handleText} disabled={busy || !text.trim()}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {locale === "zh" ? "智能识别" : "Parse"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-[var(--warn,#d97706)]/10 px-3 py-2 text-[12px] text-[var(--warn,#d97706)]">
            {error}
          </div>
        )}
      </div>
    </Card>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Camera;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-paper-2/60 text-ink-900"
          : "text-ink-500 hover:text-ink-700",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
