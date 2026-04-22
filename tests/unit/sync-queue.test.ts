import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Supabase browser client before importing the queue module.
// `processQueue` bails early when no client is configured — the tests that
// care about real push behavior patch the mock's return value per-test.
const upsertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("~/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowser: () => ({
    from: fromMock,
  }),
}));

import {
  enqueueSync,
  pendingSyncCount,
  withSyncSuppressed,
  __resetSyncQueueForTests,
} from "~/lib/sync/queue";

beforeEach(() => {
  __resetSyncQueueForTests();
  upsertMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();
  fromMock.mockReset();

  // Chain builder. Supabase's update/eq/eq resolves only when awaited after
  // the final eq; the intermediate eq returns a thenable-like object that
  // exposes another eq for further filtering. We model this by making eq
  // return an object that both has .eq AND is awaitable (via .then).
  const awaitable = (value: unknown) => ({
    then: (resolve: (v: unknown) => void) => resolve(value),
    eq: eqMock,
  });
  eqMock.mockImplementation(() => awaitable({ error: null }));
  updateMock.mockImplementation(() => ({ eq: eqMock }));
  fromMock.mockImplementation(() => ({
    upsert: upsertMock,
    update: updateMock,
  }));

  upsertMock.mockResolvedValue({ error: null });
});

async function flushMicrotasks() {
  // `enqueueSync` schedules via `void processQueue()`. Flush the promise chain
  // plus one extra tick so the queue has a chance to drain.
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("sync queue — enqueueSync", () => {
  it("pushes an upsert for a creating op", async () => {
    enqueueSync({
      kind: "upsert",
      table: "daily_entries",
      local_id: 42,
      data: { id: 42, date: "2026-04-22" },
    });
    await flushMicrotasks();

    expect(fromMock).toHaveBeenCalledWith("cloud_rows");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      table_name: "daily_entries",
      local_id: 42,
      deleted: false,
      data: { id: 42, date: "2026-04-22" },
    });
  });

  it("pushes a delete op as a soft delete (deleted=true)", async () => {
    enqueueSync({
      kind: "delete",
      table: "medications",
      local_id: 9,
    });
    await flushMicrotasks();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({ deleted: true });
    // Two .eq() filters: table_name, local_id
    expect(eqMock).toHaveBeenNthCalledWith(1, "table_name", "medications");
    expect(eqMock).toHaveBeenNthCalledWith(2, "local_id", 9);
  });
});

describe("sync queue — withSyncSuppressed", () => {
  it("suppresses enqueued ops while the callback runs", async () => {
    await withSyncSuppressed(async () => {
      enqueueSync({
        kind: "upsert",
        table: "daily_entries",
        local_id: 1,
        data: { id: 1 },
      });
      expect(pendingSyncCount()).toBe(0);
    });
    await flushMicrotasks();

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("resumes enqueueing after the callback completes", async () => {
    await withSyncSuppressed(async () => {
      // no-op
    });
    enqueueSync({
      kind: "upsert",
      table: "medications",
      local_id: 5,
      data: { id: 5 },
    });
    await flushMicrotasks();
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});

describe("sync queue — retry on failure", () => {
  it("keeps a failed op at the head of the queue", async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: "network down" } });

    enqueueSync({
      kind: "upsert",
      table: "daily_entries",
      local_id: 77,
      data: { id: 77 },
    });
    await flushMicrotasks();

    // The op failed — still pending for the next tick.
    expect(pendingSyncCount()).toBe(1);

    // Next drain succeeds and clears the queue.
    upsertMock.mockResolvedValueOnce({ error: null });
    enqueueSync({
      kind: "upsert",
      table: "medications",
      local_id: 1,
      data: { id: 1 },
    });
    await flushMicrotasks();
    // Both the retried op and the new op should have pushed now.
    expect(upsertMock).toHaveBeenCalledTimes(3); // 1 fail + 1 retry + 1 new
    expect(pendingSyncCount()).toBe(0);
  });
});
