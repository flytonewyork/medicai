"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { latestTreatmentCycles } from "~/lib/db/queries";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { formatDate } from "~/lib/utils/date";
import { cn } from "~/lib/utils/cn";
import type { CycleStatus } from "~/types/treatment";
import { BookOpen, ChevronRight, ClipboardList, Pencil, Syringe } from "lucide-react";

const STATUS_STYLES: Record<CycleStatus, { label: { en: string; zh: string }; cls: string }> = {
  planned: {
    label: { en: "Planned", zh: "已计划" },
    cls: "bg-ink-100 text-ink-600",
  },
  active: {
    label: { en: "Active", zh: "进行中" },
    cls: "bg-[var(--ok-soft)] text-[var(--ok)]",
  },
  completed: {
    label: { en: "Completed", zh: "已完成" },
    cls: "bg-ink-100 text-ink-500",
  },
  delayed: {
    label: { en: "Delayed", zh: "延迟" },
    cls: "bg-[var(--sand)]/40 text-[oklch(45%_0.06_70)]",
  },
  cancelled: {
    label: { en: "Cancelled", zh: "已取消" },
    cls: "bg-[var(--warn-soft)] text-[var(--warn)]",
  },
};

export default function TreatmentListPage() {
  const locale = useLocale();
  const cycles = useLiveQuery(() => latestTreatmentCycles());

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "化疗方案" : "Treatment"}
        subtitle={
          locale === "zh"
            ? "方案、周期、与今天相关的提示。"
            : "Protocol, cycles, and today's contextual nudges."
        }
        action={
          <Link href="/treatment/new">
            <Button>{locale === "zh" ? "新建周期" : "Start cycle"}</Button>
          </Link>
        }
      />

      {/* Quick links to medication-management surfaces that would
          otherwise be orphaned from primary nav. Prescriptions hosts
          the active-meds list + edit; the medications reference is
          the read-only drug glossary. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/prescriptions"
          className="group flex items-center gap-3 rounded-xl border border-ink-100/70 bg-paper-2 p-3 transition-colors hover:border-ink-300"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink-900">
              {locale === "zh" ? "当前处方" : "Current prescriptions"}
            </div>
            <div className="text-[11.5px] text-ink-500">
              {locale === "zh"
                ? "查看与编辑活动药物"
                : "View and edit active medications"}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400 group-hover:text-ink-700" />
        </Link>
        <Link
          href="/medications"
          className="group flex items-center gap-3 rounded-xl border border-ink-100/70 bg-paper-2 p-3 transition-colors hover:border-ink-300"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--sand)] text-ink-900">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink-900">
              {locale === "zh" ? "用药参考" : "Medication reference"}
            </div>
            <div className="text-[11.5px] text-ink-500">
              {locale === "zh"
                ? "副作用、相互作用、注意事项"
                : "Side effects, interactions, notes"}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400 group-hover:text-ink-700" />
        </Link>
      </div>
      {(!cycles || cycles.length === 0) && (
        <EmptyState
          icon={Syringe}
          title={locale === "zh" ? "还没有化疗方案" : "No protocol set"}
          description={
            locale === "zh"
              ? "选择一个方案，Anchor 会按周期日给出饮食、卫生、运动、睡眠、情绪的贴身提示。"
              : "Pick a protocol and Anchor will surface day-specific nudges across diet, hygiene, exercise, sleep, and mental health."
          }
          actions={
            <Link href="/treatment/new">
              <Button>
                {locale === "zh" ? "选择方案" : "Pick a protocol"}
              </Button>
            </Link>
          }
        />
      )}
      <ul className="space-y-2">
        {(cycles ?? []).map((c) => {
          const proto = PROTOCOL_BY_ID[c.protocol_id];
          const style = STATUS_STYLES[c.status];
          return (
            <li key={c.id}>
              <div className="group flex items-center justify-between rounded-xl border border-ink-100/70 bg-paper-2 p-4 transition-colors hover:border-ink-300">
                <Link
                  href={`/treatment/${c.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                      <span>
                        {proto?.short_name ?? c.protocol_id} ·{" "}
                        {locale === "zh" ? "周期 " : "Cycle "}
                        {c.cycle_number}
                      </span>
                      <span
                        className={cn(
                          "mono rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]",
                          style.cls,
                        )}
                      >
                        {style.label[locale]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span>
                        {locale === "zh" ? "开始：" : "Start "}
                        {formatDate(c.start_date, locale)}
                      </span>
                      {c.dose_level !== 0 && (
                        <span>
                          {locale === "zh" ? "减量 " : "Dose level "}
                          {c.dose_level}
                        </span>
                      )}
                      {c.notes && (
                        <span className="truncate text-ink-400">
                          · {c.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-400 group-hover:text-ink-700" />
                </Link>
                <Link
                  href={`/treatment/${c.id}/edit`}
                  aria-label={locale === "zh" ? "编辑" : "Edit"}
                  className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
