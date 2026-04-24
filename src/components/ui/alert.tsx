import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "~/lib/utils/cn";

type AlertVariant = "warn" | "ok" | "info";

const VARIANT_STYLES: Record<
  AlertVariant,
  { background: string; border: string; color: string; icon: typeof Info }
> = {
  warn: {
    background: "var(--warn-soft)",
    border: "color-mix(in oklch, var(--warn), transparent 70%)",
    color: "var(--warn)",
    icon: AlertTriangle,
  },
  ok: {
    background: "var(--ok-soft)",
    border: "color-mix(in oklch, var(--ok), transparent 70%)",
    color: "var(--ok)",
    icon: CheckCircle2,
  },
  info: {
    background: "var(--tide-soft)",
    border: "color-mix(in oklch, var(--tide-2), transparent 70%)",
    color: "var(--tide-2)",
    icon: Info,
  },
};

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: ReactNode;
  icon?: ReactNode | false;
  dense?: boolean;
}

export function Alert({
  variant = "info",
  title,
  icon,
  dense,
  className,
  children,
  ...props
}: AlertProps) {
  const tone = VARIANT_STYLES[variant];
  const IconComponent = tone.icon;
  return (
    <div
      {...props}
      className={cn(
        "flex items-start gap-2 rounded-[var(--r-sm)] border px-3",
        dense ? "py-2 text-xs" : "py-2.5 text-sm",
        className,
      )}
      style={{
        background: tone.background,
        borderColor: tone.border,
        color: tone.color,
        ...props.style,
      }}
    >
      {icon !== false && (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center",
            dense ? "mt-[1px]" : "mt-[2px]",
          )}
        >
          {icon ?? <IconComponent className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        </span>
      )}
      <div className="min-w-0 flex-1 leading-snug">
        {title && (
          <div className={cn("font-medium", children && "mb-0.5")}>{title}</div>
        )}
        {children}
      </div>
    </div>
  );
}
