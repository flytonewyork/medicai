// HealthConnectClient factory.
//
// On Android (and the Capacitor WebView running Anchor as a native
// shell), returns the NativeHealthConnectClient backed by the
// `capacitor-health-connect` plugin. Everywhere else (web preview,
// SSR, test) returns a no-op stub that reports unavailability — so
// the surrounding code path is identical and Settings just shows
// "Health Connect not available on this device" without throwing.
//
// Tests should import MockHealthConnectClient directly and inject
// it; this factory is only for production code paths.
import { Capacitor } from "@capacitor/core";
import type { HealthConnectClient } from "./types";
import type {
  WearableMetricKind,
  WearableSyncWindow,
} from "~/types/wearable";

class UnavailableHealthConnectClient implements HealthConnectClient {
  async isAvailable() {
    return false;
  }
  async permissionsFor(metrics: ReadonlyArray<WearableMetricKind>) {
    const result = {} as Record<WearableMetricKind, "not_requested">;
    for (const m of metrics) result[m] = "not_requested";
    return result;
  }
  async requestPermissions(metrics: ReadonlyArray<WearableMetricKind>) {
    return this.permissionsFor(metrics);
  }
  async readDaily(_window: WearableSyncWindow) {
    return [];
  }
}

let cachedClient: HealthConnectClient | null = null;

export async function getHealthConnectClient(): Promise<HealthConnectClient> {
  if (cachedClient) return cachedClient;
  // Health Connect is Android-only. Anything else (web preview, iOS
  // shell, SSR) gets the unavailable stub.
  if (Capacitor.getPlatform() !== "android") {
    cachedClient = new UnavailableHealthConnectClient();
    return cachedClient;
  }
  // Lazy-load the native client only on Android so the
  // `capacitor-health-connect` import doesn't pull plugin types
  // into web bundles.
  const { NativeHealthConnectClient } = await import("./native-client");
  cachedClient = new NativeHealthConnectClient();
  return cachedClient;
}

/** Test seam — clear the cached client so tests can swap platforms. */
export function _resetHealthConnectClientCache(): void {
  cachedClient = null;
}
