import { cn } from "~/lib/utils/cn";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      )}
    </div>
  );
}
