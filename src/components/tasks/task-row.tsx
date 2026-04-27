"use client";

import Link from "next/link";
import { formatDate } from "~/lib/utils/date";
import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";
import type { TaskBucket, TaskInstance } from "~/types/task";
import { localizedTitle } from "~/types/task";
import { Button } from "~/components/ui/button";
import { Check, Clock, AlertTriangle, CalendarClock, MoonStar } from "lucide-react";

const BUCKET_META: Record<
  TaskBucket,
  { tone: string; icon: React.ComponentType<{ className?: string }>; label: { en: string; zh: string } }
> = {
  overdue: {
    tone: "border-[var(--warn)]/50 bg-[var(--warn-soft)] text-[var(--warn)]",
    icon: AlertTriangle,
    label: { en: "Overdue", zh: "已超期" },
  },
  due_today: {
    tone: "border-[var(--sand-2)]/60 bg-[var(--sand)]/40 text-ink-900",
    icon: Clock,
    label: { en: "Due today", zh: "今日到期" },
  },
  cycle_relevant: {
    tone: "border-[var(--tide)]/40 bg-[var(--tide-soft)] text-[var(--tide-2)]",
    icon: CalendarClock,
    label: { en: "Relevant now", zh: "当前相关" },
  },
  approaching: {
    tone: "border-ink-200 bg-paper text-ink-700",
    icon: Clock,
    label: { en: "Approaching", zh: "即将到期" },
  },
  scheduled: {
    tone: "border-ink-100 bg-paper-2 text-ink-700",
    icon: CalendarClock,
    label: { en: "Scheduled", zh: "已排期" },
  },
  snoozed: {
    tone: "border-dashed border-ink-200 bg-paper text-ink-500",
    icon: MoonStar,
    label: { en: "Snoozed", zh: "已暂缓" },
  },
};

export function TaskRow({
  instance,
  onComplete,
  onSnooze,
  compact = false,
}: {
  instance: TaskInstance;
  onComplete?: (instance: TaskInstance) => void;
  onSnooze?: (instance: TaskInstance, days: number) => void;
  compact?: boolean;
}) {
  const locale = useLocale();
  const meta = BUCKET_META[instance.bucket];
  const Icon = meta.icon;
  const { task } = instance;
  const title = localizedTitle(task, locale);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
        meta.tone,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium truncate">{title}</div>
          <span className="mono shrink-0 text-[10px] uppercase tracking-[0.1em]">
            {meta.label[locale]}
          </span>
        </div>
        <div className="mt-0.5 text-xs opacity-80 flex flex-wrap gap-x-2">
          <span>
            {task.category}
            {task.priority === "high" ? " · high" : ""}
          </span>
          <span>
            {instance.days_until_due === 0
              ? locale === "zh"
                ? "今天"
                : "today"
              : instance.days_until_due < 0
                ? locale === "zh"
                  ? `超期 ${-instance.days_until_due} 天`
                  : `${-instance.days_until_due}d overdue`
                : locale === "zh"
                  ? `${instance.days_until_due} 天后`
                  : `in ${instance.days_until_due}d`}
          </span>
          <span className="opacity-60">
            {formatDate(instance.due_on, locale)}
          </span>
          {instance.reason && <span className="opacity-80">· {instance.reason}</span>}
        </div>
      </div>
      {!compact && (
        <div className="flex items-center gap-1 shrink-0">
          {onComplete && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onComplete(instance)}
              aria-label="mark complete"
            >
              <Check className="h-3.5 w-3.5" />
              {locale === "zh" ? "完成" : "Done"}
            </Button>
          )}
          {onSnooze && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSnooze(instance, 7)}
              aria-label="snooze"
            >
              <MoonStar className="h-3.5 w-3.5" />
              7d
            </Button>
          )}
          {task.id !== undefined && (
            <Link
              href={`/tasks/${task.id}`}
              className="rounded-md px-2 py-1 text-xs text-ink-500 transition-colors hover:bg-ink-100/60 hover:text-ink-700"
            >
              {locale === "zh" ? "编辑" : "Edit"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
