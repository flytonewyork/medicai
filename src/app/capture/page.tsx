"use client";

import Link from "next/link";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { ChevronRight, NotebookPen, Utensils } from "lucide-react";

// Quick-snap hub — a dedicated surface for casual camera captures that
// aren't clinical documents (meal photos, handwritten journal notes).
// Kept separate from `/ingest` so the clinical ingest page stays focused
// on medical-document intake; the AddFab routes both flows directly.

export default function CapturePage() {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={L("QUICK SNAP", "快拍")}
        title={L("Quick capture", "快速记录")}
        subtitle={L(
          "Casual photos — a meal, a handwritten note. Kept separate from clinical document ingest.",
          "随手拍照 —— 一餐饭、一页手写笔记。与临床文档导入分开处理。",
        )}
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/ingest/meal"
          className="a-card flex items-start gap-3 p-4 transition-colors hover:border-ink-300"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
            <Utensils className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {L("Meal photo → protein + calories", "餐食照片 → 蛋白与热量")}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {L(
                "Snap the plate; Claude estimates macros and a PERT suggestion.",
                "拍一张盘中餐；Claude 估算宏量并建议胰酶剂量。",
              )}
            </div>
          </div>
          <ChevronRight className="mt-1.5 h-4 w-4 text-ink-300" />
        </Link>

        <Link
          href="/ingest/notes"
          className="a-card flex items-start gap-3 p-4 transition-colors hover:border-ink-300"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
            <NotebookPen className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {L("Handwritten notes → daily log", "手写笔记 → 今日日志")}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {L(
                "Photograph a paper note; it's transcribed and structured into today's entry.",
                "拍一张手写日记；自动转录并整理到今日条目。",
              )}
            </div>
          </div>
          <ChevronRight className="mt-1.5 h-4 w-4 text-ink-300" />
        </Link>
      </section>
    </div>
  );
}
