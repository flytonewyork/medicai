"use client";

import Link from "next/link";
import { Plus, Apple, BookOpen, ChevronRight } from "lucide-react";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DailyTotals } from "~/components/nutrition/daily-totals";
import { MealList } from "~/components/nutrition/meal-list";
import { WeeklySummary } from "~/components/nutrition/weekly-summary";

export default function NutritionPage() {
  const locale = useLocale();
  const t = useT();
  const date = todayISO();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={locale === "zh" ? "营养" : "NUTRITION"}
        title={
          locale === "zh"
            ? "今日饮食"
            : "Today's nutrition"
        }
        subtitle={
          locale === "zh"
            ? "蛋白优先，控碳水。每一餐都重要。"
            : "Protein first, carbs in check. Every meal matters."
        }
        action={
          <Link href="/nutrition/log">
            <Button>
              <Plus className="h-4 w-4" />
              {locale === "zh" ? "记一餐" : "Log a meal"}
            </Button>
          </Link>
        }
      />

      <DailyTotals date={date} />

      <section className="space-y-2">
        <h2 className="eyebrow px-1">
          {locale === "zh" ? "今日饭" : "Today's meals"}
        </h2>
        <MealList date={date} />
      </section>

      <WeeklySummary />

      <section className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/nutrition/foods"
          className="flex items-center justify-between rounded-md border border-ink-100 bg-paper-2/40 px-4 py-3 text-sm transition-colors hover:border-ink-300"
        >
          <span className="flex items-center gap-3">
            <Apple className="h-4 w-4 text-[var(--tide-2)]" />
            <span className="text-ink-900">
              {locale === "zh" ? "食物库" : "Foods database"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink-400" />
        </Link>
        <Link
          href="/nutrition/guide"
          className="flex items-center justify-between rounded-md border border-ink-100 bg-paper-2/40 px-4 py-3 text-sm transition-colors hover:border-ink-300"
        >
          <span className="flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-[var(--tide-2)]" />
            <span className="text-ink-900">
              {locale === "zh" ? "饮食策略" : "Diet strategy"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink-400" />
        </Link>
      </section>
    </div>
  );
}
