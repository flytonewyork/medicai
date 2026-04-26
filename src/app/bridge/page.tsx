"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale, useT, useL } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { ShieldCheck, Clock, Activity } from "lucide-react";

export default function BridgePage() {
  const t = useT();
  const locale = useLocale();
  const L = useL();
  const trials = useLiveQuery(() =>
    db.trials.orderBy("priority").toArray(),
  );

  const pillars = [
    {
      icon: ShieldCheck,
      title: L("Preserve ECOG status", "维持 ECOG 功能状态"),
      body: L(
        "Daraxonrasib requires ECOG 0–1 for trial eligibility. Every point of functional decline narrows the window. This platform watches axis 3 — treatment-driven toxicity — which standard oncology often misses until it's too late to reverse.",
        "Daraxonrasib 要求 ECOG 0–1 才符合入组标准。每一分功能下降都会收窄这个窗口。本平台监测第三轴——治疗驱动的毒性——这是标准肿瘤科常常在无法逆转之前才能发现的。",
      ),
    },
    {
      icon: Activity,
      title: L("Track the three axes", "追踪三轴"),
      body: L(
        "ECOG is shaped by tumour burden (axis 1), cancer-driven symptoms (axis 2), and treatment toxicity (axis 3). Scans cover axis 1. This platform fills the axis 3 gap: neuropathy, sarcopenia, fatigue trends, and functional tests like grip and gait speed.",
        "ECOG 由三个轴决定：肿瘤负荷（轴 1）、癌症驱动的症状（轴 2）和治疗毒性（轴 3）。影像覆盖轴 1，本平台填补轴 3 的空白：神经病变、肌肉减少、疲劳趋势，以及握力和步速等功能测试。",
      ),
    },
    {
      icon: Clock,
      title: L("The window", "时间窗口"),
      body: L(
        "RASolute 302 enrollment closes June 2026. FDA accelerated approval may open expanded access earlier. The goal of first-line GnP is not maximum response — it is arriving at the second-line window with enough functional reserve to enter it.",
        "RASolute 302 入组截止 2026 年 6 月。FDA 加速审批可能更早开放扩展使用。一线 GnP 的目标不是最大反应率——而是在功能储备充足时到达二线窗口。",
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <PageHeader
        title={t("nav.bridge")}
        subtitle={
          L(
            "Bridge strategy to daraxonrasib — preserve function while the window opens.",
            "daraxonrasib 的桥接策略 —— 维持功能，等待机会。",
          )
        }
      />

      {/* Always-visible strategy explainer */}
      <div className="grid gap-4 md:grid-cols-3">
        {pillars.map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.title} className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[13px] font-semibold text-ink-900">
                  {p.title}
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink-600">
                {p.body}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Trial cards — only shown when data is available */}
      {trials && trials.length > 0 && (
        <div className="space-y-3">
          <div className="eyebrow text-ink-500">
            {L("Active pathways", "活跃通道")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {trials.map((trial) => (
              <div
                key={trial.trial_id}
                className="rounded-[var(--r-md)] border border-ink-100/70 bg-paper-2 p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold text-ink-900">{trial.name}</h2>
                  <span className="mono text-[10px] uppercase tracking-wider text-ink-400">
                    {trial.phase}
                  </span>
                </div>
                <div className="mono mt-1 text-[10px] uppercase tracking-wider text-ink-500">
                  {trial.trial_id}
                </div>
                <div className="mt-3 text-sm text-ink-700">
                  {trial.eligibility_summary}
                </div>
                <div className="mt-3 inline-flex items-center rounded-full border border-ink-200 px-2 py-0.5 text-xs capitalize text-ink-600">
                  {trial.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No-trial state — the strategy explainer above is the bridge
          page's primary content; trial cards are an optional overlay
          when concrete pathway data has been loaded into Dexie. */}
    </div>
  );
}
