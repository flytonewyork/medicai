import type { ComponentType, ReactNode, SVGProps } from "react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils/cn";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface EmptyStateProps {
  icon?: IconComponent;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("p-10 text-center", className)}>
      {Icon ? <Icon className="mx-auto mb-3 h-8 w-8 text-ink-400" /> : null}
      <div className="text-sm font-medium text-ink-900">{title}</div>
      {description ? (
        <div className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
          {description}
        </div>
      ) : null}
      {actions ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </Card>
  );
}
