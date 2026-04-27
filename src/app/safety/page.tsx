"use client";

import Link from "next/link";
import { Shield, Activity, ChevronRight } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";

// Safety reference index. Two clinical guides, both Cancer Institute
// NSW (eviq.org.au) patient information sheets that JPCC distributes.
//
// Reachable from:
//   - /nutrition/guide → "see neutropenia full playbook"
//   - /treatment/[id]   → "see chemo-at-home precautions"
//   - feed nudges        → /safety/chemo-at-home (post-dose)
//                          /safety/neutropenia    (nadir)

export default function SafetyIndex() {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={L("SAFETY", "安全指引")}
        title={L("Safety at home", "居家安全")}
        subtitle={L(
          "Two clinical reference sheets from Cancer Institute NSW, distributed by JPCC.",
          "Cancer Institute NSW 的两份临床指引，由 JPCC 推荐使用。",
        )}
      />

      <Card>
        <Link
          href="/safety/chemo-at-home"
          className="flex items-start gap-3 rounded-md p-4 transition-colors hover:bg-paper-2/40"
        >
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tide-2)]" />
          <div className="min-w-0 flex-1">
            <div className="serif text-base text-ink-900">
              {L("Chemotherapy safety at home", "居家化疗安全")}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-500">
              {L(
                "Body-fluid precautions for the 48 hours (and up to 7 days) after each dose. Toilet use, vomiting, spills, laundry, sex.",
                "每次用药后 48 小时（部分药物可达 7 天）的体液防护：如厕、呕吐、清理、洗涤、性生活。",
              )}
            </div>
          </div>
          <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-ink-400" />
        </Link>
      </Card>

      <Card>
        <Link
          href="/safety/neutropenia"
          className="flex items-start gap-3 rounded-md p-4 transition-colors hover:bg-paper-2/40"
        >
          <Activity className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tide-2)]" />
          <div className="min-w-0 flex-1">
            <div className="serif text-base text-ink-900">
              {L(
                "Neutropenia & infection prevention",
                "中性粒细胞减少 & 感染防护",
              )}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-500">
              {L(
                "Reducing infection risk while neutrophils are low (~7–14 days after each dose). Hand hygiene, food safety, when to call.",
                "中性粒细胞低谷期（用药后 7–14 天）的感染防护：手卫生、饮食安全、何时联系医生。",
              )}
            </div>
          </div>
          <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-ink-400" />
        </Link>
      </Card>
    </div>
  );
}
