import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const STORAGE_KEY = 'erp_pwa_install_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(STORAGE_KEY) === '1') return

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Hide once installed
    const installedHandler = () => {
      setVisible(false)
      deferredPrompt.current = null
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    deferredPrompt.current = null
  }, [])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
    deferredPrompt.current = null
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 p-4 animate-[slideUp_0.3s_ease-out]"
      style={{ animationFillMode: 'forwards' }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-accent-purple/30 bg-bg-card p-4 shadow-2xl shadow-accent-purple/10 backdrop-blur-sm">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-purple to-accent-blue">
          <Download className="h-5 w-5 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">
            {t('pwa.install', 'Install App')}
          </p>
          <p className="text-xs text-text-muted truncate">
            KeepDF &mdash; Keep Data Flow
          </p>
        </div>

        {/* Install button */}
        <Button size="sm" onClick={handleInstall}>
          {t('pwa.install', 'Install')}
        </Button>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
