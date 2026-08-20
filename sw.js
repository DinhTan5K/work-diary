// =============================================
// Service Worker - Auto Update + Offline + Custom Logo
// =============================================

// BƯỚC 1: Đổi cái này thành v để nó bắt đầu reset lại toàn bộ
const CACHE_VERSION = 'v2.0.9'; 
const LOGO_CACHE = 'logo-cache-v1';

const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './brendan.js',
  './firebase.js',
  './img/logo.png',
  './img/brendan.png',
  './img/brendan2.png',
  './img/brendan3.png',
  './img/new1.png',
  './manifest.json'
];

const EXTERNAL_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@500;700;900&display=swap',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'
];

// INSTALL
self.addEventListener('install', (e) => {
  self.skipWaiting(); 
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Ép tải mới toàn bộ lúc install, không dùng cache HTTP
      const localCache = Promise.all(
        APP_FILES.map(url => {
          return fetch(url, { cache: 'no-store' }).then(res => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {});
        })
      );
      
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
    }).then(() => self.clients.claim()) 
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

  if (e.data && e.data.type === 'GET_VERSION') {
    e.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});

// FETCH
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. Custom logo
  if (url.pathname.endsWith('/img/logo.png')) {
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

  // 2. CHIẾN LƯỢC TỐI THƯỢNG: ÉP LẤY TỪ SERVER TRỰC TIẾP
  if (e.request.mode === 'navigate' || url.origin === location.origin) {
    e.respondWith(
      // Thêm { cache: 'no-store' } để vượt mặt HTTP Cache của Safari/Chrome
      fetch(e.request.url, { cache: 'no-store' }).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Chỉ khi nào mất mạng hoàn toàn (Offiline) mới lôi trong cache ra xài
        return caches.match(e.request);
      }) 
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