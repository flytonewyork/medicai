// Threshold descending: the first row whose score is >= threshold wins.
// Categorisations sit at the floor (>= 0) so a falsy score still picks
// up the "minimal" / least-severe bucket.
function severityFor<T extends string>(
  score: number,
  thresholds: ReadonlyArray<readonly [number, T]>,
): T {
  for (const [min, severity] of thresholds) {
    if (score >= min) return severity;
  }
  // Unreachable when the last threshold is 0, which all current tables provide.
  return thresholds[thresholds.length - 1][1];
}

function sumOrThrow(responses: number[], expected: number, name: string): number {
  if (responses.length !== expected) {
    throw new Error(`${name} requires ${expected} responses, got ${responses.length}`);
  }
  return responses.reduce((a, b) => a + b, 0);
}

export function phq9Score(responses: number[]): number {
  return sumOrThrow(responses, 9, "PHQ-9");
}

export function gad7Score(responses: number[]): number {
  return sumOrThrow(responses, 7, "GAD-7");
}

export type Phq9Severity = "minimal" | "mild" | "moderate" | "moderately-severe" | "severe";
export type Gad7Severity = "minimal" | "mild" | "moderate" | "severe";

const PHQ9_THRESHOLDS: ReadonlyArray<readonly [number, Phq9Severity]> = [
  [20, "severe"],
  [15, "moderately-severe"],
  [10, "moderate"],
  [5, "mild"],
  [0, "minimal"],
];

const GAD7_THRESHOLDS: ReadonlyArray<readonly [number, Gad7Severity]> = [
  [15, "severe"],
  [10, "moderate"],
  [5, "mild"],
  [0, "minimal"],
];

export function phq9Severity(score: number): Phq9Severity {
  return severityFor(score, PHQ9_THRESHOLDS);
}

export function gad7Severity(score: number): Gad7Severity {
  return severityFor(score, GAD7_THRESHOLDS);
}
