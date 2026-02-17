import { useState, useCallback, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Zap,
  ChevronDown,
  ShoppingCart,
  Truck,
  RotateCcw,
  Package,
  Wallet,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Lock,
  FileText,
  ClipboardList,
  Factory,
  TrendingUp,
  DollarSign,
  Coins,
  Tag,
  Gift,
  Calculator,
  MessageSquare,
  UserCheck,
  Shield,
  Bell,
  Activity,
  CheckCircle,
  Webhook,
  Link2,
  Boxes,
  Receipt,
  Monitor,
  Upload,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { cn } from '@/utils/cn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItemDef {
  key: string
  labelKey: string
  path: string
  icon: React.ReactNode
  disabled?: boolean
}

interface NavGroupDef {
  key: string
  labelKey: string
  items: NavItemDef[]
}

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

const NAV_GROUPS: NavGroupDef[] = [
  {
    key: 'orders',
    labelKey: 'nav.group.orders',
    items: [
      { key: 'orders', labelKey: 'nav.orders', path: '/orders', icon: <ShoppingCart className="h-4 w-4" /> },
      { key: 'shipping', labelKey: 'nav.shipping', path: '/shipping', icon: <Truck className="h-4 w-4" /> },
      { key: 'returns', labelKey: 'nav.returns', path: '/returns', icon: <RotateCcw className="h-4 w-4" /> },
    ],
  },
  {
    key: 'inventory',
    labelKey: 'nav.group.inventory',
    items: [
      { key: 'inventory', labelKey: 'nav.inventory', path: '/inventory', icon: <Package className="h-4 w-4" /> },
      { key: 'purchase-orders', labelKey: 'nav.purchaseOrders', path: '/purchase-orders', icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'suppliers', labelKey: 'nav.suppliers', path: '/suppliers', icon: <Factory className="h-4 w-4" /> },
      { key: 'stocktakes', labelKey: 'nav.stocktakes', path: '/stocktakes', icon: <Boxes className="h-4 w-4" /> },
      { key: 'sku-mappings', labelKey: 'nav.skuMappings', path: '/sku-mappings', icon: <Link2 className="h-4 w-4" /> },
      { key: 'forecasting', labelKey: 'nav.forecasting', path: '/forecasting', icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
  {
    key: 'finance',
    labelKey: 'nav.group.finance',
    items: [
      { key: 'wallet', labelKey: 'nav.wallet', path: '/wallet', icon: <Wallet className="h-4 w-4" /> },
      { key: 'commissions', labelKey: 'nav.commissions', path: '/commissions', icon: <BarChart3 className="h-4 w-4" /> },
      { key: 'pricing', labelKey: 'nav.pricing', path: '/pricing', icon: <DollarSign className="h-4 w-4" /> },
      { key: 'currency', labelKey: 'nav.currency', path: '/currency', icon: <Coins className="h-4 w-4" /> },
      { key: 'coupons', labelKey: 'nav.coupons', path: '/coupons', icon: <Tag className="h-4 w-4" /> },
      { key: 'promotions', labelKey: 'nav.promotions', path: '/promotions', icon: <Gift className="h-4 w-4" /> },
      { key: 'shipping-fees', labelKey: 'nav.shippingFees', path: '/shipping-fees', icon: <Calculator className="h-4 w-4" /> },
      { key: 'financial-reports', labelKey: 'nav.financialReports', path: '/financial-reports', icon: <FileText className="h-4 w-4" /> },
      { key: 'invoices', labelKey: 'nav.invoices', path: '/invoices', icon: <Receipt className="h-4 w-4" /> },
    ],
  },
  {
    key: 'crm',
    labelKey: 'nav.group.crm',
    items: [
      { key: 'customers', labelKey: 'nav.customers', path: '/customers', icon: <Users className="h-4 w-4" /> },
      { key: 'customer-segments', labelKey: 'nav.customerSegments', path: '/customer-segments', icon: <UserCheck className="h-4 w-4" /> },
      { key: 'communications', labelKey: 'nav.communications', path: '/communications', icon: <MessageSquare className="h-4 w-4" /> },
    ],
  },
  {
    key: 'analytics',
    labelKey: 'nav.group.analytics',
    items: [
      { key: 'reports', labelKey: 'nav.reports', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
      { key: 'data-screen', labelKey: 'nav.datascreen', path: '/data-screen', icon: <Monitor className="h-4 w-4" /> },
    ],
  },
  {
    key: 'system',
    labelKey: 'nav.group.system',
    items: [
      { key: 'settings', labelKey: 'nav.settings', path: '/settings', icon: <Settings className="h-4 w-4" /> },
      { key: 'distributors', labelKey: 'nav.distributors', path: '/distributors', icon: <Shield className="h-4 w-4" /> },
      { key: 'notifications', labelKey: 'nav.notifications', path: '/notifications', icon: <Bell className="h-4 w-4" /> },
      { key: 'audit', labelKey: 'nav.audit', path: '/audit', icon: <Activity className="h-4 w-4" /> },
      { key: 'automation', labelKey: 'nav.automation', path: '/automation', icon: <Zap className="h-4 w-4" /> },
      { key: 'approvals', labelKey: 'nav.approvals', path: '/approvals', icon: <CheckCircle className="h-4 w-4" /> },
      { key: 'webhooks', labelKey: 'nav.webhooks', path: '/webhooks', icon: <Webhook className="h-4 w-4" /> },
      { key: 'import', labelKey: 'nav.import', path: '/import', icon: <Upload className="h-4 w-4" /> },
      { key: 'batch', labelKey: 'nav.batch', path: '/batch', icon: <Layers className="h-4 w-4" /> },
      { key: 'platform-sync', labelKey: 'nav.platformSync', path: '/platform-sync', icon: <RefreshCw className="h-4 w-4" /> },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers — persist collapsed group state
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'erp_sidebar_collapsed'

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {
    // Ignore bad data
  }
  return new Set()
}

function saveCollapsedGroups(collapsed: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sidebarOpen, sidebarHidden, closeSidebar, toggleSidebar } = useUIStore()
  const { logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsedGroups)

  // Swipe to open/close sidebar on mobile (reactive to viewport changes)
  const isMobile = useIsMobile()
  useSwipeGesture({
    onSwipeRight: () => { if (!sidebarOpen) toggleSidebar() },
    onSwipeLeft: () => { if (sidebarOpen) closeSidebar() },
    enabled: isMobile,
  })

  // Persist collapsed state to localStorage on change
  useEffect(() => {
    saveCollapsedGroups(collapsed)
  }, [collapsed])

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  const handleNavClick = useCallback(() => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      closeSidebar()
    }
  }, [closeSidebar])

  const handleLogout = useCallback(() => {
    closeSidebar()
    logout()
  }, [closeSidebar, logout])

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-[250px] flex-col border-r border-border bg-bg-sidebar transition-transform duration-200 ease-in-out',
          // Desktop: always visible unless force-hidden
          sidebarHidden ? '' : 'md:translate-x-0',
          // Mobile: slide in/out
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo area */}
        <div className="flex h-[72px] flex-shrink-0 items-center gap-2.5 border-b border-border px-5">
          <button
            onClick={() => {
              navigate('/dashboard')
              handleNavClick()
            }}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-purple/20">
              <Zap className="h-5 w-5 text-accent-purple" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold leading-tight text-text-primary">
                KeepDF
              </span>
              <span className="text-[10px] leading-tight text-text-muted">
                Keep Data Flow
              </span>
            </div>
          </button>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {/* Dashboard link -- standalone, always visible */}
            <NavLink
              to="/dashboard"
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-purple/15 text-accent-purple'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary',
                )
              }
            >
              <BarChart3 className="h-4 w-4" />
              {t('nav.dashboard')}
            </NavLink>

            {/* Grouped navigation */}
            {NAV_GROUPS.map((group) => {
              const isCollapsed = collapsed.has(group.key)
              return (
                <div key={group.key} className="mt-3">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
                    aria-expanded={!isCollapsed}
                  >
                    {t(group.labelKey)}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        isCollapsed && '-rotate-90',
                      )}
                    />
                  </button>

                  {/* Group items */}
                  {!isCollapsed && (
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {group.items.map((item) =>
                        item.disabled ? (
                          <DisabledNavItem key={item.key} item={item} t={t} />
                        ) : (
                          <NavLink
                            key={item.key}
                            to={item.path}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                  ? 'bg-accent-purple/15 text-accent-purple'
                                  : 'text-text-secondary hover:bg-bg-card hover:text-text-primary',
                              )
                            }
                          >
                            {item.icon}
                            {t(item.labelKey)}
                          </NavLink>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </nav>

        {/* Logout button */}
        <div className="flex-shrink-0 border-t border-border p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-accent-red/10 hover:text-accent-red"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Disabled nav item (coming-soon)
// ---------------------------------------------------------------------------

interface DisabledNavItemProps {
  item: NavItemDef
  t: (key: string) => string
}

function DisabledNavItem({ item, t }: DisabledNavItemProps) {
  return (
    <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted opacity-50">
      {item.icon}
      <span className="flex-1">{t(item.labelKey)}</span>
      <Lock className="h-3 w-3" />
    </span>
  )
}
