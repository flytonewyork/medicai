"use client";

import Link from "next/link";
import { ZoneStatusCard } from "~/components/dashboard/zone-status-card";
import { AlertsList } from "~/components/dashboard/alerts-list";
import { RecentTrends } from "~/components/dashboard/recent-trends";
import { useT } from "~/hooks/use-translate";

export default function DashboardPage() {
  const t = useT();
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <Link
          href="/daily/new"
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium dark:bg-slate-100 dark:text-slate-900"
        >
          {t("dashboard.quick_entry")}
        </Link>
      </div>

      <ZoneStatusCard />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("dashboard.active_alerts")}
        </h2>
        <AlertsList />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("dashboard.recent_trends")}
        </h2>
        <RecentTrends />
      </section>

      <footer className="pt-6 text-xs text-slate-500 text-center">
        {t("common.localOnly")}
      </footer>
    </div>
  );
}
