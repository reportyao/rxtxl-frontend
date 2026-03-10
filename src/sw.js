/**
 * Service Worker - 人选天选论 PWA
 * 提供基础的离线缓存能力
 * v4: 深度修复和浏览器适配优化
 */

const CACHE_NAME = 'rxtxl-v4';
const STATIC_ASSETS = [
  '/',
];

// 安装时缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 静默处理缓存失败
        console.log('SW: Some assets failed to cache');
      });
    })
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 网络优先策略（始终从网络获取最新内容）
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;
  // 不缓存 API 请求
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
