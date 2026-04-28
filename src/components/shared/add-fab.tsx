"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";
import {
  Plus,
  X,
  CalendarDays,
  CalendarClock,
  ListTodo,
  Pill,
  MessageSquarePlus,
  Sparkles,
  Salad,
} from "lucide-react";
import { useIngestModal } from "~/components/ingest/ingest-modal";
import { useAppPerspective } from "~/lib/caregiver/scope";
import type { LocalizedText } from "~/types/localized";

interface FabItem {
  href?: string;
  // When set, the item is rendered as a button that runs `action`
  // instead of navigating. Used for the smart-ingest opener.
  action?: "ingest";
  label: LocalizedText;
  hint: LocalizedText;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "tide" | "sand";
}

// Caregiver-friendly FAB — only the verbs a supporting family member
// reaches for. Patient-authored captures (daily wizard, weekly / fort.
// assessments, practice toggle) are hidden.
const CAREGIVER_ITEMS: FabItem[] = [
  {
    href: "/log",
    label: { en: "Log for dad", zh: "代记录" },
    hint: {
      en: "A note or vital you just observed",
      zh: "刚观察到的情况或数值",
    },
    icon: MessageSquarePlus,
    tone: "sand",
  },
  {
    href: "/schedule/new",
    label: { en: "New appointment", zh: "新建预约" },
    hint: {
      en: "Clinic / chemo / scan / blood test",
      zh: "门诊 / 化疗 / 检查 / 化验",
    },
    icon: CalendarClock,
    tone: "tide",
  },
  {
    href: "/tasks/new",
    label: { en: "Add task", zh: "新建任务" },
    hint: {
      en: "Something you'll chase up",
      zh: "您要跟进的事项",
    },
    icon: ListTodo,
  },
  {
    href: "/nutrition/log",
    label: { en: "Log a meal", zh: "记录用餐" },
    hint: {
      en: "What dad ate or drank",
      zh: "记录用餐或饮水",
    },
    icon: Salad,
    tone: "sand",
  },
  {
    action: "ingest",
    label: { en: "Add a photo or document", zh: "导入照片或文档" },
    hint: {
      en: "Clinic letter, lab report, scan result",
      zh: "就诊函、化验单、影像报告",
    },
    icon: Sparkles,
    tone: "tide",
  },
];

// Patient FAB — one capture channel, one check-in, one appointment verb,
// one medication quick-log. The free-text/voice "Say what's happening"
// stays primary so anything that can be spoken or typed funnels through
// it; structured shortcuts (daily check-in, meal log, medication log)
// stay first-class because the patient reaches for them on a tired day
// without wanting to compose a sentence.
const ITEMS: FabItem[] = [
  {
    href: "/log",
    label: { en: "Say what's happening", zh: "说说现在的情况" },
    hint: {
      en: "Type or speak — agents file it for you",
      zh: "随手写或语音 —— 智能体整理",
    },
    icon: MessageSquarePlus,
    tone: "sand",
  },
  {
    action: "ingest",
    label: { en: "Add a photo or document", zh: "导入照片或文档" },
    hint: {
      en: "Lab report, clinic letter, scan result",
      zh: "化验单、就诊函、影像报告",
    },
    icon: Sparkles,
    tone: "tide",
  },
  {
    href: "/daily/new",
    label: { en: "Today's check-in", zh: "今日记录" },
    hint: { en: "Symptoms, weight, practice", zh: "症状、体重、修习" },
    icon: CalendarDays,
    tone: "tide",
  },
  {
    href: "/nutrition/log",
    label: { en: "Log a meal", zh: "记录用餐" },
    hint: {
      en: "What you ate, drank, or couldn't finish",
      zh: "用餐、饮水或没吃完的情况",
    },
    icon: Salad,
    tone: "sand",
  },
  {
    href: "/medications/log",
    label: { en: "Log medication", zh: "记录服药" },
    hint: {
      en: "Taken, missed, side effects",
      zh: "已服、漏服、副作用",
    },
    icon: Pill,
  },
  {
    href: "/schedule/new",
    label: { en: "New appointment", zh: "新建预约" },
    hint: {
      en: "Clinic / chemo / scan / blood test",
      zh: "门诊 / 化疗 / 检查 / 化验",
    },
    icon: CalendarClock,
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
];

export function AddFab() {
  const locale = useLocale();
  const pathname = usePathname();
  const perspective = useAppPerspective();
  const items = perspective === "patient" ? ITEMS : CAREGIVER_ITEMS;
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

  if (pathname === "/login" || pathname?.startsWith("/auth/")) return null;

  // Mobile: float above the bottom nav. The nav itself is anchored at
  // `max(0.75rem, env(safe-area-inset-bottom))` from the viewport with
  // internal padding for the home indicator, so the FAB has to clear
  // ~64px of nav + the iOS home-indicator inset; otherwise the nav
  // hides the button on iOS PWA. Desktop keeps a flat 1.5rem from
  // the viewport bottom — see `.add-fab` in globals.css.
  return (
    <div
      ref={ref}
      className="add-fab fixed right-4 z-50 md:right-6"
    >
      {open && (
        <div className="mb-3 w-[280px] overflow-hidden rounded-[var(--r-lg)] border border-ink-100/80 bg-paper-2 shadow-xl">
          <div className="px-4 py-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.12em] text-ink-400">
              {locale === "zh" ? "添加 / 记录" : "Add / capture"}
            </div>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {items.map((item, idx) => {
              const Icon = item.icon;
              const inner = (
                <>
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
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[13px] font-semibold text-ink-900">
                      {item.label[locale]}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-500">
                      {item.hint[locale]}
                    </div>
                  </div>
                </>
              );
              const cls =
                "flex w-full items-start gap-3 border-t border-ink-100/60 px-4 py-2.5 hover:bg-ink-100/40";
              return (
                <li key={item.href ?? `action-${item.action}-${idx}`}>
                  {item.action === "ingest" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        useIngestModal.getState().open();
                      }}
                      className={cls}
                    >
                      {inner}
                    </button>
                  ) : (
                    <Link
                      href={item.href!}
                      onClick={() => setOpen(false)}
                      className={cls}
                    >
                      {inner}
                    </Link>
                  )}
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
