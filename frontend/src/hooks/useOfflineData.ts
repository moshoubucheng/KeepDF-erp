import { useEffect, useState, useCallback, useRef } from 'react'
import { getCachedData, setCachedData } from '@/lib/offline-db'
import { useOfflineStore } from '@/stores/offline.store'

type StoreName = 'dashboard' | 'orders' | 'inventory' | 'notifications'

interface UseOfflineDataOptions<T> {
  /** IndexedDB store name */
  store: StoreName
  /** Cache key within the store */
  key: string
  /** Fetch function to get fresh data */
  fetchFn: () => Promise<T>
  /** Auto-refetch interval in ms (0 = disabled) */
  refetchInterval?: number
  /** Enable/disable the query */
  enabled?: boolean
}

interface UseOfflineDataResult<T> {
  data: T | undefined
  isLoading: boolean
  isFromCache: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Stale-while-revalidate hook for offline data.
 * 1. Reads from IndexedDB cache first (instant)
 * 2. Fetches fresh data in background
 * 3. Updates IndexedDB cache with fresh data
 */
export function useOfflineData<T>({
  store,
  key,
  fetchFn,
  refetchInterval = 0,
  enabled = true,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const isOffline = useOfflineStore((s) => s.isOffline)
  const mountedRef = useRef(true)

  const fetchAndCache = useCallback(async () => {
    if (!enabled) return
    try {
      // 1. Load from cache first
      const cached = await getCachedData<T>(store, key)
      if (cached && mountedRef.current) {
        setData(cached)
        setIsFromCache(true)
        setIsLoading(false)
      }

      // 2. If online, fetch fresh data
      if (!isOffline) {
        const fresh = await fetchFn()
        if (mountedRef.current) {
          setData(fresh)
          setIsFromCache(false)
          setError(null)
          setIsLoading(false)
        }
        // 3. Update cache
        await setCachedData(store, key, fresh)
      } else if (!cached) {
        // Offline and no cache
        if (mountedRef.current) {
          setIsLoading(false)
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Fetch failed'))
        setIsLoading(false)
      }
    }
  }, [store, key, fetchFn, enabled, isOffline])

  useEffect(() => {
    mountedRef.current = true
    fetchAndCache()
    return () => { mountedRef.current = false }
  }, [fetchAndCache])

  // Auto-refetch interval
  useEffect(() => {
    if (!refetchInterval || refetchInterval <= 0 || !enabled || isOffline) return
    const timer = setInterval(fetchAndCache, refetchInterval)
    return () => clearInterval(timer)
  }, [refetchInterval, enabled, isOffline, fetchAndCache])

  // Re-fetch when coming back online
  const prevOfflineRef = useRef(isOffline)
  useEffect(() => {
    // Only refetch on transition from offline → online
    if (prevOfflineRef.current && !isOffline && enabled) {
      fetchAndCache()
    }
    prevOfflineRef.current = isOffline
  }, [isOffline, enabled, fetchAndCache])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    await fetchAndCache()
  }, [fetchAndCache])

  return { data, isLoading, isFromCache, error, refetch }
}
