// Public surface of the wearable integration. Consumers import from
// here, never from individual modules.
export {
  syncWearableObservations,
  wearableObservationId,
  type WearableSyncDeps,
} from "./sync";

export {
  mergeWearableIntoDailyEntry,
  type WearableMergeArgs,
  type WearableMergeResult,
} from "./precedence";

export {
  MockHealthConnectClient,
  type MockHealthConnectConfig,
} from "./mock-client";

export type {
  HealthConnectClient,
  PermissionStatus,
} from "./types";

export {
  getHealthConnectClient,
  _resetHealthConnectClientCache,
} from "./client";
