const CACHE_NAME = "du2bao2-v4-legal-footer";
const LOCAL_FILES = [
  "./",
  "./index.html",
  "./product.html",
  "./shipping.html",
  "./returns.html",
  "./privacy.html",
  "./terms.html",
  "./prohibited-items.html",
  "./safety.html",
  "./seller-rules.html",
  "./marketplace-role.html",
  "./contact.html",
  "./styles.css",
  "./script.js",
  "./product.js",
  "./data.js",
  "./config.js",
  "./manifest.webmanifest",
  "./favicon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(LOCAL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
