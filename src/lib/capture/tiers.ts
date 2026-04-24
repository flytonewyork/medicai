// Capture tier caps. The module has two primary tiers for user-facing
// capture of media into timeline_media. These limits are enforced at the
// capture layer (UI + hooks) — the schema is permissive because the
// biographer / orchestrator may later synthesise media from other sources
// that don't respect these caps.
//
// See docs/LEGACY_MODULE.md §"Capture tiers" for context.

export type CaptureTier = "moment" | "legacy";

export interface TierCaps {
  /** Max duration for video capture, ms. */
  videoMaxMs: number;
  /** Max duration for voice capture, ms. */
  voiceMaxMs: number;
  /** Soft ceiling on blob size in bytes. UI should warn (not block) above this. */
  softSizeCeilingBytes: number;
}

export const TIER_CAPS: Record<CaptureTier, TierCaps> = {
  // Casual timeline posts — photo, short clip, quick voice note.
  moment: {
    videoMaxMs: 10_000,
    voiceMaxMs: 60_000,
    softSizeCeilingBytes: 25 * 1024 * 1024,
  },
  // Intentional legacy captures — cooking technique, storytelling, Qigong.
  // The 10-min video cap + 30-min voice cap match the user-confirmed
  // envelope; long-form ambient capture is a separate tier handled in a
  // later slice.
  legacy: {
    videoMaxMs: 10 * 60_000,
    voiceMaxMs: 30 * 60_000,
    softSizeCeilingBytes: 500 * 1024 * 1024,
  },
};

export function capsFor(tier: CaptureTier): TierCaps {
  return TIER_CAPS[tier];
}
