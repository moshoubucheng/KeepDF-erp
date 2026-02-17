import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  getPermissionState,
  getCurrentSubscription,
  subscribePush,
  unsubscribePush,
} from '@/lib/push-notifications'
import { pushApi } from '@/api/endpoints/push'

interface UsePushNotificationsResult {
  /** Whether push is supported in this browser */
  supported: boolean
  /** Current permission state */
  permission: NotificationPermission
  /** Whether user is subscribed */
  isSubscribed: boolean
  /** Loading state */
  loading: boolean
  /** Subscribe to push notifications */
  subscribe: () => Promise<void>
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>
  /** Send a test push notification */
  testPush: () => Promise<{ sent: number; failed: number }>
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [supported] = useState(isPushSupported)
  const [permission, setPermission] = useState<NotificationPermission>(getPermissionState)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check current subscription state on mount
  useEffect(() => {
    if (!supported) {
      setLoading(false)
      return
    }

    getCurrentSubscription()
      .then((sub) => {
        setIsSubscribed(!!sub)
        setPermission(getPermissionState())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [supported])

  const subscribe = useCallback(async () => {
    setLoading(true)
    try {
      const sub = await subscribePush()
      setIsSubscribed(!!sub)
      setPermission(getPermissionState())
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      await unsubscribePush()
      setIsSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const testPush = useCallback(async () => {
    const result = await pushApi.testPush()
    return { sent: result.sent, failed: result.failed }
  }, [])

  return {
    supported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    testPush,
  }
}
