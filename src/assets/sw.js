/**
 * 人选天选论 Service Worker
 * 实现离线缓存和PWA功能
 * v2: 升级缓存版本，改为网络优先策略，确保用户始终获取最新内容
 */

const CACHE_NAME = 'rxtxl-v3';
const STATIC_CACHE = 'rxtxl-static-v3';
const API_CACHE = 'rxtxl-api-v3';

// 需要预缓存的静态资源（只缓存首页，其余网络优先）
const PRECACHE_URLS = [
  '/',
];

// 安装事件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 激活事件：清除所有旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 请求拦截：网络优先策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 非 GET 请求直接放行
  if (request.method !== 'GET') return;

  // API 请求：网络优先，失败回退缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // 静态资源：网络优先（确保用户获取最新版本），失败回退缓存
  event.respondWith(
    fetch(request)
      .then((fetchResponse) => {
        if (fetchResponse.status === 200) {
          const responseClone = fetchResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return fetchResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
