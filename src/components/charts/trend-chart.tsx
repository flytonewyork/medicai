"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useEffect, useState } from "react";

interface TrendPoint {
  date: string;
  value: number | null;
}

// Recharts writes `stroke` straight onto the SVG attribute, where
// `var(--…)` doesn't resolve. Read the tokens off the root once on
// mount and feed concrete colours in — falls back to sensible defaults
// before hydration.
function useTokenColors() {
  const [colors, setColors] = useState({
    grid: "oklch(88% 0.006 70)",
    line: "oklch(22% 0.015 250)",
  });
  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    const grid = root.getPropertyValue("--ink-200").trim();
    const line = root.getPropertyValue("--ink-900").trim();
    if (grid && line) setColors({ grid, line });
  }, []);
  return colors;
}

export function TrendChart({
  data,
  label,
  domain,
}: {
  data: TrendPoint[];
  label: string;
  domain?: [number | "auto", number | "auto"];
}) {
  const { grid, line } = useTokenColors();
  return (
    <div className="a-card p-4">
      <div className="mb-2 text-sm font-medium text-ink-900">{label}</div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -20, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={grid} />
            <XAxis dataKey="date" fontSize={10} tickMargin={4} />
            <YAxis fontSize={10} domain={domain} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
              labelStyle={{ fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={line}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
