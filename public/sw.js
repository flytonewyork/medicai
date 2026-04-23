// Anchor service worker — Slice D push subscriptions.
//
// Scope is narrow by design: we only handle `push` events to display
// notifications, and `notificationclick` to focus / open the right
// page. We deliberately avoid fetch-caching and background sync in
// this slice — Dexie + the app's existing pull retry handle offline
// reads, and fetch interception adds cache-invalidation complexity
// we'd rather not own yet.

/* eslint-env serviceworker */

self.addEventListener("install", () => {
  // Activate the new SW immediately instead of waiting for all tabs to
  // close. Safe here because we don't cache anything that could go
  // stale.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim open clients so the first install gets push coverage without
  // a reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // Payloads are JSON shaped as { title, body, url?, tag? }. We pass
  // through whatever the server sent verbatim; a missing payload
  // falls back to a safe generic message.
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (_err) {
    data = { title: "Anchor", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Anchor";
  const options = {
    body: data.body || "",
    icon: "/anchor-mark.svg",
    badge: "/anchor-mark.svg",
    // `tag` lets a newer push replace an older one of the same kind
    // so we don't stack "appointment tomorrow" notifications.
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Prefer focusing an existing Anchor tab, then navigating it.
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target);
            return;
          }
        }
        // No open tabs → open a new one.
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      }),
  );
});
