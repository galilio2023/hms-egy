const CACHE_NAME = "hms-egy-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/favicon.ico",
  "/manifest.json"
];

// 1. Install event: Pre-cache standard offline shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Activate event: Cleanup older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Fetch event: Whitelist-based caching for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // IMPLEMENT DEFENSIVE WHITELIST: Only cache known static sub-resources
  // This prevents accidental PHI leaks from dynamic clinical pages or API routes
  const isStaticAsset = 
    (url.pathname.includes("_next/static/") && !url.pathname.includes("_next/data/")) || 
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/static/") ||
    url.pathname.endsWith(".ico") ||
    (url.pathname.startsWith("/locales/") || url.pathname === "/manifest.json");

  if (!isStaticAsset && request.mode !== "navigate") {
    return;
  }

  // Handle navigation requests (pages) - Network-Only, with Offline Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        // Return cached offline shell instead of caching dynamic sensitive pages
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Handle static sub-resources (JS, CSS, Images, Fonts)
  if (isStaticAsset) {
    const isPureCacheFirst = 
      url.pathname.startsWith("/fonts/") || 
      url.pathname.startsWith("/images/") || 
      url.pathname.includes("_next/static/");

    if (isPureCacheFirst) {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          return cachedResponse || fetch(request).then((networkResponse) => {
            // Allow 200 (Success) or 0 (Opaque from CDN) for static assets
            const isCachable = networkResponse.status === 200 || (networkResponse.status === 0 && (request.destination === "font" || request.destination === "image"));
            if (isCachable) {
              const responseCopy = networkResponse.clone();
              event.waitUntil(
                caches.open(CACHE_NAME).then((cache) => {
                  return cache.put(request, responseCopy);
                })
              );
            }
            return networkResponse;
          });
        })
      );
      return;
    }

    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch updated version in the background to keep cache fresh
          fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseCopy = networkResponse.clone();
              event.waitUntil(
                caches.open(CACHE_NAME).then((cache) => {
                  return cache.put(request, responseCopy);
                })
              );
            }
          }).catch(() => {}); // ignore background refresh errors
          
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseCopy = networkResponse.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
              return cache.put(request, responseCopy);
            })
          );
          return networkResponse;
        });
      })
    );
  }
});
