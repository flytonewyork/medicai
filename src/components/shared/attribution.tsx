"use client";

import { useHouseholdProfiles } from "~/hooks/use-household-profiles";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";

// Small inline chip: "Thomas · 2h ago" when a profile exists for the
// given auth uid; falls back to the legacy `entered_by` label for rows
// saved before Slice C. Used on daily-entry rows, follow-up log
// events, and anywhere else we want subtle "who wrote this" context.

const STRING_LABELS: Record<string, { en: string; zh: string }> = {
  hulin: { en: "Hu Lin", zh: "胡林" },
  thomas: { en: "Thomas", zh: "Thomas" },
  catherine: { en: "Catherine", zh: "Catherine" },
  clinician: { en: "Clinician", zh: "医师" },
  jonalyn: { en: "Jonalyn", zh: "Jonalyn" },
};

export function Attribution({
  enteredBy,
  enteredByUserId,
  at,
  className,
}: {
  enteredBy?: string | null;
  enteredByUserId?: string | null;
  at?: string | null;
  className?: string;
}) {
  const locale = useLocale();
  const { profilesById } = useHouseholdProfiles();

  const profile = enteredByUserId ? profilesById.get(enteredByUserId) : null;
  const stringLabel = enteredBy
    ? (STRING_LABELS[enteredBy]?.[locale] ?? enteredBy)
    : null;
  const label = profile?.display_name || stringLabel;

  if (!label && !at) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-ink-400",
        className,
      )}
    >
      {label && <span className="text-ink-500">{label}</span>}
      {label && at && <span aria-hidden>·</span>}
      {at && <span>{formatRelative(at, locale)}</span>}
    </span>
  );
}

function formatRelative(iso: string, locale: "en" | "zh"): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const deltaSec = Math.round((Date.now() - t) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 60) return locale === "zh" ? "刚刚" : "just now";
  if (abs < 60 * 60) {
    const m = Math.floor(abs / 60);
    return locale === "zh" ? `${m} 分钟前` : `${m}m ago`;
  }
  if (abs < 60 * 60 * 24) {
    const h = Math.floor(abs / 3600);
    return locale === "zh" ? `${h} 小时前` : `${h}h ago`;
  }
  const d = Math.floor(abs / 86400);
  if (d < 7) return locale === "zh" ? `${d} 天前` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(
    locale === "zh" ? "zh-CN" : "en-AU",
    { month: "short", day: "numeric" },
  );
}
