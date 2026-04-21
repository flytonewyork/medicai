"use client";

import Link from "next/link";
import { useLocale } from "~/hooks/use-translate";
import {
  Activity,
  Utensils,
  MessageCircle,
  FlaskConical,
} from "lucide-react";

export function QuickActions() {
  const locale = useLocale();
  const items = [
    {
      href: "/daily/new",
      icon: Activity,
      label: locale === "zh" ? "记录症状" : "Log symptom",
    },
    {
      href: "/daily/new",
      icon: Utensils,
      label: locale === "zh" ? "记录饮食" : "Log meal + PERT",
    },
    {
      href: "/tasks",
      icon: MessageCircle,
      label: locale === "zh" ? "添加任务" : "Add care task",
    },
    {
      href: "/ingest",
      icon: FlaskConical,
      label: locale === "zh" ? "导入报告" : "Upload report",
    },
  ];

  return (
    <section className="space-y-2.5">
      <h2 className="eyebrow">{locale === "zh" ? "快捷" : "Quick"}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map(({ href, icon: Icon, label }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-ink-100/70 bg-paper-2 px-3.5 py-3 text-[13px] font-medium text-ink-900 transition-colors hover:border-ink-300"
          >
            <Icon className="h-4 w-4 text-[var(--tide-2)]" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
