import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart3, ShoppingCart, Package, Bell, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/utils/cn'
import { BottomSheet } from '@/components/ui/BottomSheet'

interface NavItem {
  path: string
  labelKey: string
  icon: React.ReactNode
  badge?: number
}

interface BottomNavProps {
  unreadCount?: number
}

export function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)

  const items: NavItem[] = [
    { path: '/dashboard', labelKey: 'nav.dashboard', icon: <BarChart3 className="h-5 w-5" /> },
    { path: '/orders', labelKey: 'nav.orders', icon: <ShoppingCart className="h-5 w-5" /> },
    { path: '/inventory', labelKey: 'nav.inventory', icon: <Package className="h-5 w-5" /> },
    { path: '/notifications', labelKey: 'nav.notifications', icon: <Bell className="h-5 w-5" />, badge: unreadCount },
  ]

  const moreItems = [
    { path: '/shipping', labelKey: 'nav.shipping' },
    { path: '/customers', labelKey: 'nav.customers' },
    { path: '/wallet', labelKey: 'nav.wallet' },
    { path: '/commissions', labelKey: 'nav.commissions' },
    { path: '/reports', labelKey: 'nav.reports' },
    { path: '/settings', labelKey: 'nav.settings' },
  ]

  return (
    <>
      {/* Bottom navigation bar — visible only on mobile */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-bg-sidebar/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-14 items-center justify-around px-2">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors',
                  isActive ? 'text-accent-purple' : 'text-text-muted',
                )
              }
            >
              <span className="relative">
                {item.icon}
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-0.5 text-[9px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors',
              showMore ? 'text-accent-purple' : 'text-text-muted',
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{t('nav.more', 'More')}</span>
          </button>
        </div>
      </nav>

      {/* More menu bottom sheet */}
      <BottomSheet
        open={showMore}
        onClose={() => setShowMore(false)}
        title={t('nav.more', 'More')}
      >
        <div className="grid grid-cols-3 gap-3 pb-4">
          {moreItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setShowMore(false)}
              className="flex flex-col items-center gap-1.5 rounded-lg p-3 text-center text-text-secondary hover:bg-bg-card-hover transition-colors"
            >
              <span className="text-sm font-medium">{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}
