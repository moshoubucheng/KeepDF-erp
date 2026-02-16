import { useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function AppLayout() {
  const { t } = useTranslation()
  const { sidebarHidden, setSidebarHidden } = useUIStore()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showToggle, setShowToggle] = useState(false)

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      if (!fs) {
        setSidebarHidden(false)
        setShowToggle(false)
      }
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [setSidebarHidden])

  const handleToggleClick = useCallback(() => {
    setSidebarHidden(!sidebarHidden)
    setShowToggle(false)
  }, [sidebarHidden, setSidebarHidden])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar -- fixed 250px on desktop, overlay on mobile */}
      <Sidebar />

      {/* Fullscreen sidebar toggle: invisible hover zone + button */}
      {isFullscreen && (
        <>
          {/* Hover zone on left edge — always present, triggers button reveal */}
          <div
            className="fixed left-0 top-0 z-[60] h-full w-2 hidden md:block"
            onMouseEnter={() => setShowToggle(true)}
          />
          {/* Toggle button — appears on hover, hides after click or mouse leave */}
          <button
            onClick={handleToggleClick}
            onMouseLeave={() => setShowToggle(false)}
            className={cn(
              'fixed left-0 top-1/2 z-[61] -translate-y-1/2 rounded-r-lg border border-l-0 border-border bg-bg-card/90 p-1.5 text-text-muted backdrop-blur-sm transition-all hover:bg-bg-card hover:text-text-primary hidden md:block',
              showToggle ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none',
            )}
            title={sidebarHidden ? t('datascreen.show_sidebar') : t('datascreen.hide_sidebar')}
          >
            {sidebarHidden ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </>
      )}

      {/* Main content area -- offset by sidebar width on desktop */}
      <div className={cn(
        'flex flex-1 flex-col transition-[margin] duration-200',
        sidebarHidden ? 'md:ml-0' : 'md:ml-[250px]',
      )}>
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
