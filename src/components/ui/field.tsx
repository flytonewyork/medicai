import { cn } from "~/lib/utils/cn";
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";

// Anchor-tokenised form primitives. All styling reads from the ink/paper/tide
// CSS variables so inputs stay readable even when the OS reports dark mode —
// Tailwind's `dark:` variant was flipping backgrounds independently of our
// token theme, leaving dark text on dark fills in Smart Ingest.
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-[13px] font-medium text-ink-700">{label}</span>
      {children}
      {hint && (
        <span className="block text-[11px] text-ink-500">{hint}</span>
      )}
    </label>
  );
}

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-[13px] font-medium text-ink-700", className)}
      {...props}
    />
  );
}

const INPUT_CLASSES =
  "h-11 w-full rounded-md border border-ink-200 bg-paper px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900/10";

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(INPUT_CLASSES, className)} {...props} />
));
TextInput.displayName = "TextInput";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900/10",
        className,
      )}
      {...props}
    />
  );
}
