"use client";

import { useState } from "react";
import { format } from "date-fns";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CameraCapture } from "~/components/ingest/camera-capture";
import {
  prepareImageForVision,
  type PreparedImage,
} from "~/lib/ingest/image";
import {
  estimateMeal,
  type MealEstimate,
} from "~/lib/ingest/meal-vision";
import { todayISO } from "~/lib/utils/date";
import { Sparkles, Check, Loader2 } from "lucide-react";

export default function MealIngestPage() {
  const locale = useLocale();
  const model = useSettings()?.default_ai_model ?? "claude-opus-4-7";

  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [busy, setBusy] = useState<"prepare" | "estimate" | "save" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function onPhoto(file: File) {
    reset();
    setBusy("prepare");
    try {
      const p = await prepareImageForVision(file, { maxEdge: 1400 });
      setPrepared(p);
      const blob = new Blob([Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0))]);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runEstimate() {
    if (!prepared) return;
    setBusy("estimate");
    setError(null);
    try {
      const result = await estimateMeal({ model, image: prepared });
      setEstimate(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveToToday() {
    if (!estimate) return;
    setBusy("save");
    try {
      const today = todayISO();
      const existing = await db.daily_entries
        .where("date")
        .equals(today)
        .first();
      const ts = now();
      const proteinAdd = Math.round(estimate.protein_g);
      if (existing?.id) {
        await db.daily_entries.update(existing.id, {
          protein_grams: (existing.protein_grams ?? 0) + proteinAdd,
          meals_count: (existing.meals_count ?? 0) + 1,
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
          protein_grams: proteinAdd,
          meals_count: 1,
          created_at: ts,
          updated_at: ts,
        });
      }
      reset();
      alert(
        locale === "zh"
          ? `已加入 ${proteinAdd} g 蛋白到今日记录`
          : `Added ${proteinAdd} g protein to today's log`,
      );
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setPrepared(null);
    setPreview(null);
    setEstimate(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "餐食识别" : "Meal photo"}
        title={locale === "zh" ? "拍一张餐食" : "Snap a meal"}
        subtitle={
          locale === "zh"
            ? "Claude 视觉估算蛋白、碳水、脂肪与胰酶建议。"
            : "Claude Vision estimates protein / carbs / fat and a PERT suggestion."
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-5">
          {!prepared && (
            <div className="space-y-3">
              <CameraCapture
                onPhoto={onPhoto}
                label={locale === "zh" ? "拍一张餐食" : "Take photo of meal"}
              />
              <p className="text-xs text-ink-500">
                {locale === "zh"
                  ? "或从相册中选一张。照片会在设备上压缩到 1400 px 以内再发送。"
                  : "Or pick from your camera roll. Image resizes to 1400 px on-device before sending."}
              </p>
            </div>
          )}

          {preview && (
            <div className="overflow-hidden rounded-[var(--r-md)] border border-ink-100">
              <img
                src={preview}
                alt="meal"
                className="max-h-[320px] w-full object-cover"
              />
            </div>
          )}

          {busy === "prepare" && (
            <Status
              icon={Loader2}
              text={locale === "zh" ? "准备图片" : "Preparing image"}
            />
          )}

          {prepared && !estimate && busy !== "estimate" && (
            <Button onClick={runEstimate}>
              <Sparkles className="h-4 w-4" />
              {locale === "zh" ? "让 Claude 估算" : "Estimate with Claude"}
            </Button>
          )}

          {busy === "estimate" && (
            <Status
              icon={Loader2}
              text={locale === "zh" ? "分析中" : "Analysing"}
            />
          )}

          {estimate && (
            <MealResult
              estimate={estimate}
              locale={locale}
              onSave={() => void saveToToday()}
              onDiscard={reset}
              saving={busy === "save"}
            />
          )}

          {error && (
            <div className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2 text-xs text-ink-900">
              {error}
            </div>
          )}

          <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-ink-400">
            {format(new Date(), "EEE d MMM yyyy")}
          </div>
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

function MealResult({
  estimate,
  locale,
  onSave,
  onDiscard,
  saving,
}: {
  estimate: MealEstimate;
  locale: "en" | "zh";
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const confidenceLabel: Record<MealEstimate["confidence"], { en: string; zh: string }> = {
    low: { en: "low confidence", zh: "置信度低" },
    medium: { en: "medium confidence", zh: "置信度中" },
    high: { en: "high confidence", zh: "置信度高" },
  };
  return (
    <div className="space-y-3 rounded-[var(--r-md)] bg-[var(--paper)] p-3.5">
      <div>
        <div className="serif text-lg leading-tight text-ink-900">
          {estimate.description}
        </div>
        <div
          className="mono mt-1 text-[10px] uppercase tracking-wider"
          style={{
            color:
              estimate.confidence === "high"
                ? "var(--ok)"
                : estimate.confidence === "low"
                  ? "var(--warn)"
                  : "var(--ink-500)",
          }}
        >
          {confidenceLabel[estimate.confidence][locale]}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat
          label={locale === "zh" ? "蛋白" : "Protein"}
          value={`${Math.round(estimate.protein_g)} g`}
          tint="tide"
        />
        <Stat
          label={locale === "zh" ? "碳水" : "Carbs"}
          value={`${Math.round(estimate.carbs_g)} g`}
        />
        <Stat
          label={locale === "zh" ? "脂肪" : "Fat"}
          value={`${Math.round(estimate.fat_g)} g`}
        />
        <Stat
          label={locale === "zh" ? "热量" : "kcal"}
          value={`${Math.round(estimate.calories)}`}
        />
      </div>

      {estimate.pert_suggestion && (
        <div className="rounded-md bg-[var(--tide-soft)] px-3 py-2 text-xs text-ink-900">
          <span className="mono mr-1 text-[10px] uppercase tracking-wider text-[var(--tide-2)]">
            PERT
          </span>
          {estimate.pert_suggestion}
        </div>
      )}

      {estimate.notes && (
        <div className="text-[11.5px] text-ink-500">{estimate.notes}</div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={onSave} disabled={saving}>
          <Check className="h-4 w-4" />
          {saving
            ? locale === "zh"
              ? "保存中…"
              : "Saving…"
            : locale === "zh"
              ? "加到今日"
              : "Add to today"}
        </Button>
        <Button variant="ghost" onClick={onDiscard}>
          {locale === "zh" ? "再拍一张" : "Try another"}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: "tide";
}) {
  return (
    <div
      className="rounded-md border border-ink-100/80 bg-paper-2 p-2 text-center"
      style={tint === "tide" ? { borderColor: "var(--tide-2)" } : undefined}
    >
      <div className="mono text-[9.5px] uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className="serif num mt-0.5 text-lg leading-none text-ink-900">
        {value}
      </div>
    </div>
  );
}
