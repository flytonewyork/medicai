export function BarScale({
  value,
  max = 10,
  color = "var(--tide-2)",
  bg = "var(--ink-100)",
  w = 120,
  h = 6,
}: {
  value: number;
  max?: number;
  color?: string;
  bg?: string;
  w?: number;
  h?: number;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div
      style={{
        width: w,
        height: h,
        background: bg,
        borderRadius: 999,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct * 100}%`,
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}
