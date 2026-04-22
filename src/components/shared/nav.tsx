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
  ListTodo,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { useT, useLocale } from "~/hooks/use-translate";

// Stub routes (decisions, events, quarterly) are hidden until those modules ship.
// Medications is accessed contextually (from treatment detail, daily check-in,
// logging FAB) rather than via top-level nav — it's a cross-cutting concept.
const ITEMS = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/assessment", key: "nav.assessment", icon: Compass },
  { href: "/treatment", key: "nav.treatment", icon: Syringe },
  { href: "/labs", key: "nav.labs", icon: FlaskConical },
  { href: "/tasks", key: "nav.tasks", icon: ListTodo },
  { href: "/practices", key: "nav.practices", icon: Sparkles },
  { href: "/bridge", key: "nav.bridge", icon: Route },
  { href: "/ingest", key: "nav.ingest", icon: ScanLine },
  { href: "/reports", key: "nav.reports", icon: FileText },
  { href: "/settings", key: "nav.settings", icon: SettingsIcon },
] as const;

function isAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/login" || pathname.startsWith("/auth/");
}

export function DesktopSidebar() {
  const t = useT();
  const pathname = usePathname();
  if (isAuthRoute(pathname)) return null;
  return (
    <aside className="hidden md:flex md:w-60 flex-col border-r border-ink-100/60 bg-paper-2/60">
      <div className="px-5 py-6">
        <div className="serif text-xl text-ink-900">{t("app.name")}</div>
        <div className="mt-1 text-[11px] text-ink-400">{t("app.tagline")}</div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 pb-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                active
                  ? "bg-ink-100/80 text-ink-900"
                  : "text-ink-500 hover:bg-ink-100/40 hover:text-ink-700",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-[var(--tide-2)]" : "",
                )}
                aria-hidden
              />
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
  if (isAuthRoute(pathname)) return null;
  const mobileItems = ITEMS.filter((i) =>
    ["/", "/treatment", "/labs", "/tasks", "/assessment"].includes(i.href),
  );
  return (
    <nav className="a-glass fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[22px] px-2 py-2.5 shadow-lg md:hidden">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
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
              {ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
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
