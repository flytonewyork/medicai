import { describe, it, expect } from "vitest";
import {
  buildManifest,
  decryptManifest,
  encryptManifest,
} from "~/lib/legacy/export";
import type {
  ProfileConsent,
  ProfileEntry,
} from "~/types/legacy";

const ALL_ON_CONSENT: ProfileConsent = {
  id: 1,
  reminiscence_mode: true,
  letter_mode: true,
  advisor_mode: true,
  free_form_chat: false,
  voice_cloning_for_tts: true,
  last_updated_by: "hulin",
  updated_at: "2026-04-24T09:00:00",
};

const ALL_OFF_CONSENT: ProfileConsent = {
  id: 1,
  reminiscence_mode: false,
  letter_mode: false,
  advisor_mode: false,
  free_form_chat: false,
  voice_cloning_for_tts: false,
  last_updated_by: "hulin",
  updated_at: "2026-04-24T09:00:00",
};

function entry(
  overrides: Partial<ProfileEntry> & Pick<ProfileEntry, "id" | "kind">,
): ProfileEntry {
  return {
    language: "en",
    recorded_at: "2026-04-24",
    author: "hulin",
    entry_mode: "first_person_subject",
    visibility: "family",
    propagate: true,
    tags: [],
    created_at: "2026-04-24",
    updated_at: "2026-04-24",
    ...overrides,
  };
}

describe("buildManifest consent gating", () => {
  it("includes reminiscence-tier entries only when reminiscence_mode is on", () => {
    const entries: ProfileEntry[] = [
      entry({ id: 1, kind: "voice_memo" }),
      entry({ id: 2, kind: "story" }),
      entry({ id: 3, kind: "value" }),
    ];
    const withReminiscence = buildManifest({
      consent: {
        ...ALL_OFF_CONSENT,
        reminiscence_mode: true,
      },
      profile_entries: entries,
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [],
    });
    expect(
      withReminiscence.profile_entries.map((e) => e.kind).sort(),
    ).toEqual(["story", "voice_memo"]);

    const allOff = buildManifest({
      consent: ALL_OFF_CONSENT,
      profile_entries: entries,
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [],
    });
    expect(allOff.profile_entries).toHaveLength(0);
  });

  it("ungates advisor entries only when advisor_mode is on", () => {
    const entries: ProfileEntry[] = [
      entry({ id: 1, kind: "value" }),
      entry({ id: 2, kind: "opinion" }),
      entry({ id: 3, kind: "quote" }),
    ];
    const withAdvisor = buildManifest({
      consent: {
        ...ALL_OFF_CONSENT,
        advisor_mode: true,
      },
      profile_entries: entries,
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [],
    });
    expect(withAdvisor.profile_entries).toHaveLength(3);
  });

  it("always omits private_to_author entries", () => {
    const entries: ProfileEntry[] = [
      entry({ id: 1, kind: "story", private_to_author: true }),
      entry({ id: 2, kind: "story" }),
    ];
    const out = buildManifest({
      consent: ALL_ON_CONSENT,
      profile_entries: entries,
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [],
    });
    expect(out.profile_entries.map((e) => e.id)).toEqual([2]);
  });

  it("omits voice media refs when voice_cloning is off but keeps photo/video", () => {
    const out = buildManifest({
      consent: {
        ...ALL_OFF_CONSENT,
        reminiscence_mode: true,
        voice_cloning_for_tts: false,
      },
      profile_entries: [],
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [
        {
          id: 1,
          owner_type: "life_event",
          owner_id: 1,
          kind: "voice",
          blob: new Blob([new Uint8Array(0)]),
          mime_type: "audio/webm",
          created_at: "2026-04-24",
          created_by: "hulin",
        },
        {
          id: 2,
          owner_type: "life_event",
          owner_id: 1,
          kind: "photo",
          blob: new Blob([new Uint8Array(0)]),
          mime_type: "image/jpeg",
          created_at: "2026-04-24",
          created_by: "hulin",
        },
      ],
    });
    expect(out.timeline_media_refs.map((r) => r.kind)).toEqual(["photo"]);
  });

  it("includes voice media refs when voice_cloning is on", () => {
    const out = buildManifest({
      consent: ALL_ON_CONSENT,
      profile_entries: [],
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [
        {
          id: 1,
          owner_type: "life_event",
          owner_id: 1,
          kind: "voice",
          blob: new Blob([new Uint8Array(0)]),
          mime_type: "audio/webm",
          created_at: "2026-04-24",
          created_by: "hulin",
        },
      ],
    });
    expect(out.timeline_media_refs).toHaveLength(1);
  });
});

describe("encrypt/decrypt manifest", () => {
  it("round-trips a manifest through encryption with the right passphrase", async () => {
    const manifest = buildManifest({
      consent: ALL_ON_CONSENT,
      profile_entries: [entry({ id: 1, kind: "story", title: "First trip" })],
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [],
    });
    const pkg = await encryptManifest(manifest, "correct-horse-battery-staple");
    const decoded = await decryptManifest(
      pkg.payload,
      "correct-horse-battery-staple",
    );
    expect(decoded.profile_entries[0]?.title).toBe("First trip");
  });

  it("fails to decrypt with a wrong passphrase", async () => {
    const manifest = buildManifest({
      consent: ALL_ON_CONSENT,
      profile_entries: [entry({ id: 1, kind: "story" })],
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [],
    });
    const pkg = await encryptManifest(manifest, "first-passphrase");
    await expect(
      decryptManifest(pkg.payload, "second-passphrase"),
    ).rejects.toBeTruthy();
  });

  it("rejects passphrases shorter than 8 characters", async () => {
    const manifest = buildManifest({
      consent: ALL_ON_CONSENT,
      profile_entries: [],
      profile_aspects: [],
      profile_prompts: [],
      biographical_outline: [],
      memory_clusters: [],
      timeline_media: [],
    });
    await expect(encryptManifest(manifest, "short")).rejects.toThrow(
      /8 characters/,
    );
  });
});
