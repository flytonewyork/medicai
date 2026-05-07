// Health Connect client contract — the abstraction the rest of the
// platform talks to. The native plugin (capacitor-health-connect, on
// Android) implements this interface; tests use MockHealthConnectClient.
// Swapping in a different vendor SDK or going to a Web equivalent is
// a different implementation, not a touch of consumer code.
import type {
  WearableMetricKind,
  WearableObservation,
  WearableSyncWindow,
} from "~/types/wearable";

export type PermissionStatus = "granted" | "denied" | "not_requested";

export interface HealthConnectClient {
  /** Whether Health Connect is installed and reachable on this host. */
  isAvailable(): Promise<boolean>;

  /** Per-metric permission status. Health Connect is type-scoped. */
  permissionsFor(
    metrics: ReadonlyArray<WearableMetricKind>,
  ): Promise<Record<WearableMetricKind, PermissionStatus>>;

  /**
   * Trigger the platform permission flow for the requested metrics.
   * Resolves with the post-flow status. The native impl pops the
   * Health Connect chooser; the mock resolves synchronously.
   */
  requestPermissions(
    metrics: ReadonlyArray<WearableMetricKind>,
  ): Promise<Record<WearableMetricKind, PermissionStatus>>;

  /**
   * Read aggregated daily observations for the requested window.
   * Returns one observation per (metric, date, source_device) — the
   * implementation is responsible for collapsing intra-day records
   * into the daily aggregate the analytical layer expects (sum for
   * steps, mean for RHR, etc).
   *
   * If a metric doesn't have permission, that metric is silently
   * absent from the result — it does not throw. The caller checks
   * permission status separately.
   */
  readDaily(
    window: WearableSyncWindow,
  ): Promise<WearableObservation[]>;
}
