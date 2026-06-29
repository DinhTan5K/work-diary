// =============================================
// Service Worker - Offline Mode + Custom Logo
// =============================================

// Đổi version này mỗi khi push code mới để SW tự cập nhật cache
const CACHE_VERSION = 'kaito-v2';
const LOGO_CACHE = 'logo-cache-v1';

// Danh sách file cần cache để chạy offline
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

// Các URL bên ngoài cần cache (font, icon)
const EXTERNAL_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@500;700;900&display=swap',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'
];

// ==================
// INSTALL - Tải & cache tất cả file
// ==================
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      console.log('[SW] Đang cache toàn bộ app...');
      // Cache file local trước
      const localCache = cache.addAll(APP_FILES);
      // Cache file bên ngoài (cho phép fail nếu mất mạng lúc install)
      const externalCache = Promise.allSettled(
        EXTERNAL_URLS.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => console.log('[SW] Không cache được:', url))
        )
      );
      return Promise.all([localCache, externalCache]);
    }).then(() => {
      console.log('[SW] Cache xong! App sẵn sàng offline.');
      return self.skipWaiting();
    })
  );
});

// ==================
// ACTIVATE - Xóa cache cũ khi có version mới
// ==================
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          // Xóa cache cũ, giữ lại cache mới và cache logo
          if (key !== CACHE_VERSION && key !== LOGO_CACHE) {
            console.log('[SW] Xóa cache cũ:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Đã kích hoạt version mới!');
      return self.clients.claim();
    })
  );
});

// ==================
// MESSAGE - Nhận custom logo từ trang chính
// ==================
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
    const response = new Response(blob, {
      headers: { 'Content-Type': mimeType }
    });
    caches.open(LOGO_CACHE).then(cache => {
      cache.put('/custom-logo.png', response);
    });
  }

  if (e.data && e.data.type === 'CLEAR_CUSTOM_LOGO') {
    caches.open(LOGO_CACHE).then(cache => {
      cache.delete('/custom-logo.png');
    });
  }
});

// ==================
// FETCH - Chiến lược: Cache First, Network Fallback
// ==================
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // --- Ưu tiên 1: Custom logo ---
  if (url.pathname.endsWith('/logo.png')) {
    e.respondWith(
      caches.open(LOGO_CACHE).then(cache => {
        return cache.match('/custom-logo.png').then(cached => {
          if (cached) return cached;
          // Không có custom → lấy từ app cache hoặc network
          return caches.match(e.request).then(appCached => {
            return appCached || fetch(e.request);
          });
        });
      })
    );
    return;
  }

  // --- Ưu tiên 2: Các file app & external ---
  // Chiến lược "Stale While Revalidate":
  // Trả cache ngay lập tức (nhanh), đồng thời fetch bản mới ở background để cập nhật
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Fetch bản mới ở background để update cache
      const fetchPromise = fetch(e.request).then(networkResponse => {
        // Chỉ cache các response hợp lệ
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(e.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Mất mạng → không làm gì, đã trả cache rồi
      });

      // Trả cache ngay nếu có, không thì chờ network
      return cached || fetchPromise;
    })
  );
});
