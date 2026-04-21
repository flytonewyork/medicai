"use client";

import Link from "next/link";
import { useZoneStatus } from "~/hooks/use-zone-status";
import { useLocale, useT } from "~/hooks/use-translate";
import { Thermometer, AlertTriangle } from "lucide-react";

export function FlaggedCard() {
  const t = useT();
  const locale = useLocale();
  const { alerts } = useZoneStatus();
  const top = alerts[0];

  return (
    <section className="space-y-2.5">
      <h2 className="eyebrow">{t("dashboard.active_alerts")}</h2>

      {!top && (
        <div className="a-card flex items-start gap-3 p-4">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--tide-soft)", color: "var(--tide-2)" }}
          >
            <Thermometer className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {locale === "zh"
                ? "注意用药后发热"
                : "Watch for fever after infusion"}
            </div>
            <div className="mt-0.5 text-xs leading-relaxed text-ink-500">
              {locale === "zh"
                ? "体温 ≥ 38 °C 请立刻前往医院。保持体温计在手边。"
                : "Call the team or attend hospital if temperature ≥ 38.0 °C. Keep a thermometer within reach."}
            </div>
          </div>
        </div>
      )}

      {top && (
        <Link
          href="/"
          className="a-card flex items-start gap-3 p-4"
          style={{ borderLeft: "3px solid var(--warn)" }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {top.rule_name}
            </div>
            <div className="mt-0.5 text-xs leading-relaxed text-ink-500">
              {locale === "zh" ? top.recommendation_zh : top.recommendation}
            </div>
          </div>
        </Link>
      )}
    </section>
  );
}
