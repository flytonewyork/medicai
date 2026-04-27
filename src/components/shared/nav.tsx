"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Route,
  FileText,
  Settings as SettingsIcon,
  ScanLine,
  FlaskConical,
  Compass,
  Syringe,
  Sparkles,
  Salad,
  CalendarDays,
  Users,
  UserPlus,
  Menu,
  X,
  History as HistoryIcon,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { isNavItemActive } from "~/lib/nav/active";
import { useT, useLocale } from "~/hooks/use-translate";
import { useAppPerspective } from "~/lib/caregiver/scope";

// Patient nav: everything. Patient owns self-reporting, treatment,
// assessment, bridge strategy, reports. The "/family" surface is the
// caregiver-perspective landing page — patients land on "/" instead and
// reach household / invites through Settings → Care team, so it's
// excluded here to avoid a confusing duplicate view.
const PATIENT_ITEMS = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard, descKey: "nav.desc.dashboard" },
  { href: "/schedule", key: "nav.schedule", icon: CalendarDays, descKey: "nav.desc.schedule" },
  { href: "/assessment", key: "nav.assessment", icon: Compass, descKey: "nav.desc.assessment" },
  { href: "/treatment", key: "nav.treatment", icon: Syringe, descKey: "nav.desc.treatment" },
  { href: "/labs", key: "nav.labs", icon: FlaskConical, descKey: "nav.desc.labs" },
  { href: "/nutrition", key: "nav.nutrition", icon: Salad, descKey: "nav.desc.nutrition" },
  { href: "/practices", key: "nav.practices", icon: Sparkles, descKey: "nav.desc.practices" },
  { href: "/carers", key: "nav.carers", icon: UserPlus, descKey: "nav.desc.carers" },
  { href: "/bridge", key: "nav.bridge", icon: Route, descKey: "nav.desc.bridge" },
  { href: "/history", key: "nav.history", icon: HistoryIcon, descKey: "nav.desc.history" },
  { href: "/ingest", key: "nav.ingest", icon: ScanLine, descKey: "nav.desc.ingest" },
  { href: "/reports", key: "nav.reports", icon: FileText, descKey: "nav.desc.reports" },
  { href: "/settings", key: "nav.settings", icon: SettingsIcon, descKey: "nav.desc.settings" },
] as const;

// Caregiver nav: the things a supporting family member actually uses
// — the family view, the shared schedule, the care-team call list, a
// place to log what they observed. Patient-authored surfaces (daily
// wizard, weekly/fortnightly, treatment cycle, assessment, bridge,
// reports) are hidden.
const CAREGIVER_ITEMS = [
  { href: "/family", key: "nav.family", icon: Users, descKey: "nav.desc.family" },
  { href: "/schedule", key: "nav.schedule", icon: CalendarDays, descKey: "nav.desc.schedule" },
  { href: "/carers", key: "nav.carers", icon: UserPlus, descKey: "nav.desc.carers" },
  { href: "/nutrition", key: "nav.nutrition", icon: Salad, descKey: "nav.desc.nutrition" },
  { href: "/log", key: "nav.log", icon: Sparkles, descKey: "nav.desc.log" },
  { href: "/history", key: "nav.history", icon: HistoryIcon, descKey: "nav.desc.history" },
  { href: "/settings", key: "nav.settings", icon: SettingsIcon, descKey: "nav.desc.settings" },
] as const;

type NavItem = (typeof PATIENT_ITEMS)[number] | (typeof CAREGIVER_ITEMS)[number];

function isAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/login" || pathname.startsWith("/auth/");
}

function useNavItems(): readonly NavItem[] {
  const perspective = useAppPerspective();
  return perspective === "patient" ? PATIENT_ITEMS : CAREGIVER_ITEMS;
}

export function DesktopSidebar() {
  const t = useT();
  const pathname = usePathname();
  const items = useNavItems();
  if (isAuthRoute(pathname)) return null;
  return (
    <aside className="hidden md:flex md:w-60 flex-col border-r border-ink-100/60 bg-paper-2/60">
      <div className="px-5 py-6">
        <div className="serif text-xl text-ink-900">{t("app.name")}</div>
        <div className="mt-1 text-[11px] text-ink-400">{t("app.tagline")}</div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 pb-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item.href);
          const desc = "descKey" in item ? t(item.descKey) : "";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2 transition-colors",
                active
                  ? "bg-ink-100/80 text-ink-900"
                  : "text-ink-500 hover:bg-ink-100/40 hover:text-ink-700",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  active ? "text-[var(--tide-2)]" : "",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px]">{t(item.key)}</div>
                {desc && desc !== item.descKey && (
                  <div className={cn(
                    "text-[10.5px] leading-tight",
                    active ? "text-ink-500" : "text-ink-400",
                  )}>
                    {desc}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileBottomNav() {
  const t = useT();
  const pathname = usePathname();
  const items = useNavItems();
  if (isAuthRoute(pathname)) return null;
  // Mobile bottom nav keeps the most-used slots. Patients get the
  // dashboard + key axes (assessment / treatment / nutrition) +
  // schedule; caregivers get family + schedule + care team +
  // nutrition + log. Nutrition is first-class because cachexia /
  // weight loss is a primary axis-3 signal in PDAC and is logged
  // daily.
  const patientHrefs = ["/", "/assessment", "/treatment", "/nutrition", "/schedule"];
  const caregiverHrefs = ["/family", "/schedule", "/nutrition", "/carers", "/log"];
  const selected = items === PATIENT_ITEMS ? patientHrefs : caregiverHrefs;
  const mobileItems = items.filter((i) => selected.includes(i.href));
  return (
    <nav
      className="a-glass pwa-bottom-nav fixed inset-x-3 z-40 flex justify-around rounded-[22px] px-2 py-2.5 shadow-lg md:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-3 py-1 transition-colors",
              active ? "text-ink-900" : "text-ink-400",
            )}
          >
            <Icon
              className={cn("h-5 w-5", active ? "text-[var(--tide-2)]" : "")}
              strokeWidth={active ? 1.9 : 1.5}
              aria-hidden
            />
            <span className="mono text-[10px] uppercase tracking-wider">
              {t(item.key)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileMoreMenu() {
  const t = useT();
  const locale = useLocale();
  const pathname = usePathname();
  const items = useNavItems();
  const [open, setOpen] = useState(false);

  // Close the menu whenever navigation happens so the overlay doesn't linger.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isAuthRoute(pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={locale === "zh" ? "菜单" : "Menu"}
        className="flex h-9 w-9 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100/60 hover:text-ink-900 md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink-900/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-3 top-3 rounded-[22px] bg-paper-2 p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="serif text-[17px] tracking-tight text-ink-900">
                {locale === "zh" ? "导航" : "Navigate"}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={locale === "zh" ? "关闭" : "Close"}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100/60 hover:text-ink-900"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="mt-3 grid grid-cols-2 gap-2">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-[13px] transition-colors",
                      active
                        ? "bg-ink-100/80 text-ink-900"
                        : "text-ink-700 hover:bg-ink-100/40",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-[var(--tide-2)]" : "text-ink-400",
                      )}
                      aria-hidden
                    />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
