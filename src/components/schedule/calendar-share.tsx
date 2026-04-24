"use client";

import { useState } from "react";
import { appointmentsToIcs, triggerIcsDownload } from "~/lib/calendar/ics-export";
import { db } from "~/lib/db/dexie";
import { pickL } from "~/hooks/use-bilingual";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Calendar, Check, Loader2 } from "lucide-react";

// Expose the patient's schedule as an .ics file for import into Google /
// Apple / Outlook calendars. Anchor is local-first (appointments live in
// Dexie), so we cannot host a live webcal:// subscription without pushing
// PHI off-device — users re-export when they add new events.

export function CalendarShare({ locale = "en" }: { locale?: "en" | "zh" }) {
  const L = (en: string, zh: string) => pickL(locale, en, zh);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function exportIcs() {
    setBusy(true);
    setDone(false);
    try {
      const appts = await db.appointments.orderBy("starts_at").toArray();
      const ics = appointmentsToIcs(appts, {
        calendarName: L("Anchor — Schedule", "Anchor — 日程"),
      });
      triggerIcsDownload(ics);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-2.5 p-4">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
        <Calendar className="h-3.5 w-3.5 text-[var(--tide-2)]" />
        {L("Share with Google / Apple Calendar", "同步到 Google / Apple 日历")}
      </div>
      <p className="text-[12px] text-ink-500">
        {L(
          "Download an .ics snapshot of every appointment and import it into your calendar app. Re-export after new events are added — Anchor keeps its records on this device, so a live subscription isn't available.",
          "下载包含所有预约的 .ics 快照,然后导入到您的日历应用。新增事件后请再次导出 —— Anchor 数据仅保存在本设备,无法实时订阅。",
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button onClick={() => void exportIcs()} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {L("Exporting…", "导出中…")}
            </>
          ) : (
            L("Download .ics", "下载 .ics")
          )}
        </Button>
        {done && (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--ok)]">
            <Check className="h-3.5 w-3.5" />
            {L("Saved — open in your calendar app", "已保存,请在日历中打开")}
          </span>
        )}
      </div>
    </Card>
  );
}
