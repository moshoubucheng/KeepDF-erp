import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Sun, Moon, User, LogOut, ChevronDown } from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { NotificationBell } from './NotificationBell'
import { LangSwitcher } from './LangSwitcher'

/** Maps route paths to i18n keys for the page title. */
const ROUTE_TITLE_MAP: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/orders': 'nav.orders',
  '/inventory': 'nav.inventory',
  '/shipping': 'nav.shipping',
  '/returns': 'nav.returns',
  '/customers': 'nav.customers',
  '/commissions': 'nav.commissions',
  '/wallet': 'nav.wallet',
  '/settings': 'nav.settings',
}

export function Header() {
  const { t } = useTranslation()
  const location = useLocation()
  const { toggleSidebar, theme, toggleTheme } = useUIStore()
  const { user, logout } = useAuthStore()

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Derive page title from route
  const titleKey = ROUTE_TITLE_MAP[location.pathname] ?? 'nav.dashboard'
  const pageTitle = t(titleKey)

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  // Close user menu on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    if (userMenuOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [userMenuOpen])

  return (
    <header className="flex h-[72px] flex-shrink-0 items-center justify-between border-b border-border bg-bg-secondary px-4 md:px-6">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">{pageTitle}</h1>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <NotificationBell />

        {/* Language switcher -- hidden on very small screens */}
        <div className="hidden sm:block">
          <LangSwitcher />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-bg-card"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple/20 text-accent-purple">
              <User className="h-4 w-4" />
            </div>
            <span className="hidden text-sm font-medium text-text-primary md:inline">
              {user?.name ?? 'User'}
            </span>
            <ChevronDown className="hidden h-4 w-4 text-text-muted md:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-text-primary">
                  {user?.name ?? 'User'}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {user?.email ?? user?.username ?? ''}
                </p>
                <span className="mt-1.5 inline-block rounded-full bg-accent-purple/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-purple">
                  {user?.role ?? 'user'}
                </span>
              </div>

              {/* Language switcher for mobile (shown only on small screens) */}
              <div className="border-b border-border px-4 py-2 sm:hidden">
                <LangSwitcher />
              </div>

              <div className="p-1.5">
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    logout()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent-red transition-colors hover:bg-accent-red/10"
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
