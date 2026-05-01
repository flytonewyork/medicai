// Feature flags. These are compile-time constants, not runtime config —
// flipping a flag requires a deploy. That's intentional for a clinical
// platform: we want flags to be auditable in source control, not
// reachable through a dashboard. Tests that need to override a flag
// should import the relevant constant via the analytical-layer entry
// point that consumes it, not poke at this module directly.

export const FEATURES = {
  // Master switch for the analytical layer (cycle-detrending, change-
  // point detection, acute-flag bypass, provisional signal state
  // machine). When false, the new detectors do not register and the
  // patient feed is unchanged. The foundation primitives (loaders,
  // pure functions) ship with this PR and remain unit-tested even
  // while the flag is off — flipping the flag wires them into the
  // detector evaluation path.
  analytical_layer: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

export function isEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}
