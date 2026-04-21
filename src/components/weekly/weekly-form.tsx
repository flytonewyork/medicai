"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useUIStore } from "~/stores/ui-store";
import { useLocale, useT } from "~/hooks/use-translate";
import { weekStartISO, weekDates, formatWeekRange } from "~/lib/utils/week";
import { weeklyAssessmentSchema } from "~/lib/validators/schemas";
import { formatZodIssues } from "~/lib/utils/validation";
import { runEngineAndPersist } from "~/lib/rules/engine";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";

type Rating = 1 | 2 | 3 | 4 | 5;

interface FormState {
  week_start: string;
  practice_full_days: number;
  practice_reduced_days: number;
  practice_skipped_days: number;
  functional_integrity: Rating;
  cognitive_stillness: Rating;
  social_practice_integrity: Rating;
  energy_trend?: "improving" | "stable" | "declining";
  concerns: string;
  questions_for_oncologist: string;
  week_summary: string;
}

const RATING_LABELS: Record<"en" | "zh", Record<Rating, string>> = {
  en: {
    1: "Very poor",
    2: "Struggling",
    3: "OK",
    4: "Good",
    5: "Excellent",
  },
  zh: {
    1: "很差",
    2: "吃力",
    3: "一般",
    4: "良好",
    5: "非常好",
  },
};

function initialState(weekStart: string): FormState {
  return {
    week_start: weekStart,
    practice_full_days: 0,
    practice_reduced_days: 0,
    practice_skipped_days: 7,
    functional_integrity: 3,
    cognitive_stillness: 3,
    social_practice_integrity: 3,
    energy_trend: undefined,
    concerns: "",
    questions_for_oncologist: "",
    week_summary: "",
  };
}

