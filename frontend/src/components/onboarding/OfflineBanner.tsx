import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useOfflineStore } from '@/stores/offline.store'
import { syncPendingMutations } from '@/lib/offline-sync'

export function OfflineBanner() {
  const { t } = useTranslation()
  const { isOffline, syncStatus, pendingCount } = useOfflineStore()
  const [show, setShow] = useState(!navigator.onLine)

  useEffect(() => {
    if (isOffline) {
      setShow(true)
    } else if (syncStatus === 'idle' && pendingCount === 0) {
      // Delay hide for smooth transition
      const timer = setTimeout(() => setShow(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isOffline, syncStatus, pendingCount])

  // Show banner when syncing or has pending mutations
  const showSyncBar = !isOffline && (syncStatus === 'syncing' || syncStatus === 'synced' || syncStatus === 'error' || pendingCount > 0)

  if (!show && !showSyncBar) return null

  return (
    <div
      className={cn(
        'fixed top-0 inset-x-0 z-[60] transition-all duration-500',
        (isOffline || showSyncBar) ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
      )}
    >
      {isOffline ? (
        <div className="flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>{t('pwa.offline', 'You are offline. Some features may be limited.')}</span>
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {pendingCount} {t('pwa.pending', 'pending')}
            </span>
          )}
        </div>
      ) : syncStatus === 'syncing' ? (
        <div className="flex items-center justify-center gap-2 bg-blue-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
          <span>{t('pwa.syncing', 'Syncing offline changes...')}</span>
        </div>
      ) : syncStatus === 'synced' ? (
        <div className="flex items-center justify-center gap-2 bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{t('pwa.synced', 'All changes synced')}</span>
        </div>
      ) : syncStatus === 'error' ? (
        <div className="flex items-center justify-center gap-2 bg-red-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t('pwa.syncError', 'Sync failed')}</span>
          <button
            onClick={() => syncPendingMutations()}
            className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30 transition-colors"
          >
            {t('pwa.retry', 'Retry')}
          </button>
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>{pendingCount} {t('pwa.pendingChanges', 'changes waiting to sync')}</span>
          <button
            onClick={() => syncPendingMutations()}
            className="ml-2 rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30 transition-colors"
          >
            {t('pwa.syncNow', 'Sync now')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
