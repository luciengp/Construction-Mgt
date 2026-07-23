// CMS service worker — app-shell caching only for now.
// The offline submission queue (IndexedDB) arrives in build milestone 7;
// this worker just makes the app installable and lets the shell load
// without signal. Network-first for navigations, cache-first for static
// assets, and never caches Supabase API calls.

const CACHE = "cms-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin requests (e.g. Supabase).
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    // Network-first: fresh pages when online, cached shell when not.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("/")))
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ??
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
    )
  );
});
