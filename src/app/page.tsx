"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ZoneStatusCard } from "~/components/dashboard/zone-status-card";
import { AlertsList } from "~/components/dashboard/alerts-list";
import { RecentTrends } from "~/components/dashboard/recent-trends";
import { BodyMetricsGrid } from "~/components/dashboard/body-metrics";
import { SarcopeniaCard } from "~/components/dashboard/sarcopenia-card";
import { WeeklyCard } from "~/components/dashboard/weekly-card";
import { PillarsCard } from "~/components/dashboard/pillars-card";
import { CycleDayCard } from "~/components/dashboard/cycle-day-card";
import { TasksCard } from "~/components/dashboard/tasks-card";
import { useLocale, useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { PageHeader, SectionHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { ChevronRight, Stethoscope } from "lucide-react";

export default function DashboardPage() {
  const t = useT();
  const locale = useLocale();
  const role = useUIStore((s) => s.role);
  const router = useRouter();
  useEffect(() => {
    if (role === "clinician") router.replace("/clinician");
  }, [role, router]);
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={
          locale === "zh"
            ? "功能、饮食、运动 —— 每天一个动作。"
            : "Function, food, movement — one small action per day."
        }
        action={
          <Link href="/daily/new">
            <Button size="lg">{t("dashboard.quick_entry")}</Button>
          </Link>
        }
      />

      <ZoneStatusCard />

      <CycleDayCard />

      <TasksCard />

      <PillarsCard />

      <section className="space-y-3">
        <SectionHeader
          title={locale === "zh" ? "今天的身体" : "Body today"}
          description={
            locale === "zh"
              ? "最新体重、BMI、蛋白质与运动 —— 过去 7 天。"
              : "Latest weight, BMI, protein intake, and movement — past 7 days."
          }
        />
        <BodyMetricsGrid />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SarcopeniaCard />
        <WeeklyCard />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title={t("dashboard.active_alerts")}
          description={
            locale === "zh"
              ? "触发的警示需要在与临床团队下一次对话中讨论。"
              : "Triggered alerts are discussion points for the next clinical conversation."
          }
        />
        <AlertsList />
      </section>

      <section className="space-y-3">
        <SectionHeader title={t("dashboard.recent_trends")} />
        <RecentTrends />
      </section>

      <section>
        <Link
          href="/fortnightly/new"
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Stethoscope className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {locale === "zh"
                  ? "开始两周评估"
                  : "Start fortnightly assessment"}
              </div>
              <div className="text-xs text-slate-500">
                {locale === "zh"
                  ? "ECOG 自评、握力、步速、坐立、上臂与小腿围"
                  : "ECOG, grip, gait speed, sit-to-stand, MUAC, calf"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
      </section>

      <footer className="pt-6 text-center text-xs text-slate-500">
        {t("common.localOnly")}
      </footer>
    </div>
  );
}
