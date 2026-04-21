import { cn } from "~/lib/utils/cn";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="serif text-[28px] leading-[1.15] tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-ink-500">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 shrink-0">{action}</div>
      )}
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
      <h2 className="eyebrow">{title}</h2>
      {description && (
        <p className="text-sm text-ink-500">{description}</p>
      )}
    </div>
  );
}
