/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

// Precache static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// API caching: NetworkFirst with 1hr expiration
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 3600,
      }),
    ],
    networkTimeoutSeconds: 5,
  }),
)

// ── Push Notification Handler ──
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: { title: string; body: string; icon?: string; url?: string; tag?: string }
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'KeepDF ERP', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: payload.tag || 'keepdf-notification',
      data: { url: payload.url || '/' },
    }),
  )
})

// ── Notification Click Handler ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url)
    }),
  )
})

// ── Skip waiting on install ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
