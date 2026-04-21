import { cn } from "~/lib/utils/cn";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "tide";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantCls: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-paper hover:bg-ink-700 disabled:opacity-50",
  secondary:
    "border border-ink-200 bg-paper-2 text-ink-900 hover:border-ink-300",
  ghost:
    "text-ink-500 hover:bg-ink-100/60",
  danger:
    "bg-[var(--warn)] text-white hover:opacity-90",
  tide:
    "bg-[var(--tide-2)] text-paper hover:brightness-110",
};

const sizeCls: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tide-2)]/50 focus:ring-offset-2 focus:ring-offset-paper disabled:cursor-not-allowed",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
