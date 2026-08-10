// =============================================
// Service Worker - Auto Update + Offline + Custom Logo
// =============================================

const CACHE_VERSION = 'kaito-v3'; // Đổi version này mỗi khi deploy để ép SW cập nhật
const LOGO_CACHE = 'logo-cache-v1';

const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './brendan.js',
  './firebase.js',
  './logo.png',
  './brendan.png',
  './brendan2.png',
  './brendan3.png',
  './manifest.json'
];

const EXTERNAL_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@500;700;900&display=swap',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'
];

// INSTALL
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Ép Kích hoạt SW mới ngay lập tức
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      const localCache = cache.addAll(APP_FILES);
      const externalCache = Promise.allSettled(
        EXTERNAL_URLS.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => { if (res.ok) return cache.put(url, res); })
            .catch(() => {})
        )
      );
      return Promise.all([localCache, externalCache]);
    })
  );
});

// ACTIVATE
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_VERSION && key !== LOGO_CACHE) {
            console.log('[SW] Xóa cache cũ:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Chiếm quyền kiểm soát tất cả client ngay
  );
});

// MESSAGE
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SET_CUSTOM_LOGO') {
    const base64 = e.data.logo;
    const byteString = atob(base64.split(',')[1]);
    const mimeType = base64.match(/data:(.*?);/)[1];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const response = new Response(blob, { headers: { 'Content-Type': mimeType } });
    caches.open(LOGO_CACHE).then(cache => cache.put('/custom-logo.png', response));
  }

  if (e.data && e.data.type === 'CLEAR_CUSTOM_LOGO') {
    caches.open(LOGO_CACHE).then(cache => cache.delete('/custom-logo.png'));
  }
});

// FETCH
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. Custom logo
  if (url.pathname.endsWith('/logo.png')) {
    e.respondWith(
      caches.open(LOGO_CACHE).then(cache => {
        return cache.match('/custom-logo.png').then(cached => {
          if (cached) return cached;
          return caches.match(e.request).then(appCached => appCached || fetch(e.request));
        });
      })
    );
    return;
  }

  // 2. Chiến lược Network First cho Code Local (để luôn ăn bản mới nhất khi có mạng)
  if (e.request.mode === 'navigate' || url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => caches.match(e.request)) // Mất mạng mới fallback về Cache
    );
    return;
  }

  // 3. Với các file CDNs bên ngoài: Cache First, Fallback Network
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return networkResponse;
      });
    })
  );
});