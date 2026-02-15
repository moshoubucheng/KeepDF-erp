import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'
import { cn } from '@/utils/cn'

export function OfflineBanner() {
  const { t } = useTranslation()
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [show, setShow] = useState(!navigator.onLine)

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>

    const goOffline = () => {
      clearTimeout(hideTimer)
      setIsOffline(true)
      setShow(true)
    }

    const goOnline = () => {
      setIsOffline(false)
      // Delay hide for a smooth transition
      hideTimer = setTimeout(() => setShow(false), 1500)
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      clearTimeout(hideTimer)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!show) return null

  return (
    <div
      className={cn(
        'fixed top-0 inset-x-0 z-[9999] transition-all duration-500',
        isOffline
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0',
      )}
    >
      <div className="flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>{t('pwa.offline', 'You are offline. Some features may be limited.')}</span>
      </div>
    </div>
  )
}
