"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale, useT } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { FileText, Download, Database } from "lucide-react";
import { buildReportPayload } from "~/lib/pdf/payload";
import { formatDate } from "~/lib/utils/date";
import { todayISO } from "~/lib/utils/date";

export default function ReportsPage() {
  const t = useT();
  const locale = useLocale();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const settings = useSettings();
  const dailyCount = useLiveQuery(() => db.daily_entries.count());
  const fortnightlyCount = useLiveQuery(() =>
    db.fortnightly_assessments.count(),
  );
  const weeklyCount = useLiveQuery(() => db.weekly_assessments.count());

  async function generatePdf() {
    setGenerating(true);
    try {
      const [{ pdf }, { PreClinicReport }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("~/lib/pdf/pre-clinic-report"),
      ]);
      const payload = await buildReportPayload();
      const blob = await pdf(<PreClinicReport data={payload} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anchor-preclinic-${todayISO()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  async function exportJson() {
    setExporting(true);
    try {
      const [dailies, weeklies, fortnightlies, labs, imaging, decisions, trials, settingsRows, alerts] =
        await Promise.all([
          db.daily_entries.toArray(),
          db.weekly_assessments.toArray(),
          db.fortnightly_assessments.toArray(),
          db.labs.toArray(),
          db.imaging.toArray(),
          db.decisions.toArray(),
          db.trials.toArray(),
          db.settings.toArray(),
          db.zone_alerts.toArray(),
        ]);
      const bundle = {
        exported_at: new Date().toISOString(),
        schema_version: 1,
        settings: settingsRows,
        daily_entries: dailies,
        weekly_assessments: weeklies,
        fortnightly_assessments: fortnightlies,
        labs,
        imaging,
        decisions,
        trials,
        zone_alerts: alerts,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anchor-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      // Mark the export so the backup-nudge stops firing.
      const existing = settingsRows[0];
      if (existing?.id) {
        await db.settings.update(existing.id, {
          last_exported_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={t("nav.reports")}
        subtitle={
          locale === "zh"
            ? "给 Dr Lee 的就诊前小结 —— 本地生成，不经过云端。"
            : "Generate a clinician pre-clinic summary — all local, no cloud."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "就诊前小结" : "Pre-clinic summary"}
          </CardTitle>
          <div className="mt-1 text-sm text-ink-500">
            {locale === "zh"
              ? "包含当前区间、活动警示、功能轨迹、两周日均值、本周反思、近期化验、以及自动生成的提问清单。"
              : "Includes current zone, active alerts, functional trajectory, 14-day averages, latest weekly, recent labs, and auto-generated questions for the oncologist."}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
            <Stat
              label={locale === "zh" ? "每日记录" : "Daily entries"}
              value={dailyCount ?? 0}
            />
            <Stat
              label={locale === "zh" ? "每周" : "Weekly"}
              value={weeklyCount ?? 0}
            />
            <Stat
              label={locale === "zh" ? "两周" : "Fortnightly"}
              value={fortnightlyCount ?? 0}
            />
          </div>
          <Button onClick={generatePdf} disabled={generating} size="lg">
            <FileText className="h-4 w-4" />
            {generating
              ? locale === "zh"
                ? "生成中…"
                : "Generating…"
              : locale === "zh"
                ? "生成 PDF"
                : "Generate PDF"}
          </Button>
          {settings === null && (
            <div className="mt-3 text-xs text-[oklch(45%_0.09_70)]">
              {locale === "zh"
                ? "先在设置里填写基本信息，生成的小结会更完整。"
                : "Fill in Settings first — the summary uses those to compute baselines and deltas."}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "数据备份" : "Data backup"}
          </CardTitle>
          <div className="mt-1 text-sm text-ink-500">
            {locale === "zh"
              ? "全部数据导出为 JSON。保存到加密 U 盘或密码保护的云盘。清除浏览器数据前务必先导出。"
              : "Export everything as JSON. Save to encrypted storage. Always export before clearing site data or changing browser."}
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={exportJson} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting
              ? locale === "zh"
                ? "导出中…"
                : "Exporting…"
              : locale === "zh"
                ? "导出 JSON 备份"
                : "Export JSON backup"}
          </Button>
          <div className="mt-2 text-xs text-ink-500">
            {locale === "zh" ? "今天：" : "Today: "}
            {formatDate(todayISO(), locale)}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-lg border border-ink-100/70 bg-paper-2 p-3 text-xs text-ink-500">
        <Database className="h-4 w-4" />
        <span>
          {locale === "zh"
            ? "所有数据都存放在本浏览器的 IndexedDB 中。切换设备请用上面的导出 / 导入。"
            : "All data lives in this browser's IndexedDB. Use export / import to move between devices."}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink-100/70 bg-paper-2 p-2 text-center">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
