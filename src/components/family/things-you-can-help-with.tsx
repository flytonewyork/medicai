"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { ChevronRight, ListChecks } from "lucide-react";
import type { TaskCategory } from "~/types/task";

// Caregiver-actionable subset of the patient's task list. Household,
// admin, pharmacy, dental, vaccine — the items a family member
// realistically closes on the patient's behalf. Self-care tasks stay
// out of this view; they're the patient's to do.

const CAREGIVER_CATEGORIES: readonly TaskCategory[] = [
  "household",
  "admin",
  "pharmacy",
  "dental",
  "vaccine",
  "environmental",
];

export function ThingsYouCanHelpWith() {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const tasks = useLiveQuery(async () => {
    const all = await db.patient_tasks.toArray();
    return all
      .filter((t) => t.active)
      .filter((t) => CAREGIVER_CATEGORIES.includes(t.category))
      .filter((t) => !t.last_completed_date)
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
      .slice(0, 6);
  }, []);

  if (!tasks || tasks.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
            <ListChecks className="h-3.5 w-3.5 text-[var(--tide-2)]" />
            {L("Things you can help with", "您可以协助的事项")}
          </div>
          <Link
            href="/tasks"
            className="text-[11px] text-ink-500 hover:text-ink-900"
          >
            {L("All", "全部")}
          </Link>
        </div>
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tasks/${t.id}`}
                className="flex items-center gap-3 rounded-[var(--r-md)] bg-paper-2 px-3 py-2 transition-colors hover:bg-ink-100/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-ink-900">
                    {locale === "zh" && t.title_zh ? t.title_zh : t.title}
                  </div>
                  <div className="mono mt-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-400">
                    {t.category}
                    {t.due_date ? ` · ${t.due_date}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-400" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
