const CACHE_NAME = "worklog-vip-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      // Ưu tiên mạng (Network First) cho file HTML để luôn update giao diện mới
      if (event.request.mode === 'navigate') {
        try {
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);
          return await cache.match(event.request);
        }
      }
      
      // Các file khác (ảnh, css...) dùng Cache First
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;
      return fetch(event.request);
    })()
  );
});
