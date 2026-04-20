export function phq9Score(responses: number[]): number {
  if (responses.length !== 9) {
    throw new Error(`PHQ-9 requires 9 responses, got ${responses.length}`);
  }
  return responses.reduce((a, b) => a + b, 0);
}

export function gad7Score(responses: number[]): number {
  if (responses.length !== 7) {
    throw new Error(`GAD-7 requires 7 responses, got ${responses.length}`);
  }
  return responses.reduce((a, b) => a + b, 0);
}

export function phq9Severity(score: number): "minimal" | "mild" | "moderate" | "moderately-severe" | "severe" {
  if (score >= 20) return "severe";
  if (score >= 15) return "moderately-severe";
  if (score >= 10) return "moderate";
  if (score >= 5) return "mild";
  return "minimal";
}

export function gad7Severity(score: number): "minimal" | "mild" | "moderate" | "severe" {
  if (score >= 15) return "severe";
  if (score >= 10) return "moderate";
  if (score >= 5) return "mild";
  return "minimal";
}
