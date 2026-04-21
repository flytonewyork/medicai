"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils/cn";

export interface MetricPoint {
  date: string;
  value: number;
}

export function MetricChart({
  points,
  refRange,
  yMax,
  unit,
  locale = "en",
}: {
  points: MetricPoint[];
  refRange?: [number, number];
  yMax: number;
  unit: string;
  locale?: "en" | "zh";
}) {
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setScrubIdx(null);
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-[var(--r-md)] border border-dashed border-ink-200 text-xs text-ink-400">
        {locale === "zh"
          ? "暂无数据 —— 添加记录后显示"
          : "No data — add values to see the trend"}
      </div>
    );
  }

  const W = 320;
  const H = 150;
  const padL = 4;
  const padR = 34;
  const padT = 10;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;
  const x = (i: number) =>
    padL + (i / Math.max(1, points.length - 1)) * innerW;
  const pts = points.map<[number, number]>((p, i) => [x(i), y(p.value)]);
  const line = pts
    .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const area =
    line +
    ` L ${(padL + innerW).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${padL} ${(padT + innerH).toFixed(1)} Z`;

  const lastIdx = points.length - 1;
  const activeIdx = scrubIdx ?? lastIdx;
  const activePt = pts[activeIdx];
  const activeVal = points[activeIdx];
  if (!activePt || !activeVal) return null;
  const [ax, ay] = activePt;
  const isScrubbing = scrubIdx !== null;

  const refTop = refRange ? y(refRange[1]) : null;
  const refBot = refRange ? y(refRange[0]) : null;

  const pickIdx = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    pts.forEach(([px], i) => {
      const d = Math.abs(px - relX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  return (
    <div className="relative mt-3.5">
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible", touchAction: "none" }}
        className="cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const idx = pickIdx(e.clientX);
          if (idx !== null) setScrubIdx(idx);
        }}
        onPointerMove={(e) => {
          if (!(e.buttons || e.pointerType === "touch")) return;
          const idx = pickIdx(e.clientX);
          if (idx !== null) setScrubIdx(idx);
        }}
      >
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line
            key={i}
            x1={padL}
            x2={padL + innerW}
            y1={padT + innerH * f}
            y2={padT + innerH * f}
            stroke="var(--ink-100)"
            strokeWidth={1}
          />
        ))}
        {refRange && refTop !== null && refBot !== null && (
          <>
            <rect
              x={padL}
              y={refTop}
              width={innerW}
              height={Math.max(0, refBot - refTop)}
              fill="oklch(93% 0.025 160 / 0.5)"
            />
            <line
              x1={padL}
              x2={padL + innerW}
              y1={refTop}
              y2={refTop}
              stroke="var(--ok)"
              strokeWidth={0.6}
              strokeDasharray="2 3"
            />
            {refBot < padT + innerH && (
              <line
                x1={padL}
                x2={padL + innerW}
                y1={refBot}
                y2={refBot}
                stroke="var(--ok)"
                strokeWidth={0.6}
                strokeDasharray="2 3"
              />
            )}
          </>
        )}

        <path d={area} fill="oklch(92% 0.025 210 / 0.45)" />
        <path
          d={line}
          fill="none"
          stroke="var(--tide-2)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <line
          x1={ax}
          x2={ax}
          y1={padT}
          y2={padT + innerH}
          stroke={isScrubbing ? "var(--tide-2)" : "var(--ink-400)"}
          strokeWidth={isScrubbing ? 1 : 0.5}
          strokeDasharray="2 3"
          opacity={isScrubbing ? 0.8 : 0.5}
        />

        {pts.map(([px, py], i) => {
          const isActive = i === activeIdx;
          return (
            <circle
              key={i}
              cx={px}
              cy={py}
              r={isActive ? 4.5 : 2.4}
              fill={isActive ? "var(--tide-2)" : "#fff"}
              stroke="var(--tide-2)"
              strokeWidth={isActive ? 2 : 1.75}
            />
          );
        })}

        {isScrubbing ? (
          <g>
            <rect
              x={Math.max(padL, Math.min(ax - 26, padL + innerW - 52))}
              y={Math.max(padT - 6, ay - 26)}
              width="52"
              height="18"
              rx="5"
              fill="var(--ink-900)"
            />
            <text
              x={Math.max(padL + 26, Math.min(ax, padL + innerW - 26))}
              y={Math.max(padT + 6, ay - 14)}
              fontSize="10"
              fontFamily="var(--mono)"
              fontWeight={700}
              fill="#fff"
              textAnchor="middle"
            >
              {activeVal.value}
            </text>
          </g>
        ) : (
          <g>
            <line
              x1={ax}
              x2={padL + innerW + 2}
              y1={ay}
              y2={ay}
              stroke="var(--ink-400)"
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />
            <text
              x={padL + innerW + 4}
              y={ay + 3}
              fontSize="9"
              fontFamily="var(--mono)"
              fill="var(--ink-700)"
              fontWeight={600}
            >
              {activeVal.value}
            </text>
          </g>
        )}
      </svg>

      {refRange && (
        <div
          className="mono absolute right-1 top-0.5 text-[9px] uppercase tracking-wider"
          style={{ color: "var(--ok)" }}
        >
          {locale === "zh" ? "目标" : "TARGET"} {refRange[0]}–{refRange[1]} {unit}
        </div>
      )}

      {!isScrubbing && (
        <div
          className={cn(
            "mono pointer-events-none absolute bottom-6 left-1 text-[8.5px] uppercase tracking-wider opacity-70",
          )}
          style={{ color: "var(--ink-400)" }}
        >
          {locale === "zh" ? "点击或拖动查看" : "Tap or drag to scrub"}
        </div>
      )}
    </div>
  );
}
