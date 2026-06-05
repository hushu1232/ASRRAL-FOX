/**
 * AstralFox Service Worker
 *
 * 为桌面宠物伴侣提供基础离线支持：
 * 1. 预缓存关键静态资源（App Shell）
 * 2. 运行时缓存 API 响应（stale-while-revalidate）
 * 3. 离线回退 — 不阻塞页面渲染
 *
 * 注意: 此 SW 仅做增强，不依赖它让应用首次工作（渐进增强策略）。
 */

const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `astralfox-app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `astralfox-runtime-${CACHE_VERSION}`;

// 预缓存的 App Shell 资源（关键 CSS/JS/Font 确保离线时页面可渲染）
const APP_SHELL_ASSETS = [
  '/',
  '/login',
  '/offline',
  '/images/logo.svg',
];

// ─── Install: 预缓存 App Shell ────────────────────────────────
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    }).catch(() => {
      // 预缓存失败不阻塞 SW 激活
    })
  );
  // 跳过等待，立即激活
  self.skipWaiting();
});

// ─── Activate: 清理旧缓存 ─────────────────────────────────────
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('astralfox-') && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // 立即接管所有页面
  self.clients.claim();
});

// ─── Fetch: 缓存策略 ──────────────────────────────────────────
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') return;

  // 跳过 Chrome DevTools / browser extensions
  if (url.protocol === 'chrome-extension:' || url.protocol === 'devtools:') return;

  // 跳过 API 轮询请求（不缓存实时数据）
  if (url.pathname.startsWith('/api/pet/chat/stream')) return;

  // API 请求: stale-while-revalidate（先返回缓存，后台更新）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 静态资源 & 页面: network-first（优先网络，回退缓存）
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(js|css|woff2?|png|jpe?g|svg|ico)$/)
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 导航请求（页面）: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
});

// ─── 缓存策略实现 ──────────────────────────────────────────────

/** Network-first: 优先网络，网络失败时回退缓存 */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    // 缓存成功的响应
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

/** Stale-while-revalidate: 先返回缓存，同时后台更新 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  // 后台更新（fire-and-forget）
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
    })
    .catch(() => {
      // 静默失败 — 下次请求会重试
    });

  // 有缓存立即返回
  if (cached) {
    return cached;
  }

  // 无缓存则等待网络
  try {
    const networkResponse = await fetchPromise;
    // fetchPromise 返回 undefined on catch，需要重新 fetch
    const response = await fetch(request);
    return response;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'You are offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Navigation: network-first with offline fallback page */
async function networkFirstWithOfflineFallback(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch {
    // 返回缓存的离线页面
    const cached = await caches.match('/offline');
    return cached || new Response(
      '<html><body><h1>You are offline</h1></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// ─── TypeScript declarations for Service Worker scope ──────────
declare var self: ServiceWorkerGlobalScope;

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<any>): void;
}

interface FetchEvent extends Event {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}
