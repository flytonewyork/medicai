"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useActiveCycleContext } from "~/hooks/use-active-cycle";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  ensureCycleMedications,
  getActiveMedications,
} from "~/lib/medication/active";
import {
  compileTodayStatuses,
  logMedicationEvent,
} from "~/lib/medication/log";
import type { MedicationTodayStatus } from "~/types/medication";
import { Check, X, Pill } from "lucide-react";
import { cn } from "~/lib/utils/cn";

/**
 * Daily check-in step: lists today's active medications and lets the user
 * batch-log them. Only rendered when there's an active treatment cycle.
 */
export function MedicationsStep() {
  const locale = useLocale();
  const ctx = useActiveCycleContext();
  const cycleId = ctx?.cycle.id;
  const cycleDay = ctx?.cycle_day;
  const [statuses, setStatuses] = useState<MedicationTodayStatus[]>([]);
  const allEvents = useLiveQuery(() => db.medication_events.toArray(), []);

  useEffect(() => {
    if (ctx?.cycle) void ensureCycleMedications(ctx.cycle);
  }, [ctx?.cycle]);

  useEffect(() => {
    void (async () => {
      const meds = await getActiveMedications(cycleId);
      const s = await compileTodayStatuses(meds, cycleDay);
      setStatuses(s);
    })();
  }, [cycleId, cycleDay, allEvents?.length]);

  if (!ctx) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-ink-500">
          {locale === "zh"
            ? "当前没有活动治疗周期 —— 跳过用药记录。"
            : "No active treatment cycle — skip medication logging."}
        </CardContent>
      </Card>
    );
  }

  if (statuses.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-ink-500">
          {locale === "zh"
            ? "正在加载药物清单 …"
            : "Loading medication list…"}
        </CardContent>
      </Card>
    );
  }

  const handleLog = async (
    status: MedicationTodayStatus,
    event_type: "taken" | "missed",
  ) => {
    await logMedicationEvent({
      medication: status.medication,
      event_type,
      source: "daily_checkin",
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-500">
        {locale === "zh"
          ? `周期 ${ctx.cycle.cycle_number}·D${cycleDay} · ${ctx.protocol.short_name} — 记录今日是否服用。`
          : `Cycle ${ctx.cycle.cycle_number}·D${cycleDay} · ${ctx.protocol.short_name} — mark each as taken or missed today.`}
      </p>

      {statuses.map((s) => {
        const name = locale === "zh" ? s.drug_name_zh : s.drug_name_en;
        const allLogged = s.due_count > 0 && s.logged_count >= s.due_count;
        const isPrn = s.due_count === 0;
        return (
          <Card
            key={s.medication.id}
            className={cn("transition-colors", allLogged && "bg-paper-1")}
          >
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="flex flex-1 items-center gap-2">
                <Pill className="h-4 w-4 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-900">
                    {name}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {s.medication.dose}
                    {!isPrn && (
                      <>
                        {" · "}
                        <span
                          className={cn(
                            allLogged
                              ? "text-green-600"
                              : s.logged_count > 0
                                ? "text-amber-600"
                                : "text-ink-500",
                          )}
                        >
                          {s.logged_count}/{s.due_count}
                        </span>
                      </>
                    )}
                    {isPrn && (
                      <> · {locale === "zh" ? "按需" : "PRN"}</>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  onClick={() => handleLog(s, "taken")}
                  size="sm"
                  variant={allLogged ? "ghost" : "primary"}
                  className="gap-1 px-2"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => handleLog(s, "missed")}
                  size="sm"
                  variant="secondary"
                  className="gap-1 px-2"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
