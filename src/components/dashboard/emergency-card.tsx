"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "~/lib/db/dexie";
import { useZoneStatus } from "~/hooks/use-zone-status";
import { useT } from "~/hooks/use-translate";
import { Phone, AlertOctagon, MapPin, ChevronDown, ChevronUp } from "lucide-react";

export function EmergencyCard() {
  const t = useT();
  const settings = useLiveQuery(() => db.settings.toArray());
  const s = settings?.[0];
  const { zone } = useZoneStatus();

  const hasAnyContact =
    s?.oncall_phone ||
    s?.managing_oncologist_phone ||
    s?.hospital_phone;

  const alertActive = zone === "red" || zone === "orange";
  const [open, setOpen] = useState(false);
  // Zone loads async from Dexie; auto-open once an alert fires, but let the
  // user close it without flipping back open on every re-render.
  useEffect(() => {
    if (alertActive) setOpen(true);
  }, [alertActive]);

  if (!hasAnyContact) return null;

  return (
    <section
      className="rounded-[var(--r-md)] border"
      style={{
        background: alertActive ? "var(--warn-soft)" : "var(--paper-2)",
        borderColor: alertActive
          ? "var(--warn)"
          : "color-mix(in oklch, var(--ink-900), transparent 92%)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        aria-label={open ? t("emergencyCard.hideContacts") : t("emergencyCard.showContacts")}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{
            background: alertActive ? "var(--warn)" : "var(--tide-soft)",
            color: alertActive ? "white" : "var(--tide-2)",
          }}
        >
          <AlertOctagon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-ink-900">
            {alertActive
              ? t("emergencyCard.alertActive")
              : t("emergencyCard.alertInactive")}
          </div>
          <div className="mono mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">
            {t("emergencyCard.tempWarning")}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-ink-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-ink-100/70 px-4 py-3 space-y-1.5">
          {s?.oncall_phone && (
            <ContactLink
              icon={Phone}
              label={t("emergencyCard.oncall")}
              value={s.oncall_phone}
              href={`tel:${s.oncall_phone.replace(/\s/g, "")}`}
              tone="warn"
            />
          )}
          {s?.managing_oncologist_phone && (
            <ContactLink
              icon={Phone}
              label={s.managing_oncologist ?? t("emergencyCard.oncology")}
              value={s.managing_oncologist_phone}
              href={`tel:${s.managing_oncologist_phone.replace(/\s/g, "")}`}
            />
          )}
          {s?.hospital_phone && (
            <ContactLink
              icon={Phone}
              label={s.hospital_name ?? t("emergencyCard.hospital")}
              value={s.hospital_phone}
              href={`tel:${s.hospital_phone.replace(/\s/g, "")}`}
            />
          )}
          {s?.hospital_address && (
            <ContactLink
              icon={MapPin}
              label={t("emergencyCard.hospital")}
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
