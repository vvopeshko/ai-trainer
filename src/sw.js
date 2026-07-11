/* eslint-env serviceworker */
/**
 * Service worker PWA (vite-plugin-pwa strategies: 'injectManifest').
 *
 * Precache + runtime-кэши — те же, что были в generateSW-конфиге, плюс
 * Web Push: показ уведомления и клик с deep link'ом (только свой origin).
 * Регистрируется ТОЛЬКО на web-платформе (main.jsx) — Mini App без SW.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

// autoUpdate-поведение: новая версия активируется сразу
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA-навигация → app shell; API и лендинг мимо
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/landing/],
  }),
)

// GIF/картинки упражнений (внешние CDN) — кэшируем агрессивно
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// Google Fonts: css — SWR, шрифты — год
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-woff',
    plugins: [
      new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// ─── Web Push ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'AI Trainer', body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'AI Trainer', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'ai-trainer',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Только пути внутри своего origin — внешние URL из payload не открываем
  const raw = event.notification.data?.url || '/'
  const path = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  const target = new URL(path, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
