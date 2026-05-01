// In-memory mock of the HealthConnectClient. Tests configure permissions
// + a deterministic observation set, then drive sync.ts through it.
//
// Not exposed on the Capacitor surface — this only lives in tests and
// the Storybook fixtures (when those land for the Settings UI).
import type {
  WearableMetricKind,
  WearableObservation,
  WearableSyncWindow,
} from "~/types/wearable";
import type { HealthConnectClient, PermissionStatus } from "./types";

export interface MockHealthConnectConfig {
  available?: boolean;
  permissions?: Partial<Record<WearableMetricKind, PermissionStatus>>;
  // Pre-loaded observations the mock will return on `readDaily`.
  // Filtered by the requested window + metric set.
  observations?: ReadonlyArray<WearableObservation>;
}

export class MockHealthConnectClient implements HealthConnectClient {
  private available: boolean;
  private perms: Map<WearableMetricKind, PermissionStatus>;
  private store: WearableObservation[];

  constructor(config: MockHealthConnectConfig = {}) {
    this.available = config.available ?? true;
    this.perms = new Map(
      Object.entries(config.permissions ?? {}) as Array<
        [WearableMetricKind, PermissionStatus]
      >,
    );
    this.store = [...(config.observations ?? [])];
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async permissionsFor(
    metrics: ReadonlyArray<WearableMetricKind>,
  ): Promise<Record<WearableMetricKind, PermissionStatus>> {
    const result = {} as Record<WearableMetricKind, PermissionStatus>;
    for (const m of metrics) {
      result[m] = this.perms.get(m) ?? "not_requested";
    }
    return result;
  }

  async requestPermissions(
    metrics: ReadonlyArray<WearableMetricKind>,
  ): Promise<Record<WearableMetricKind, PermissionStatus>> {
    // Default mock behaviour: any metric without an explicit denial
    // becomes granted. Tests can override by pre-seeding `denied`.
    for (const m of metrics) {
      if (this.perms.get(m) === "denied") continue;
      this.perms.set(m, "granted");
    }
    return this.permissionsFor(metrics);
  }

  async readDaily(window: WearableSyncWindow): Promise<WearableObservation[]> {
    const start = window.start_date;
    const end = window.end_date;
    const wanted = new Set(window.metrics);
    return this.store
      .filter((o) => wanted.has(o.metric_id))
      .filter((o) => o.date >= start && o.date <= end)
      .filter((o) => this.perms.get(o.metric_id) === "granted");
  }

  // --- Test helpers --------------------------------------------------

  /** Push an observation into the mock's data store. */
  seed(obs: WearableObservation): void {
    this.store.push(obs);
  }

  /** Override the stored permission for a metric. */
  setPermission(metric: WearableMetricKind, status: PermissionStatus): void {
    this.perms.set(metric, status);
  }
}
