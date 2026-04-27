"use client";

import type { FoodItem } from "~/types/nutrition";
import { cn } from "~/lib/utils/cn";

// Visual leading element for a food row. Photo first (data URL or
// remote), emoji fallback, and an "🍽" default. Sized for both the
// catalogue list (lg) and the picker tile (md / sm).
export function FoodThumb({
  food,
  size = "lg",
  className,
}: {
  food: Pick<FoodItem, "image_url" | "emoji" | "name">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = SIZE[size];
  if (food.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={food.image_url}
        alt={food.name}
        className={cn(
          "shrink-0 rounded-md bg-paper-2 object-cover",
          dim.box,
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-paper-2",
        dim.box,
        dim.glyph,
        className,
      )}
    >
      {food.emoji ?? "🍽"}
    </span>
  );
}

const SIZE: Record<"sm" | "md" | "lg", { box: string; glyph: string }> = {
  sm: { box: "h-7 w-7", glyph: "text-base" },
  md: { box: "h-9 w-9", glyph: "text-lg" },
  lg: { box: "h-12 w-12", glyph: "text-2xl" },
};
