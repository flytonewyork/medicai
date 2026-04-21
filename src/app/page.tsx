"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { format } from "date-fns";
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
import { ChevronRight, Stethoscope, Bell } from "lucide-react";

export default function DashboardPage() {
  const t = useT();
  const locale = useLocale();
  const role = useUIStore((s) => s.role);
  const router = useRouter();
  const settings = useLiveQuery(() => db.settings.toArray());
  const profileName = settings?.[0]?.profile_name;

  useEffect(() => {
    if (role === "clinician") router.replace("/clinician");
  }, [role, router]);

  const { greeting, eyebrow } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greetingEn =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
    const greetingZh =
      hour < 12 ? "早安" : hour < 18 ? "午安" : "晚安";
    const dateEyebrow =
      locale === "zh"
        ? format(now, "yyyy 年 M 月 d 日 · EEEE")
        : format(now, "EEEE · d MMM yyyy").toUpperCase();
    return {
      greeting: locale === "zh" ? greetingZh : greetingEn,
      eyebrow: dateEyebrow,
    };
  }, [locale]);

  const firstName = profileName?.split(" ").slice(-1)[0] ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <PageHeader
        eyebrow={eyebrow}
        title={
          <>
            {greeting}
            {firstName && (
              <>
                ,{" "}
                <em className="font-normal italic text-ink-500">
                  {firstName}
                </em>
              </>
            )}
          </>
        }
        subtitle={
          locale === "zh"
            ? "功能、饮食、运动 —— 每天一个动作。"
            : "Function, food, movement — one small action per day."
        }
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="notifications"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-paper-2 text-ink-700 hover:border-ink-300"
            >
              <Bell className="h-4 w-4" />
            </button>
            <Link href="/daily/new">
              <Button size="lg">{t("dashboard.quick_entry")}</Button>
            </Link>
          </div>
        }
      />

      <div className="a-horizon" />

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
          className="a-card flex items-center justify-between p-4 transition-colors hover:border-ink-300"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {locale === "zh"
                  ? "开始两周评估"
                  : "Start fortnightly assessment"}
              </div>
              <div className="text-xs text-ink-500">
                {locale === "zh"
                  ? "ECOG 自评、握力、步速、坐立、上臂与小腿围"
                  : "ECOG, grip, gait speed, sit-to-stand, MUAC, calf"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-400" />
        </Link>
      </section>

      <footer className="pt-6 text-center text-xs text-ink-400">
        {t("common.localOnly")}
      </footer>
    </div>
  );
}
