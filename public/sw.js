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

// 3. Fetch event: Cache-First for static assets, Network-First for navigation
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Let Next.js API actions and better-auth bypass service worker
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api") || url.pathname.includes("better-auth")) {
    return;
  }

  // Handle navigation requests (pages) - Network-First, with Offline Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the successfully fetched page shell for later offline reads
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
          return response;
        })
        .catch(() => {
          // If network is completely offline, search cache or serve standard offline page
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Handle static sub-resources (JS, CSS, Images, Fonts) - Cache-First, fallback to network
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch updated version in the background to keep cache fresh
          fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {}); // ignore background refresh errors
          
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
          return networkResponse;
        });
      })
    );
  }
});
