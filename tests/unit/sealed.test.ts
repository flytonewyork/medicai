import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  createSealedEntry,
  isUnlocked,
  listNewlyUnlockable,
  listSealedForRecipient,
  openSealed,
  readMetadata,
  SEALED_TAG,
} from "~/lib/legacy/sealed";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("sealed entries", () => {
  it("creates a legacy letter private-to-author with sealed metadata", async () => {
    const id = await createSealedEntry({
      metadata: {
        kind: "legacy_letter",
        unlock_date: "2046-07-12",
        unlock_event: "Thomas's 70th birthday",
        recipients: ["thomas"],
      },
      body: "Thomas, when you read this you'll be the age I am now...",
      language: "en",
      author: "hulin",
      title: "To Thomas on his 70th",
    });
    const row = await db.profile_entries.get(id);
    expect(row?.visibility).toBe("private");
    expect(row?.propagate).toBe(false);
    expect(row?.private_to_author).toBe(true);
    expect(row?.tags).toContain(SEALED_TAG);
    expect(row?.tags).toContain("legacy_letter");
    expect(row?.transcript).toContain("Thomas, when you read this");

    const md = readMetadata(row!);
    expect(md?.kind).toBe("legacy_letter");
    expect(md?.recipients).toEqual(["thomas"]);
    expect(md?.unlock_date).toBe("2046-07-12");
  });

  it("isUnlocked is false before the unlock date", () => {
    const row = {
      tags: [SEALED_TAG, "legacy_letter"],
      summary: JSON.stringify({
        kind: "legacy_letter",
        unlock_date: "2046-07-12",
        recipients: ["thomas"],
      }),
    } as any;
    expect(isUnlocked(row, "2026-04-24")).toBe(false);
    expect(isUnlocked(row, "2046-07-11")).toBe(false);
    expect(isUnlocked(row, "2046-07-12")).toBe(true);
    expect(isUnlocked(row, "2050-01-01")).toBe(true);
  });

  it("openSealed refuses non-recipients", async () => {
    const id = await createSealedEntry({
      metadata: {
        kind: "legacy_letter",
        unlock_date: "2026-01-01",
        recipients: ["thomas"],
      },
      body: "Private note to Thomas.",
      language: "en",
      author: "hulin",
    });
    const attempt = await openSealed(id, "catherine", "2026-04-24");
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toContain("recipient");
  });

  it("openSealed refuses when not yet unlocked", async () => {
    const id = await createSealedEntry({
      metadata: {
        kind: "legacy_letter",
        unlock_date: "2046-07-12",
        recipients: ["thomas"],
      },
      body: "Too early.",
      language: "en",
      author: "hulin",
    });
    const attempt = await openSealed(id, "thomas", "2026-04-24");
    expect(attempt.ok).toBe(false);
  });

  it("openSealed unlocks and records opener + timestamp", async () => {
    const id = await createSealedEntry({
      metadata: {
        kind: "advent_snippet",
        unlock_date: "2026-04-01",
        recipients: ["thomas"],
      },
      body: "A snippet for you today.",
      language: "en",
      author: "hulin",
    });
    const result = await openSealed(id, "thomas", "2026-04-24");
    expect(result.ok).toBe(true);
    const row = await db.profile_entries.get(id);
    expect(row?.private_to_author).toBe(false);
    expect(row?.visibility).toBe("author_and_hulin");
    const md = readMetadata(row!);
    expect(md?.opened_at).toBeDefined();
    expect(md?.opened_by).toBe("thomas");
  });

  it("openSealed is idempotent on already-opened entries", async () => {
    const id = await createSealedEntry({
      metadata: {
        kind: "advent_snippet",
        unlock_date: "2026-04-01",
        recipients: ["thomas"],
      },
      body: "Hello.",
      language: "en",
      author: "hulin",
    });
    const first = await openSealed(id, "thomas", "2026-04-24");
    const second = await openSealed(id, "thomas", "2026-04-25");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.metadata.opened_at).toBe(second.metadata.opened_at);
    }
  });

  it("listSealedForRecipient filters correctly", async () => {
    await createSealedEntry({
      metadata: {
        kind: "legacy_letter",
        unlock_date: "2040-01-01",
        recipients: ["thomas"],
      },
      body: "For Thomas.",
      language: "en",
      author: "hulin",
    });
    await createSealedEntry({
      metadata: {
        kind: "legacy_letter",
        unlock_date: "2040-01-01",
        recipients: ["catherine"],
      },
      body: "For Catherine.",
      language: "en",
      author: "hulin",
    });
    const thomas = await listSealedForRecipient("thomas");
    const catherine = await listSealedForRecipient("catherine");
    expect(thomas).toHaveLength(1);
    expect(catherine).toHaveLength(1);
    expect(thomas[0]?.transcript).toContain("For Thomas");
  });

  it("listNewlyUnlockable returns entries ripe today but unopened", async () => {
    await createSealedEntry({
      metadata: {
        kind: "advent_snippet",
        unlock_date: "2026-04-01",
        recipients: ["thomas"],
      },
      body: "Ripe today.",
      language: "en",
      author: "hulin",
    });
    await createSealedEntry({
      metadata: {
        kind: "advent_snippet",
        unlock_date: "2046-07-12",
        recipients: ["thomas"],
      },
      body: "Future.",
      language: "en",
      author: "hulin",
    });
    const ready = await listNewlyUnlockable("2026-04-24");
    expect(ready).toHaveLength(1);
    expect(ready[0]?.transcript).toContain("Ripe today");
  });
});
