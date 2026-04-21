"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";
import {
  Plus,
  X,
  CalendarDays,
  CalendarRange,
  Stethoscope,
  ClipboardList,
  Utensils,
  NotebookPen,
  FileText,
  ListTodo,
  Camera,
} from "lucide-react";

interface FabItem {
  href: string;
  label: { en: string; zh: string };
  hint: { en: string; zh: string };
  icon: React.ComponentType<{ className?: string }>;
  tone?: "tide" | "sand";
}

const ITEMS: FabItem[] = [
  {
    href: "/daily/new",
    label: { en: "Today's check-in", zh: "今日记录" },
    hint: { en: "Symptoms, weight, practice", zh: "症状、体重、修习" },
    icon: CalendarDays,
    tone: "tide",
  },
  {
    href: "/ingest/meal",
    label: { en: "Meal photo", zh: "餐食照片" },
    hint: {
      en: "Protein + PERT estimate",
      zh: "蛋白与胰酶建议",
    },
    icon: Utensils,
    tone: "tide",
  },
  {
    href: "/ingest/notes",
    label: { en: "Handwritten notes", zh: "手写笔记" },
    hint: { en: "Photo → daily log", zh: "照片 → 每日日志" },
    icon: NotebookPen,
  },
  {
    href: "/ingest",
    label: { en: "Upload report", zh: "上传报告" },
    hint: { en: "Lab / imaging / referral", zh: "化验 / 影像 / 转诊" },
    icon: Camera,
  },
  {
    href: "/weekly/new",
    label: { en: "Weekly reflection", zh: "每周回顾" },
    hint: { en: "Sunday evening, ~5 min", zh: "周日晚约 5 分钟" },
    icon: CalendarRange,
  },
  {
    href: "/fortnightly/new",
    label: { en: "Functional tests", zh: "两周功能评估" },
    hint: {
      en: "Grip, gait, SARC-F",
      zh: "握力、步速、SARC-F",
    },
    icon: Stethoscope,
  },
  {
    href: "/quarterly",
    label: { en: "Quarterly review", zh: "每季复查" },
    hint: { en: "Imaging, CA 19-9, CGA", zh: "影像、CA 19-9、CGA" },
    icon: ClipboardList,
  },
  {
    href: "/tasks/new",
    label: { en: "New task", zh: "新建任务" },
    hint: {
      en: "Reminder or action",
      zh: "提醒或行动",
    },
    icon: ListTodo,
  },
  {
    href: "/reports",
    label: { en: "Generate report", zh: "生成报告" },
    hint: { en: "Pre-clinic PDF / JSON", zh: "就诊前 PDF / 备份" },
    icon: FileText,
  },
];

export function AddFab() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      window.addEventListener("mousedown", onClick);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6"
    >
      {open && (
        <div className="mb-3 w-[280px] overflow-hidden rounded-[var(--r-lg)] border border-ink-100/80 bg-paper-2 shadow-xl">
          <div className="px-4 py-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.12em] text-ink-400">
              {locale === "zh" ? "添加 / 记录" : "Add / capture"}
            </div>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 border-t border-ink-100/60 px-4 py-2.5 hover:bg-ink-100/40"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        item.tone === "tide"
                          ? "bg-[var(--tide-soft)] text-[var(--tide-2)]"
                          : item.tone === "sand"
                            ? "bg-[var(--sand)] text-ink-900"
                            : "bg-ink-100 text-ink-700",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink-900">
                        {item.label[locale]}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-ink-500">
                        {item.hint[locale]}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close add menu" : "Open add menu"}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          open
            ? "bg-paper-2 text-ink-700 border border-ink-200 rotate-45"
            : "bg-ink-900 text-paper hover:scale-105",
        )}
      >
        {open ? (
          <X className="h-5 w-5 -rotate-45" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
