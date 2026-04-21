"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Stethoscope,
  ClipboardList,
  Route,
  CalendarClock,
  ScrollText,
  FileText,
  Settings as SettingsIcon,
  ScanLine,
  Compass,
  Syringe,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { useT } from "~/hooks/use-translate";

const ITEMS = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/assessment", key: "nav.assessment", icon: Compass },
  { href: "/treatment", key: "nav.treatment", icon: Syringe },
  { href: "/daily", key: "nav.daily", icon: CalendarDays },
  { href: "/weekly", key: "nav.weekly", icon: CalendarRange },
  { href: "/fortnightly", key: "nav.fortnightly", icon: Stethoscope },
  { href: "/quarterly", key: "nav.quarterly", icon: ClipboardList },
  { href: "/bridge", key: "nav.bridge", icon: Route },
  { href: "/events", key: "nav.events", icon: CalendarClock },
  { href: "/decisions", key: "nav.decisions", icon: ScrollText },
  { href: "/ingest", key: "nav.ingest", icon: ScanLine },
  { href: "/reports", key: "nav.reports", icon: FileText },
  { href: "/settings", key: "nav.settings", icon: SettingsIcon },
] as const;

export function DesktopSidebar() {
  const t = useT();
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 flex-col border-r border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
      <div className="px-5 py-6">
        <div className="text-lg font-semibold">{t("app.name")}</div>
        <div className="text-xs text-slate-500 mt-1">{t("app.tagline")}</div>
      </div>
      <nav className="flex-1 px-2 pb-4 space-y-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{t(item.key)}</span>
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
  const mobileItems = ITEMS.filter((i) =>
    ["/", "/daily", "/weekly", "/reports", "/settings"].includes(i.href),
  );
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around py-2 z-40">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] px-3 py-1 rounded-md",
              active ? "text-slate-900 dark:text-slate-100" : "text-slate-500",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
