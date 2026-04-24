// 睡眠打卡 PWA Service Worker
const CACHE_NAME = 'sleep-tracker-v1';

// 首次安装时缓存的核心资源
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// 需要缓存的外部 CDN 域名
const CDN_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
];

// ===== 安装：预缓存核心文件 =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ===== 激活：清理旧版缓存 =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ===== 拦截请求 =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 本地资源：缓存优先，缓存未命中时走网络并缓存结果
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // CDN 外部资源（字体 / Chart.js）：网络优先，离线时回退缓存
  const isCDN = CDN_DOMAINS.some(d => url.hostname.includes(d));
  if (isCDN) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  // 其他请求直接走网络
  event.respondWith(fetch(event.request));
});

// 缓存优先策略
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('离线状态，资源不可用', { status: 503 });
  }
}

// 网络优先策略（CDN 资源）
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('', { status: 503 });
  }
}
