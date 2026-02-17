import { pushApi } from '@/api/endpoints/push'

/**
 * Browser-side push subscription management.
 */

/** Check if push notifications are supported */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Get current Notification permission */
export function getPermissionState(): NotificationPermission {
  if (!isPushSupported()) return 'denied'
  return Notification.permission
}

/** Request notification permission */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied'
  return Notification.requestPermission()
}

/** Get current push subscription */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Subscribe to push notifications */
export async function subscribePush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null

  // Request permission first
  const perm = await requestPermission()
  if (perm !== 'granted') return null

  // Get VAPID key from server
  const { publicKey } = await pushApi.getVapidKey()
  if (!publicKey) return null

  // Convert VAPID public key to ArrayBuffer
  const applicationServerKey = urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer

  // Subscribe via Push API
  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  })

  // Send subscription to server
  const subJson = subscription.toJSON()
  await pushApi.subscribe({
    endpoint: subJson.endpoint!,
    keys: {
      p256dh: subJson.keys!.p256dh!,
      auth: subJson.keys!.auth!,
    },
  })

  return subscription
}

/** Unsubscribe from push notifications */
export async function unsubscribePush(): Promise<boolean> {
  const subscription = await getCurrentSubscription()
  if (!subscription) return false

  // Unsubscribe from server
  await pushApi.unsubscribe(subscription.endpoint)

  // Unsubscribe from browser
  return subscription.unsubscribe()
}

// ── Utility ──

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
