"use client";

import { HttpError, postJson } from "~/lib/utils/http";

// Client-side push subscribe / unsubscribe / status. Wraps the
// ServiceWorker + PushManager dance and the server round-trips so the
// Settings UI stays tiny.
//
// Browser capability caveats (worth documenting where someone will read
// them): Safari on iOS supports Web Push only when the app is installed
// to the home screen (iOS 16.4+). Desktop Chrome/Firefox/Edge Just
// Work. On Android, installing the PWA is optional but recommended
// because the browser keeps the SW alive more aggressively.

export type PushSupport =
  | { kind: "unsupported"; reason: string }
  | { kind: "supported"; permission: NotificationPermission };

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { kind: "unsupported", reason: "server" };
  }
  if (!("serviceWorker" in navigator)) {
    return { kind: "unsupported", reason: "no-service-worker" };
  }
  if (!("PushManager" in window)) {
    return { kind: "unsupported", reason: "no-push-manager" };
  }
  if (!("Notification" in window)) {
    return { kind: "unsupported", reason: "no-notifications" };
  }
  return { kind: "supported", permission: Notification.permission };
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return null;
    return (await reg.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function fetchPublicKey(): Promise<string | null> {
  const res = await fetch("/api/push/public-key");
  if (!res.ok) return null;
  const data = (await res.json()) as { public_key?: string };
  return data.public_key ?? null;
}

// Web Push needs the VAPID public key as a Uint8Array (not base64url
// string) when calling subscribe. This helper converts.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Std);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(args: {
  locale: "en" | "zh";
}): Promise<
  | { ok: true; endpoint: string }
  | { ok: false; reason: string }
> {
  const support = getPushSupport();
  if (support.kind !== "supported") {
    return { ok: false, reason: support.reason };
  }
  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "sw-registration-failed" };

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const pubKey = await fetchPublicKey();
  if (!pubKey) return { ok: false, reason: "no-vapid-key" };

  let sub: PushSubscription;
  try {
    // PushManager.subscribe accepts BufferSource at runtime; TS's
    // lib.dom Uint8Array generic is narrower than the spec — cast
    // through unknown to BufferSource.
    const appKey = urlBase64ToUint8Array(pubKey) as unknown as BufferSource;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKey,
    });
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }

  const json = sub.toJSON();
  try {
    await postJson("/api/push/subscribe", {
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
      locale: args.locale,
    });
  } catch (err) {
    // Roll back the browser-side subscription if the server rejected.
    try {
      await sub.unsubscribe();
    } catch {
      // ignore
    }
    const reason =
      err instanceof HttpError ? err.body || "server-rejected" : "server-rejected";
    return { ok: false, reason };
  }
  return { ok: true, endpoint: json.endpoint ?? "" };
}

export async function disablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sub = await getCurrentSubscription();
  if (!sub) return { ok: true };
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    // continue — server cleanup is still worth doing
  }
  try {
    await postJson("/api/push/unsubscribe", { endpoint });
  } catch {
    return { ok: false, reason: "server-error" };
  }
  return { ok: true };
}

export async function sendTestPush(): Promise<boolean> {
  const res = await fetch("/api/push/send-test", { method: "POST" });
  return res.ok;
}
