"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useZoneStatus } from "~/hooks/use-zone-status";
import { useLocale } from "~/hooks/use-translate";
import { Phone, AlertOctagon, MapPin } from "lucide-react";

export function EmergencyCard() {
  const locale = useLocale();
  const settings = useLiveQuery(() => db.settings.toArray());
  const s = settings?.[0];
  const { zone } = useZoneStatus();

  const hasAnyContact =
    s?.oncall_phone ||
    s?.managing_oncologist_phone ||
    s?.hospital_phone;

  if (!hasAnyContact) return null;

  const showExpanded = zone === "red" || zone === "orange";

  return (
    <section
      className="rounded-[var(--r-md)] border"
      style={{
        background: showExpanded ? "var(--warn-soft)" : "var(--paper-2)",
        borderColor: showExpanded
          ? "var(--warn)"
          : "color-mix(in oklch, var(--ink-900), transparent 92%)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{
            background: showExpanded ? "var(--warn)" : "var(--tide-soft)",
            color: showExpanded ? "white" : "var(--tide-2)",
          }}
        >
          <AlertOctagon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-ink-900">
            {showExpanded
              ? locale === "zh"
                ? "警示激活 — 必要时拨打"
                : "Alert active — call if needed"
              : locale === "zh"
                ? "紧急联络人"
                : "Emergency contacts"}
          </div>
          <div className="mono mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">
            {locale === "zh"
              ? "体温 ≥ 38 °C → 立即前往医院"
              : "Temp ≥ 38 °C → hospital now"}
          </div>
        </div>
      </div>

      {showExpanded && (
        <div className="border-t border-ink-100/70 px-4 py-3 space-y-1.5">
          {s?.oncall_phone && (
            <ContactLink
              icon={Phone}
              label={locale === "zh" ? "24 小时值班" : "24/7 on-call"}
              value={s.oncall_phone}
              href={`tel:${s.oncall_phone.replace(/\s/g, "")}`}
              tone="warn"
            />
          )}
          {s?.managing_oncologist_phone && (
            <ContactLink
              icon={Phone}
              label={s.managing_oncologist ?? (locale === "zh" ? "主诊" : "Oncologist")}
              value={s.managing_oncologist_phone}
              href={`tel:${s.managing_oncologist_phone.replace(/\s/g, "")}`}
            />
          )}
          {s?.hospital_phone && (
            <ContactLink
              icon={Phone}
              label={s.hospital_name ?? (locale === "zh" ? "医院" : "Hospital")}
              value={s.hospital_phone}
              href={`tel:${s.hospital_phone.replace(/\s/g, "")}`}
            />
          )}
          {s?.hospital_address && (
            <ContactLink
              icon={MapPin}
              label={locale === "zh" ? "医院地址" : "Hospital address"}
              value={s.hospital_address}
              href={`https://maps.google.com/?q=${encodeURIComponent(s.hospital_address)}`}
            />
          )}
          {s?.emergency_instructions && (
            <p className="mt-2 text-xs leading-relaxed text-ink-700">
              {s.emergency_instructions}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ContactLink({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
  tone?: "warn";
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-3 rounded-[var(--r-sm)] px-2 py-1.5 hover:bg-ink-100/40"
    >
      <span className="flex items-center gap-2 text-xs text-ink-500">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span
        className="mono num text-[12.5px] font-semibold"
        style={{
          color: tone === "warn" ? "var(--warn)" : "var(--ink-900)",
        }}
      >
        {value}
      </span>
    </a>
  );
}
