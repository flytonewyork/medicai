"use client";

import { useHouseholdPresence } from "~/hooks/use-household-presence";
import { useHousehold } from "~/hooks/use-household";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";

// Who else in the household has this surface open right now. Shows up
// to 4 avatar bubbles + "+N" overflow. Hides when nobody else is
// present — a lone viewer gets no UI.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function PresenceStack({
  surface,
  className,
}: {
  surface: string;
  className?: string;
}) {
  const locale = useLocale();
  const { profile } = useHousehold();
  const { present } = useHouseholdPresence(surface);

  // Exclude self so it reads as "who else" rather than "including me".
  const others = present.filter((p) => p.user_id !== profile?.id);
  if (others.length === 0) return null;

  const shown = others.slice(0, 4);
  const overflow = others.length - shown.length;
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] text-ink-500",
        className,
      )}
      aria-label={L(
        `${others.length} other${others.length === 1 ? "" : "s"} viewing this`,
        `另有 ${others.length} 人在看`,
      )}
    >
      <div className="flex -space-x-1">
        {shown.map((m) => (
          <span
            key={m.user_id}
            title={m.display_name}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-paper bg-[var(--tide-soft)] text-[9.5px] font-semibold text-[var(--tide-2)]"
          >
            {initials(m.display_name)}
          </span>
        ))}
        {overflow > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-paper bg-ink-100 text-[9.5px] font-medium text-ink-700">
            +{overflow}
          </span>
        )}
      </div>
      <span>
        {others.length === 1
          ? L(`${others[0]!.display_name} is here too`, `${others[0]!.display_name} 同时在看`)
          : L(`${others.length} others here`, `另有 ${others.length} 人在看`)}
      </span>
    </div>
  );
}
