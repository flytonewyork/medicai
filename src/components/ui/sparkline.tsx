export function Sparkline({
  values,
  width = 140,
  height = 28,
  stroke = "var(--tide-2)",
  fill,
  showDots = false,
  highlight = -1,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  showDots?: boolean;
  highlight?: number;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map<[number, number]>((v, i) => [
    (i / Math.max(1, values.length - 1)) * (width - 6) + 3,
    height - 3 - ((v - min) / range) * (height - 6),
  ]);
  const d = pts
    .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const area =
    d + ` L ${(width - 3).toFixed(1)} ${height - 3} L 3 ${height - 3} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      {fill && <path d={area} fill={fill} />}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === highlight ? 3 : 1.8}
            fill={i === highlight ? stroke : "var(--paper)"}
            stroke={stroke}
            strokeWidth={1.5}
          />
        ))}
    </svg>
  );
}
