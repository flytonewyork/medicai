"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { highestZone } from "~/lib/rules/engine";
import { useLocale } from "~/hooks/use-translate";
import type { Zone } from "~/types/clinical";
import { cn } from "~/lib/utils/cn";

// A calm, one-line status banner for the family surface. Reads all open
// zone_alerts, picks the highest, and renders a measured sentence — no
// stacked alerts, no rule ids, no agent output. Family members just need
// to know "is dad OK right now".

const LABEL: Record<Zone, { en: string; zh: string }> = {
  green: { en: "Stable", zh: "稳定" },
  yellow: { en: "Review needed", zh: "需要复核" },
  orange: { en: "Urgent review", zh: "紧急复核" },
  red: { en: "Immediate action", zh: "立即处理" },
};

const DETAIL: Record<Zone, { en: string; zh: string }> = {
  green: {
    en: "Nothing urgent right now.",
    zh: "目前没有紧急情况。",
  },
  yellow: {
    en: "Something's worth a check — Thomas has the detail.",
    zh: "有一些需要关注的事项 —— Thomas 已在跟进。",
  },
  orange: {
    en: "Talk with Thomas or the clinical team soon.",
    zh: "请尽快与 Thomas 或临床团队联系。",
  },
  red: {
    en: "Action needed now — see emergency card.",
    zh: "需要立刻处理 —— 参考紧急联络卡。",
  },
};

const TONE: Record<Zone, string> = {
  green: "bg-[var(--ok-soft)] text-[var(--ok)]",
  yellow: "bg-[var(--sand)] text-ink-900",
  orange: "bg-[var(--warn-soft)] text-[var(--warn)]",
  red: "bg-[var(--warn-soft)] text-[var(--warn)] ring-1 ring-[var(--warn)]/40",
};

export function ZoneBanner() {
  const locale = useLocale();
  const alerts = useLiveQuery(
    () => db.zone_alerts.toArray(),
    [],
  );
  if (alerts === undefined) return null;
  const open = alerts.filter((a) => !a.resolved);
  const zone = highestZone(open.map((a) => a.zone));
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--r-md)] px-4 py-3",
        TONE[zone],
      )}
      role="status"
    >
      <div className="flex h-2 w-2 shrink-0 rounded-full bg-current" />
      <div className="min-w-0">
        <div className="text-[14px] font-semibold">{LABEL[zone][locale]}</div>
        <div className="mt-0.5 text-[12.5px] opacity-80">
          {DETAIL[zone][locale]}
        </div>
      </div>
    </div>
  );
}
