import { getPendingMutations, removePendingMutation, updateMutationRetry, getPendingCount } from './offline-db'
import { useOfflineStore } from '@/stores/offline.store'

const MAX_RETRIES = 3
let resetTimerId: ReturnType<typeof setTimeout> | null = null
let autoSyncRegistered = false

/**
 * Process queued offline mutations when back online.
 * Executes in FIFO order (oldest first).
 */
export async function syncPendingMutations(): Promise<{ synced: number; failed: number }> {
  const store = useOfflineStore.getState()
  store.setSyncStatus('syncing')
  store.setSyncError(null)

  // Clear any pending reset timer
  if (resetTimerId !== null) {
    clearTimeout(resetTimerId)
    resetTimerId = null
  }

  let synced = 0
  let failed = 0

  try {
    const mutations = await getPendingMutations()

    for (const mutation of mutations) {
      if (mutation.retries >= MAX_RETRIES) {
        // Too many retries — remove and count as failed
        await removePendingMutation(mutation.id!)
        failed++
        continue
      }

      try {
        const token = localStorage.getItem('erp_token')
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers,
          body: mutation.body,
        })

        if (response.ok) {
          await removePendingMutation(mutation.id!)
          synced++
        } else if (response.status >= 500 || response.status === 429) {
          // Server error or rate-limited — retry later
          await updateMutationRetry(mutation.id!)
          failed++
        } else {
          // Client error (4xx except 429) — remove, no point retrying
          await removePendingMutation(mutation.id!)
          failed++
        }
      } catch {
        // Network error — retry later
        await updateMutationRetry(mutation.id!)
        failed++
      }
    }

    const remaining = await getPendingCount()
    store.setPendingCount(remaining)
    store.setLastSyncAt(Date.now())
    store.setSyncStatus(failed > 0 && synced === 0 ? 'error' : 'synced')

    // Reset to idle after a short delay
    resetTimerId = setTimeout(() => {
      if (useOfflineStore.getState().syncStatus === 'synced') {
        useOfflineStore.getState().setSyncStatus('idle')
      }
      resetTimerId = null
    }, 3000)
  } catch (err) {
    store.setSyncStatus('error')
    store.setSyncError(err instanceof Error ? err.message : 'Sync failed')
  }

  return { synced, failed }
}

/** Auto-sync when coming back online (registers only once) */
export function setupAutoSync() {
  if (typeof window === 'undefined' || autoSyncRegistered) return
  autoSyncRegistered = true

  window.addEventListener('online', () => {
    // Short delay to let network stabilize
    setTimeout(() => syncPendingMutations(), 1000)
  })
}
