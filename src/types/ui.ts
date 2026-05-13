import type { ComponentType } from "react";

// Single source of truth for the lucide-react icon component shape used
// across feed cards, badges, schedule rows, ingest previews, etc.
// Previously duplicated inline as `React.ComponentType<{ className?: string }>`
// in ~30 files.

export type IconComponent = ComponentType<{ className?: string }>;
