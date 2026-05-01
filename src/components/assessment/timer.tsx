"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Square, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";

// Timer + counter primitives used by the wizard's physical-test steps.
// The point: dad's helper shouldn't have to juggle the app, a stopwatch
// AND a chair — the phone is the stopwatch. Tap-to-start, tap-to-stop,
// no chance of miscounting on a small mental-load day.
//
// All three primitives keep the input field editable so the helper can
// override (e.g. they used a stopwatch and just want to type 11.4 s),
// and surface the result so the patient can see the number themselves.

function fmtSeconds(ms: number): string {
  const total = ms / 1000;
  if (total < 60) return total.toFixed(1);
  const m = Math.floor(total / 60);
  const s = (total - m * 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}

interface StopwatchProps {
  // Current saved value (seconds). The button shows this when idle.
  value: number | undefined;
  onChange: (seconds: number | undefined) => void;
  // Optional cap — used by single-leg stance (60 s ceiling).
  maxSeconds?: number;
  // Decimal precision of the saved result.
  precision?: 0 | 1 | 2;
  startLabel?: string;
  stopLabel?: string;
}

export function Stopwatch({
  value,
  onChange,
  maxSeconds,
  precision = 1,
  startLabel,
  stopLabel,
}: StopwatchProps) {
  const locale = useLocale();
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (startRef.current === null) return;
    const now = performance.now();
    const delta = now - startRef.current;
    setElapsedMs(delta);
    if (maxSeconds && delta >= maxSeconds * 1000) {
      // Cap reached — auto-stop and save.
      setRunning(false);
      startRef.current = null;
      onChange(parseFloat((maxSeconds).toFixed(precision)));
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [maxSeconds, onChange, precision]);

  useEffect(() => {
    if (!running) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, tick]);

  function start() {
    setElapsedMs(0);
    startRef.current = performance.now();
    setRunning(true);
  }

  function stop() {
    if (startRef.current === null) return;
    const final = performance.now() - startRef.current;
    setRunning(false);
    startRef.current = null;
    setElapsedMs(final);
    const seconds = parseFloat((final / 1000).toFixed(precision));
    onChange(seconds);
  }

  function reset() {
    setRunning(false);
    startRef.current = null;
    setElapsedMs(0);
    onChange(undefined);
  }

  const display = running
    ? fmtSeconds(elapsedMs)
    : typeof value === "number"
      ? value.toFixed(precision)
      : "0.0";

  return (
    <div className="rounded-lg border border-ink-200 bg-paper p-4">
      <div className="text-center">
        <div className="num text-5xl tabular-nums text-ink-900">
          {display}
          <span className="ml-2 text-base text-ink-500">s</span>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {!running ? (
          <Button onClick={start} size="lg" className="min-h-[3rem] sm:min-w-[10rem]">
            <Play className="h-5 w-5" />
            {startLabel ?? (locale === "zh" ? "开始" : "Start")}
          </Button>
        ) : (
          <Button
            onClick={stop}
            variant="danger"
            size="lg"
            className="min-h-[3rem] sm:min-w-[10rem]"
          >
            <Square className="h-5 w-5" />
            {stopLabel ?? (locale === "zh" ? "停止" : "Stop")}
          </Button>
        )}
        <Button variant="ghost" onClick={reset} disabled={running && elapsedMs === 0}>
          <RotateCcw className="h-4 w-4" />
          {locale === "zh" ? "重置" : "Reset"}
        </Button>
      </div>
    </div>
  );
}

interface CountdownTapCounterProps {
  // Seconds to count down from (e.g. 30 for STS-30, 360 for 6MWT).
  durationSeconds: number;
  // The thing being counted (reps, lengths). What the helper taps.
  value: number | undefined;
  onChange: (count: number | undefined) => void;
  // What each tap adds. STS = 1 rep; 6MWT = 30 m / lap.
  increment?: number;
  tapLabel?: string;
  unit?: string;
}

export function CountdownTapCounter({
  durationSeconds,
  value,
  onChange,
  increment = 1,
  tapLabel,
  unit,
}: CountdownTapCounterProps) {
  const locale = useLocale();
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(durationSeconds * 1000);
  const endRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (endRef.current === null) return;
    const remaining = Math.max(0, endRef.current - performance.now());
    setRemainingMs(remaining);
    if (remaining <= 0) {
      setRunning(false);
      endRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!running) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, tick]);

  function start() {
    onChange(0);
    endRef.current = performance.now() + durationSeconds * 1000;
    setRemainingMs(durationSeconds * 1000);
    setRunning(true);
  }

  function tap() {
    if (!running) return;
    onChange((value ?? 0) + increment);
  }

  function reset() {
    setRunning(false);
    endRef.current = null;
    setRemainingMs(durationSeconds * 1000);
    onChange(undefined);
  }

  const remaining = Math.ceil(remainingMs / 1000);
  const showCount = value ?? 0;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-ink-200 bg-paper p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="eyebrow">
              {locale === "zh" ? "倒计时" : "Time left"}
            </div>
            <div className="num text-3xl tabular-nums text-ink-900">
              {fmtSeconds(remainingMs)}
              <span className="ml-1 text-sm text-ink-500">s</span>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow">
              {locale === "zh" ? "计数" : "Count"}
            </div>
            <div className="num text-4xl tabular-nums text-ink-900">
              {showCount}
              {unit && <span className="ml-1 text-sm text-ink-500">{unit}</span>}
            </div>
          </div>
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={durationSeconds}
          aria-valuenow={Math.max(0, durationSeconds - remaining)}
        >
          <div
            className={cn(
              "h-full transition-[width] duration-200",
              running ? "bg-ink-900" : "bg-ink-300",
            )}
            style={{
              width: `${Math.min(100, ((durationSeconds - remaining) / durationSeconds) * 100)}%`,
            }}
          />
        </div>
      </div>
      {!running ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={start} size="lg" className="min-h-[3rem] flex-1">
            <Play className="h-5 w-5" />
            {locale === "zh" ? "开始" : "Start"}
          </Button>
          <Button
            variant="ghost"
            onClick={reset}
            disabled={typeof value !== "number" && remainingMs === durationSeconds * 1000}
          >
            <RotateCcw className="h-4 w-4" />
            {locale === "zh" ? "重置" : "Reset"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={tap}
          className="block w-full rounded-lg border-2 border-ink-900 bg-ink-900 py-8 text-paper transition-transform active:scale-[0.99]"
          aria-label={tapLabel ?? "Tap to count"}
        >
          <Plus className="mx-auto h-7 w-7" />
          <div className="mt-1 text-base font-semibold">
            {tapLabel ??
              (locale === "zh" ? "点一次记一下" : "Tap to count")}
          </div>
          <div className="mt-0.5 text-xs opacity-80">
            +{increment}
            {unit ? ` ${unit}` : ""}
          </div>
        </button>
      )}
    </div>
  );
}
