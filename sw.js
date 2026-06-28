// Service Worker nhỏ gọn - chỉ phục vụ việc trả logo tùy chỉnh cho iOS Home Screen
const LOGO_CACHE = 'logo-cache-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SET_CUSTOM_LOGO') {
    // Nhận base64 từ trang chính, lưu vào Cache API
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

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Chỉ chặn request tới logo.png
  if (url.pathname.endsWith('/logo.png')) {
    e.respondWith(
      caches.open(LOGO_CACHE).then(cache => {
        return cache.match('/custom-logo.png').then(cached => {
          if (cached) return cached;
          // Không có custom logo thì lấy file gốc bình thường
          return fetch(e.request);
        });
      })
    );
    return;
  }
});
