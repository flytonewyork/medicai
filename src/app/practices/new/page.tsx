"use client";

import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { PracticeForm } from "~/components/practices/practice-form";

export default function NewPracticePage() {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "新建修习" : "New practice"}
        title={
          locale === "zh"
            ? "添加行为干预"
            : "Add a behavioural intervention"
        }
      />
      <PracticeForm />
    </div>
  );
}
