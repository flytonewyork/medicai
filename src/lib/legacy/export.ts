import type { EnteredBy } from "~/types/clinical";
import type {
  BiographicalOutline,
  MemoryCluster,
  ProfileAspect,
  ProfileConsent,
  ProfileEntry,
  ProfilePrompt,
} from "~/types/legacy";
import type { TimelineMedia } from "~/types/timeline";

// Encrypted legacy export bundle.
//
// Produces a serialised, passphrase-encrypted blob containing the
// Legacy corpus in a form a future AI-companion build (out of app)
// can ingest. Never leaves the device except via user-initiated save.
//
// Two content profiles:
//   1. Manifest — structured JSON: aspects, outline, prompts, entries
//      metadata. Always included.
//   2. Blobs — raw audio/video/photo files.  Included unless consent
//      for that modality is refused.
//
// Crypto: AES-GCM 256 with PBKDF2 KDF (100k iterations) seeded from the
// user's passphrase. Argon2 was preferred per spec but the Web Crypto
// API doesn't ship with it; PBKDF2-SHA256 at 100k iterations is the
// standard browser fallback and is sufficient for a local-only user
// export. Salt and IV are fresh per export and prepended to the
// ciphertext.

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const BUNDLE_VERSION = 1;

export interface LegacyBundleManifest {
  version: number;
  exported_at: string;
  bundle_version: number;
  consent: ProfileConsent | null;
  // Content only exported when the relevant consent mode is ON.
  // Everything below is opt-in by consent gates.
  includes: {
    reminiscence: boolean; // voice + video playback material
    letter: boolean; // letter-mode material
    advisor: boolean; // advisor-mode (opinions, values) material
    voice_cloning: boolean; // raw audio for TTS cloning
  };
  counts: {
    profile_entries: number;
    profile_aspects: number;
    profile_prompts: number;
    biographical_outline: number;
    memory_clusters: number;
    timeline_media_refs: number;
  };
  profile_entries: ProfileEntry[];
  profile_aspects: ProfileAspect[];
  profile_prompts: ProfilePrompt[];
  biographical_outline: BiographicalOutline[];
  memory_clusters: MemoryCluster[];
  // Media is referenced by owner_type+owner_id; actual blobs live in
  // a separate media/ file entry when the bundler writes a zip.
  timeline_media_refs: Array<{
    id: number;
    owner_type: TimelineMedia["owner_type"];
    owner_id: number;
    kind: TimelineMedia["kind"];
    mime_type: string;
    duration_ms?: number;
    width?: number;
    height?: number;
    created_by: EnteredBy;
    created_at: string;
    // The binary sits in media/{id}.{ext}; consent gates may omit.
  }>;
}

export interface BuildManifestInput {
  consent: ProfileConsent | null;
  profile_entries: ProfileEntry[];
  profile_aspects: ProfileAspect[];
  profile_prompts: ProfilePrompt[];
  biographical_outline: BiographicalOutline[];
  memory_clusters: MemoryCluster[];
  timeline_media: TimelineMedia[];
  now_iso?: string;
}

/** Build a manifest respecting consent gates. Pure function. */
export function buildManifest(
  input: BuildManifestInput,
): LegacyBundleManifest {
  const consent = input.consent;
  const includes = {
    reminiscence: consent?.reminiscence_mode === true,
    letter: consent?.letter_mode === true,
    advisor: consent?.advisor_mode === true,
    voice_cloning: consent?.voice_cloning_for_tts === true,
  };

  // Entry gating: advisor_mode ungates opinions/values/quotes;
  // reminiscence_mode ungates voice/video/photo captures and stories;
  // letter_mode ungates sealed letters. With all consent OFF, only
  // neutral metadata goes out.
  const gatedEntries = input.profile_entries.filter((e) =>
    shouldExportEntry(e, includes),
  );

  // Media: only include references when reminiscence_mode is on AND
  // voice cloning is on for audio OR the kind is photo (always under
  // reminiscence_mode).
  const gatedMediaRefs = includes.reminiscence
    ? input.timeline_media
        .filter((m) =>
          m.kind === "voice"
            ? includes.voice_cloning
            : true,
        )
        .map((m) => ({
          id: m.id!,
          owner_type: m.owner_type,
          owner_id: m.owner_id,
          kind: m.kind,
          mime_type: m.mime_type,
          duration_ms: m.duration_ms,
          width: m.width,
          height: m.height,
          created_by: m.created_by,
          created_at: m.created_at,
        }))
    : [];

  return {
    version: 1,
    exported_at: input.now_iso ?? new Date().toISOString(),
    bundle_version: BUNDLE_VERSION,
    consent,
    includes,
    counts: {
      profile_entries: gatedEntries.length,
      profile_aspects: input.profile_aspects.length,
      profile_prompts: input.profile_prompts.length,
      biographical_outline: input.biographical_outline.length,
      memory_clusters: input.memory_clusters.length,
      timeline_media_refs: gatedMediaRefs.length,
    },
    profile_entries: gatedEntries,
    profile_aspects: input.profile_aspects,
    profile_prompts: input.profile_prompts,
    biographical_outline: input.biographical_outline,
    memory_clusters: input.memory_clusters,
    timeline_media_refs: gatedMediaRefs,
  };
}

function shouldExportEntry(
  entry: ProfileEntry,
  includes: LegacyBundleManifest["includes"],
): boolean {
  // Private-to-author entries never export.
  if (entry.private_to_author) return false;

  switch (entry.kind) {
    case "voice_memo":
    case "video":
    case "photo":
    case "story":
    case "mannerism":
      return includes.reminiscence;
    case "value":
    case "opinion":
    case "preference":
    case "quote":
      return includes.advisor;
    case "relationship":
      return includes.reminiscence || includes.advisor;
  }
}

// ── Crypto ──────────────────────────────────────────────────────────

export interface EncryptedPackage {
  /** Bytes: [salt(16)][iv(12)][ciphertext…] */
  payload: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      // TypeScript 5.9 narrowed Uint8Array's buffer type; the Web Crypto
      // typings want BufferSource. Upcast via the underlying buffer.
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptManifest(
  manifest: LegacyBundleManifest,
  passphrase: string,
): Promise<EncryptedPackage> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("passphrase must be at least 8 characters");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const plain = new TextEncoder().encode(JSON.stringify(manifest));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      plain.buffer as ArrayBuffer,
    ),
  );
  const payload = new Uint8Array(salt.length + iv.length + cipher.length);
  payload.set(salt, 0);
  payload.set(iv, salt.length);
  payload.set(cipher, salt.length + iv.length);
  return { payload, salt, iv };
}

export async function decryptManifest(
  payload: Uint8Array,
  passphrase: string,
): Promise<LegacyBundleManifest> {
  if (payload.length < SALT_BYTES + IV_BYTES + 1) {
    throw new Error("payload truncated");
  }
  // Copy into fresh ArrayBuffers so TS 5.9's narrowed Uint8Array buffer
  // type satisfies the Web Crypto BufferSource shape.
  const salt = new Uint8Array(payload.subarray(0, SALT_BYTES));
  const iv = new Uint8Array(
    payload.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES),
  );
  const cipher = new Uint8Array(payload.subarray(SALT_BYTES + IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      cipher.buffer as ArrayBuffer,
    ),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as LegacyBundleManifest;
}
