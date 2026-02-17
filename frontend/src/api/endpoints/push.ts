import { api } from '../client'

export const pushApi = {
  /** Get VAPID public key (no auth required) */
  getVapidKey: () => api.get<{ publicKey: string }>('/push/vapid-key'),

  /** Register a push subscription */
  subscribe: (subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }) => api.post<{ success: boolean }>('/push/subscribe', subscription),

  /** Unsubscribe from push */
  unsubscribe: (endpoint: string) =>
    api.post<{ success: boolean }>('/push/unsubscribe', { endpoint }),

  /** Send a test push notification */
  testPush: () =>
    api.post<{ success: boolean; sent: number; failed: number }>('/push/test'),
}
