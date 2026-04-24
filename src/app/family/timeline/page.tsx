"use client";

import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { TimelineStream } from "~/components/family/timeline-stream";

// Family-facing chronological timeline. Diary pages, memories, family
// moments, and the clinical spine rendered together as one scrollable
// stream — calm, date-grouped, reverse-chrono.
//
// This page sits deliberately on the family surface, not the patient's
// primary feed. The patient's feed stays priority-ranked (zone alerts
// first). See docs/LEGACY_MODULE.md §"Design principles".

export default function FamilyTimelinePage() {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "家人时间线" : "FAMILY TIMELINE"}
        title={locale === "zh" ? "我们的时间线" : "Our timeline"}
        subtitle={
          locale === "zh"
            ? "日记、记忆、家庭时刻,以及这段旅程的每一个节点。"
            : "Diary pages, memories, family moments, and the quiet markers of this journey."
        }
      />
      <TimelineStream />
    </div>
  );
}
