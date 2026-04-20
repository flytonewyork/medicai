export function movingAverage(values: number[], window: number): number[] {
  if (window <= 0) return values.slice();
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const sum = slice.reduce((acc, v) => acc + v, 0);
    out.push(sum / slice.length);
  }
  return out;
}

export function percentChange(baseline: number, current: number): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

export function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] ?? 0;
    const y = values[i] ?? 0;
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function consecutiveRising(values: number[]): number {
  let count = 1;
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1] ?? 0;
    const curr = values[i] ?? 0;
    if (curr > prev) count++;
    else count = 1;
  }
  return count;
}