export function WeeklyForm({ entryId }: { entryId?: number }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const enteredBy = useUIStore((s) => s.enteredBy);

  const existing = useLiveQuery(
    () => (entryId ? db.weekly_assessments.get(entryId) : undefined),
    [entryId],
  );

  const targetWeek = existing?.week_start ?? weekStartISO();
  const [form, setForm] = useState<FormState>(initialState(targetWeek));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  // Auto-populate practice counts from daily entries of the target week.
  const weekDays = useMemo(() => weekDates(form.week_start), [form.week_start]);
  const dailies = useLiveQuery(
    () =>
      db.daily_entries
        .where("date")
        .anyOf(weekDays)
        .toArray(),
    [weekDays],
  );

  useEffect(() => {
    if (existing) {
      setForm({
        week_start: existing.week_start,
        practice_full_days: existing.practice_full_days,
        practice_reduced_days: existing.practice_reduced_days,
        practice_skipped_days: existing.practice_skipped_days,
        functional_integrity: clampRating(existing.functional_integrity),
        cognitive_stillness: clampRating(existing.cognitive_stillness),
        social_practice_integrity: clampRating(existing.social_practice_integrity),
        energy_trend: existing.energy_trend,
        concerns: existing.concerns ?? "",
        questions_for_oncologist: existing.questions_for_oncologist ?? "",
        week_summary: existing.week_summary ?? "",
      });
    }
  }, [existing]);

  useEffect(() => {
    if (existing || autoFilled || !dailies || dailies.length === 0) return;
    let full = 0;
    let reduced = 0;
    for (const d of dailies) {
      const count =
        (d.practice_morning_completed ? 1 : 0) +
        (d.practice_evening_completed ? 1 : 0);
      if (count === 2) full++;
      else if (count === 1) reduced++;
    }
    const skipped = Math.max(0, 7 - full - reduced);
    setForm((f) => ({
      ...f,
      practice_full_days: full,
      practice_reduced_days: reduced,
      practice_skipped_days: skipped,
    }));
    setAutoFilled(true);
  }, [dailies, existing, autoFilled]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const parsed = weeklyAssessmentSchema.safeParse({
        ...form,
        entered_by: enteredBy,
        concerns: form.concerns || undefined,
        questions_for_oncologist: form.questions_for_oncologist || undefined,
        week_summary: form.week_summary || undefined,
      });
      if (!parsed.success) {
        setError(formatZodIssues(parsed.error));
        return;
      }
      const payload = {
        ...parsed.data,
        entered_at: now(),
        created_at: existing?.created_at ?? now(),
        updated_at: now(),
      };
      if (entryId) {
        await db.weekly_assessments.update(entryId, payload);
      } else {
        await db.weekly_assessments.add(payload);
      }
      await runEngineAndPersist();
      router.push("/weekly");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "本周概览" : "This week"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {formatWeekRange(form.week_start, locale)}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {locale === "zh" ? "修习天数" : "Practice days"}
            </div>
            {autoFilled && (
              <div className="mt-1 text-xs text-slate-500">
                {locale === "zh"
                  ? "从每日记录自动填充 —— 可以调整。"
                  : "Pre-filled from daily entries — adjust if needed."}
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Counter
                label={locale === "zh" ? "完整" : "Full"}
                value={form.practice_full_days}
                onChange={(v) => update("practice_full_days", clamp(v))}
              />
              <Counter
                label={locale === "zh" ? "简短" : "Reduced"}
                value={form.practice_reduced_days}
                onChange={(v) => update("practice_reduced_days", clamp(v))}
              />
              <Counter
                label={locale === "zh" ? "未完成" : "Skipped"}
                value={form.practice_skipped_days}
                onChange={(v) => update("practice_skipped_days", clamp(v))}
              />
            </div>
          </div>

          <RatingRow
            label={
              locale === "zh"
                ? "功能完整性（日常活动能力）"
                : "Functional integrity (capacity for daily life)"
            }
            value={form.functional_integrity}
            onChange={(v) => update("functional_integrity", v)}
            locale={locale}
          />
          <RatingRow
            label={
              locale === "zh"
                ? "头脑清明 / 安定"
                : "Cognitive stillness / clarity"
            }
            value={form.cognitive_stillness}
            onChange={(v) => update("cognitive_stillness", v)}
            locale={locale}
          />
          <RatingRow
            label={
              locale === "zh"
                ? "社交与修习完整性"
                : "Social + practice integrity"
            }
            value={form.social_practice_integrity}
            onChange={(v) => update("social_practice_integrity", v)}
            locale={locale}
          />

          <div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {locale === "zh" ? "能量走向" : "Energy trend"}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["improving", "stable", "declining"] as const).map((v) => {
                const active = form.energy_trend === v;
                const label =
                  locale === "zh"
                    ? { improving: "上升", stable: "稳定", declining: "下降" }[v]
                    : { improving: "Improving", stable: "Stable", declining: "Declining" }[v];
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => update("energy_trend", v)}
                    className={cn(
                      "h-11 rounded-lg border text-sm font-medium transition-colors",
                      active
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
                    )}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "临床对话" : "For the clinical conversation"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {locale === "zh"
              ? "这些内容会直接出现在 Dr Lee 的就诊前小结里。"
              : "These go straight into the pre-clinic summary for Dr Lee."}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Labelled
            label={
              locale === "zh" ? "这周的担忧" : "Concerns from this week"
            }
          >
            <textarea
              rows={4}
              className={textareaCls}
              placeholder={
                locale === "zh"
                  ? "新症状、副作用、担心的事"
                  : "New symptoms, side effects, things that worried you"
              }
              value={form.concerns}
              onChange={(e) => update("concerns", e.target.value)}
            />
          </Labelled>
          <Labelled
            label={
              locale === "zh"
                ? "想问主诊的问题"
                : "Questions for your oncologist"
            }
          >
            <textarea
              rows={4}
              className={textareaCls}
              placeholder={
                locale === "zh"
                  ? "一条一行"
                  : "One per line"
              }
              value={form.questions_for_oncologist}
              onChange={(e) =>
                update("questions_for_oncologist", e.target.value)
              }
            />
          </Labelled>
          <Labelled
            label={
              locale === "zh" ? "一周总结（可选）" : "Week summary (optional)"
            }
          >
            <textarea
              rows={3}
              className={textareaCls}
              value={form.week_summary}
              onChange={(e) => update("week_summary", e.target.value)}
            />
          </Labelled>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => router.push("/weekly")}>
          {t("common.cancel")}
        </Button>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

const textareaCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-100";

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {label}
      </span>
      {children}
    </label>
  );
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="h-8 w-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          −
        </button>
        <span className="min-w-[2ch] text-center text-2xl font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-8 w-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          +
        </button>
      </div>
    </div>
  );
}

function RatingRow({
  label,
  value,
  onChange,
  locale,
}: {
  label: string;
  value: Rating;
  onChange: (v: Rating) => void;
  locale: "en" | "zh";
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </span>
        <span className="text-xs text-slate-500">
          {RATING_LABELS[locale][value]}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {([1, 2, 3, 4, 5] as const).map((r) => {
          const active = value === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onChange(r)}
              className={cn(
                "h-11 rounded-lg border text-sm font-semibold transition-colors",
                active
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
              )}
              aria-pressed={active}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function clamp(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 7) return 7;
  return n;
}

function clampRating(n: number): Rating {
  const v = Math.round(n);
  if (v <= 1) return 1;
  if (v >= 5) return 5;
  return v as Rating;
}
