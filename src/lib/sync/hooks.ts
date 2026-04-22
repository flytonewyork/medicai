import { db } from "~/lib/db/dexie";
import { enqueueSync } from "./queue";
import { SYNCED_TABLES, type SyncedTable } from "./tables";

let attached = false;

// Attach Dexie `creating` / `updating` / `deleting` hooks to every synced
// table. The hooks fire inside the Dexie transaction; we defer the actual
// enqueue to `transaction.on('complete')` so a rolled-back transaction never
// leaks a ghost sync op.
export function attachSyncHooks(): void {
  if (attached) return;
  attached = true;

  for (const name of SYNCED_TABLES) {
    const table = (db as unknown as Record<string, DexieTableLike>)[name];
    if (!table || typeof table.hook !== "function") {
      // eslint-disable-next-line no-console
      console.warn(`[sync] table ${name} missing from Dexie schema`);
      continue;
    }

    // `creating` — primKey is undefined until Dexie assigns it. `this.onsuccess`
    // receives the assigned id after the insert resolves.
    table.hook("creating", function (
      this: DexieHookContext,
      _primKey,
      obj,
      trans,
    ) {
      this.onsuccess = (assignedKey: number) => {
        trans.on("complete", () => {
          enqueueSync({
            kind: "upsert",
            table: name as SyncedTable,
            local_id: assignedKey,
            data: { ...(obj as object), id: assignedKey },
          });
        });
      };
    });

    // `updating` — `mods` is the delta. We merge onto `obj` so the cloud row
    // reflects the full new state, not just the delta.
    table.hook("updating", function (
      this: DexieHookContext,
      mods,
      primKey,
      obj,
      trans,
    ) {
      this.onsuccess = () => {
        trans.on("complete", () => {
          const merged = { ...(obj as object), ...(mods as object), id: primKey };
          enqueueSync({
            kind: "upsert",
            table: name as SyncedTable,
            local_id: primKey as number,
            data: merged,
          });
        });
      };
    });

    table.hook("deleting", function (primKey, _obj, trans) {
      trans.on("complete", () => {
        enqueueSync({
          kind: "delete",
          table: name as SyncedTable,
          local_id: primKey as number,
        });
      });
    });
  }
}

// Minimal structural typing for the bits of Dexie we touch. Avoids a large
// type import from Dexie internals; the runtime shape is what matters.
type DexieHookContext = { onsuccess?: (assignedKey: number) => void };
type DexieTransaction = { on(event: "complete", cb: () => void): void };
type DexieTableLike = {
  hook(
    event: "creating",
    cb: (
      this: DexieHookContext,
      primKey: unknown,
      obj: unknown,
      trans: DexieTransaction,
    ) => void,
  ): void;
  hook(
    event: "updating",
    cb: (
      this: DexieHookContext,
      mods: unknown,
      primKey: unknown,
      obj: unknown,
      trans: DexieTransaction,
    ) => void,
  ): void;
  hook(
    event: "deleting",
    cb: (primKey: unknown, obj: unknown, trans: DexieTransaction) => void,
  ): void;
};
