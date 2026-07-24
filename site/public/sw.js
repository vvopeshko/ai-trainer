// Kill-switch service worker.
//
// До переезда на app.gymwithai.me аппка регистрировала на этом origin SW
// с precache (vite-plugin-pwa, scope '/'). Установленные PWA offline-first
// отдавали бы закэшированный app shell вечно. Браузер проверяет /sw.js по
// сети при каждой навигации — этот воркер встаёт на место старого,
// сносит кэши, разрегистрируется и перезагружает открытые окна.
//
// Файл должен жить по этому пути минимум несколько месяцев после переезда.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((client) => client.navigate(client.url))
    })()
  )
})
