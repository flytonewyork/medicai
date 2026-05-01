"use client";

import Link from "next/link";
import { Plus, Apple, BookOpen, ChevronRight } from "lucide-react";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DailyTotals } from "~/components/nutrition/daily-totals";
import { HydrationCard } from "~/components/nutrition/hydration-card";
import { MealTimeline } from "~/components/nutrition/meal-timeline";
import { MealList } from "~/components/nutrition/meal-list";
import { WeeklySummary } from "~/components/nutrition/weekly-summary";
import { GiTrendsSection } from "~/components/nutrition/gi-trends-section";

export default function NutritionPage() {
  const locale = useLocale();
  const t = useT();
  const date = todayISO();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
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

      <HydrationCard date={date} />

      <MealTimeline date={date} />

      <section className="space-y-2">
        <h2 className="eyebrow px-1">
          {locale === "zh" ? "今日饭" : "Today's meals"}
        </h2>
        <MealList date={date} />
      </section>

      <WeeklySummary />

      <GiTrendsSection />

      <section className="grid gap-2 sm:grid-cols-2">
        <Link href="/nutrition/foods" className="a-row dense group justify-between">
          <span className="flex items-center gap-3 text-sm">
            <Apple className="h-4 w-4 text-[var(--tide-2)]" />
            <span className="text-ink-900">
              {locale === "zh" ? "食物库" : "Foods database"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink-400 group-hover:text-ink-700" />
        </Link>
        <Link href="/nutrition/guide" className="a-row dense group justify-between">
          <span className="flex items-center gap-3 text-sm">
            <BookOpen className="h-4 w-4 text-[var(--tide-2)]" />
            <span className="text-ink-900">
              {locale === "zh" ? "饮食策略" : "Diet strategy"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink-400 group-hover:text-ink-700" />
        </Link>
      </section>
    </div>
  );
}
