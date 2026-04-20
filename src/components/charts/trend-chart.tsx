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

interface TrendPoint {
  date: string;
  value: number | null;
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
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -20, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" />
            <XAxis dataKey="date" fontSize={10} tickMargin={4} />
            <YAxis fontSize={10} domain={domain} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
              labelStyle={{ fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0f172a"
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
