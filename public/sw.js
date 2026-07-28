const CACHE_NAME = "nln-shell-v1";
const ASSETS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        });
        return cached ?? network;
      }),
    ),
  );
});

self.addEventListener("push", (event) => {
  const raw = event.data?.text();
  if (!raw) return;
  try {
    const payload = JSON.parse(raw);
    event.waitUntil(
      self.registration.showNotification(payload.title ?? "NightLife", {
        body: payload.body ?? "",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        data: { url: payload.url ?? "/" },
        tag: payload.tag,
        requireInteraction: payload.requireInteraction ?? false,
      }),
    );
  } catch {
    // malformed payload — silent drop
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.includes(self.location.origin)) {
          w.focus();
          return w.navigate(url);
        }
      }
      return clients.openWindow(url);
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "nln-offline-sync") {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((windows) => {
        windows.forEach((w) => w.postMessage({ type: "nln:sync" }));
      }),
    );
  }
});
