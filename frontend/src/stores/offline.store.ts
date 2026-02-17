import { create } from 'zustand'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface OfflineState {
  isOffline: boolean
  syncStatus: SyncStatus
  pendingCount: number
  lastSyncAt: number | null
  syncError: string | null

  setOffline: (offline: boolean) => void
  setSyncStatus: (status: SyncStatus) => void
  setPendingCount: (count: number) => void
  setLastSyncAt: (ts: number) => void
  setSyncError: (error: string | null) => void
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  syncStatus: 'idle',
  pendingCount: 0,
  lastSyncAt: null,
  syncError: null,

  setOffline: (offline) => set({ isOffline: offline }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
  setSyncError: (error) => set({ syncError: error }),
}))

// Listen to online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useOfflineStore.getState().setOffline(false))
  window.addEventListener('offline', () => useOfflineStore.getState().setOffline(true))
}
