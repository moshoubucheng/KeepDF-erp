import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search,
  BarChart3,
  ShoppingCart,
  Truck,
  RotateCcw,
  Package,
  ClipboardList,
  Factory,
  Boxes,
  Link2,
  TrendingUp,
  Wallet,
  DollarSign,
  Coins,
  Tag,
  Gift,
  Calculator,
  FileText,
  Receipt,
  Users,
  UserCheck,
  MessageSquare,
  Monitor,
  Settings,
  Shield,
  Bell,
  Activity,
  Zap,
  CheckCircle,
  Webhook,
  Sun,
  Moon,
  Maximize,
  RefreshCw,
  Command,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'
import { useKeyboardShortcuts, type ShortcutDef } from '@/hooks/useKeyboardShortcuts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  id: string
  labelKey: string
  category: 'navigation' | 'action'
  icon: LucideIcon
  shortcut?: string
  action: () => void
}

// ---------------------------------------------------------------------------
// Fuzzy match
// ---------------------------------------------------------------------------

function fuzzyMatch(search: string, target: string): boolean {
  const s = search.toLowerCase()
  const t = target.toLowerCase()
  let si = 0
  for (let ti = 0; ti < t.length && si < s.length; ti++) {
    if (t[ti] === s[si]) si++
  }
  return si === s.length
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function isMac(): boolean {
  return navigator.platform?.toUpperCase().includes('MAC') ?? false
}

function modKey(): string {
  return isMac() ? '\u2318' : 'Ctrl'
}

// ---------------------------------------------------------------------------
// ShortcutsHelp
// ---------------------------------------------------------------------------

interface ShortcutGroup {
  titleKey: string
  shortcuts: { keys: string; descKey: string }[]
}

function getShortcutGroups(): ShortcutGroup[] {
  const mod = modKey()
  return [
    {
      titleKey: 'cmd.group.global',
      shortcuts: [
        { keys: `${mod} + K`, descKey: 'cmd.open_palette' },
        { keys: `${mod} + /`, descKey: 'cmd.show_shortcuts' },
        { keys: 'Esc', descKey: 'cmd.close' },
      ],
    },
    {
      titleKey: 'cmd.group.navigation',
      shortcuts: [
        { keys: 'G  D', descKey: 'cmd.goto_dashboard' },
        { keys: 'G  O', descKey: 'cmd.goto_orders' },
        { keys: 'G  I', descKey: 'cmd.goto_inventory' },
        { keys: 'G  W', descKey: 'cmd.goto_wallet' },
        { keys: 'G  S', descKey: 'cmd.goto_settings' },
        { keys: 'G  R', descKey: 'cmd.goto_reports' },
      ],
    },
    {
      titleKey: 'cmd.group.actions',
      shortcuts: [
        { keys: `${mod} + T`, descKey: 'cmd.toggle_theme' },
        { keys: `${mod} + Shift + F`, descKey: 'cmd.toggle_fullscreen' },
      ],
    },
  ]
}

function ShortcutsHelp() {
  const { t } = useTranslation()
  const groups = useMemo(() => getShortcutGroups(), [])

  return (
    <div className="px-3 py-3">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        {t('cmd.shortcuts_title')}
      </h3>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.titleKey}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t(group.titleKey)}
            </h4>
            <div className="flex flex-col gap-1.5">
              {group.shortcuts.map((s) => (
                <div
                  key={s.descKey}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-text-secondary">{t(s.descKey)}</span>
                  <kbd className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-bg-input px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useUIStore()

  const [open, setOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // ------ Build command items ------
  const commandItems = useMemo<CommandItem[]>(() => {
    const nav = (id: string, labelKey: string, icon: LucideIcon, path: string, shortcut?: string): CommandItem => ({
      id,
      labelKey,
      category: 'navigation',
      icon,
      shortcut,
      action: () => navigate(path),
    })

    return [
      nav('dashboard', 'nav.dashboard', BarChart3, '/dashboard', 'G D'),
      nav('orders', 'nav.orders', ShoppingCart, '/orders', 'G O'),
      nav('shipping', 'nav.shipping', Truck, '/shipping'),
      nav('returns', 'nav.returns', RotateCcw, '/returns'),
      nav('inventory', 'nav.inventory', Package, '/inventory', 'G I'),
      nav('purchase-orders', 'nav.purchaseOrders', ClipboardList, '/purchase-orders'),
      nav('suppliers', 'nav.suppliers', Factory, '/suppliers'),
      nav('stocktakes', 'nav.stocktakes', Boxes, '/stocktakes'),
      nav('sku-mappings', 'nav.skuMappings', Link2, '/sku-mappings'),
      nav('forecasting', 'nav.forecasting', TrendingUp, '/forecasting'),
      nav('wallet', 'nav.wallet', Wallet, '/wallet', 'G W'),
      nav('commissions', 'nav.commissions', BarChart3, '/commissions'),
      nav('pricing', 'nav.pricing', DollarSign, '/pricing'),
      nav('currency', 'nav.currency', Coins, '/currency'),
      nav('coupons', 'nav.coupons', Tag, '/coupons'),
      nav('promotions', 'nav.promotions', Gift, '/promotions'),
      nav('shipping-fees', 'nav.shippingFees', Calculator, '/shipping-fees'),
      nav('financial-reports', 'nav.financialReports', FileText, '/financial-reports'),
      nav('invoices', 'nav.invoices', Receipt, '/invoices'),
      nav('customers', 'nav.customers', Users, '/customers'),
      nav('customer-segments', 'nav.customerSegments', UserCheck, '/customer-segments'),
      nav('communications', 'nav.communications', MessageSquare, '/communications'),
      nav('reports', 'nav.reports', BarChart3, '/reports', 'G R'),
      nav('data-screen', 'nav.datascreen', Monitor, '/data-screen'),
      nav('settings', 'nav.settings', Settings, '/settings', 'G S'),
      nav('distributors', 'nav.distributors', Shield, '/distributors'),
      nav('notifications', 'nav.notifications', Bell, '/notifications'),
      nav('audit', 'nav.audit', Activity, '/audit'),
      nav('automation', 'nav.automation', Zap, '/automation'),
      nav('approvals', 'nav.approvals', CheckCircle, '/approvals'),
      nav('webhooks', 'nav.webhooks', Webhook, '/webhooks'),
      {
        id: 'toggle-theme',
        labelKey: theme === 'dark' ? 'cmd.switch_light' : 'cmd.switch_dark',
        category: 'action',
        icon: theme === 'dark' ? Sun : Moon,
        shortcut: `${modKey()} + T`,
        action: () => toggleTheme(),
      },
      {
        id: 'toggle-fullscreen',
        labelKey: 'cmd.toggle_fullscreen',
        category: 'action',
        icon: Maximize,
        shortcut: `${modKey()} + Shift + F`,
        action: () => {
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            document.documentElement.requestFullscreen()
          }
        },
      },
      {
        id: 'refresh-data',
        labelKey: 'cmd.refresh_data',
        category: 'action',
        icon: RefreshCw,
        action: () => window.location.reload(),
      },
    ]
  }, [navigate, theme, toggleTheme])

  // ------ Filtered + grouped results ------
  const filteredItems = useMemo(() => {
    if (!query.trim()) return commandItems
    return commandItems.filter((item) => {
      const label = t(item.labelKey)
      return fuzzyMatch(query, label) || fuzzyMatch(query, item.id)
    })
  }, [commandItems, query, t])

  const navigationItems = useMemo(
    () => filteredItems.filter((i) => i.category === 'navigation'),
    [filteredItems],
  )
  const actionItems = useMemo(
    () => filteredItems.filter((i) => i.category === 'action'),
    [filteredItems],
  )

  const flatItems = useMemo(
    () => [...navigationItems, ...actionItems],
    [navigationItems, actionItems],
  )

  // ------ Open / close helpers ------
  const openPalette = useCallback(() => {
    setOpen(true)
    setShowHelp(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const openHelp = useCallback(() => {
    setOpen(true)
    setShowHelp(true)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setShowHelp(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const executeItem = useCallback(
    (item: CommandItem) => {
      closePalette()
      requestAnimationFrame(() => item.action())
    },
    [closePalette],
  )

  // ------ Keyboard shortcuts via hook ------
  const shortcuts = useMemo<ShortcutDef[]>(() => {
    const navShortcuts: ShortcutDef[] = [
      { sequence: ['g', 'd'], handler: () => navigate('/dashboard') },
      { sequence: ['g', 'o'], handler: () => navigate('/orders') },
      { sequence: ['g', 'i'], handler: () => navigate('/inventory') },
      { sequence: ['g', 'w'], handler: () => navigate('/wallet') },
      { sequence: ['g', 's'], handler: () => navigate('/settings') },
      { sequence: ['g', 'r'], handler: () => navigate('/reports') },
    ]

    return [
      { key: 'k', meta: true, handler: openPalette, allowInInput: true },
      { key: '/', meta: true, handler: openHelp, allowInInput: true },
      {
        key: 't',
        meta: true,
        handler: () => toggleTheme(),
        allowInInput: true,
      },
      {
        key: 'f',
        meta: true,
        shift: true,
        handler: () => {
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            document.documentElement.requestFullscreen()
          }
        },
        allowInInput: true,
      },
      ...navShortcuts,
    ]
  }, [navigate, openPalette, openHelp, toggleTheme])

  useKeyboardShortcuts(shortcuts)

  // ------ Focus input when palette opens ------
  useEffect(() => {
    if (open && !showHelp) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [open, showHelp])

  // ------ Lock body scroll ------
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  // ------ Keep selectedIndex in bounds ------
  useEffect(() => {
    if (!showHelp) {
      setSelectedIndex((prev) =>
        flatItems.length === 0 ? 0 : Math.min(prev, flatItems.length - 1),
      )
    }
  }, [flatItems.length, showHelp])

  // ------ Scroll selected item into view ------
  useEffect(() => {
    if (!open || showHelp) return
    const list = listRef.current
    if (!list) return
    const selected = list.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, open, showHelp])

  // ------ Internal keyboard handling ------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showHelp) {
          setShowHelp(false)
        } else {
          closePalette()
        }
        return
      }

      if (showHelp) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatItems[selectedIndex]
        if (item) executeItem(item)
      }
    },
    [flatItems, selectedIndex, showHelp, closePalette, executeItem],
  )

  // ------ Backdrop click ------
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) closePalette()
    },
    [closePalette],
  )

  if (!open) return null

  const navCount = navigationItems.length

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-[fadeIn_100ms_ease-out]"
    >
      <div className="relative w-full max-w-xl mx-4 overflow-hidden rounded-xl border border-border bg-bg-card shadow-2xl animate-[scaleIn_100ms_ease-out]">
        {/* Search header */}
        {!showHelp && (
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              placeholder={t('cmd.search_placeholder')}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center rounded-md border border-border bg-bg-input px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
              Esc
            </kbd>
          </div>
        )}

        {/* Help header */}
        {showHelp && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Command className="h-5 w-5 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">
                {t('cmd.shortcuts_title')}
              </span>
            </div>
            <kbd className="inline-flex items-center rounded-md border border-border bg-bg-input px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
              Esc
            </kbd>
          </div>
        )}

        {/* Content area */}
        {showHelp ? (
          <div className="max-h-[60vh] overflow-y-auto">
            <ShortcutsHelp />
          </div>
        ) : (
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
            {flatItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                {t('cmd.no_results')}
              </div>
            )}

            {navigationItems.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t('cmd.group.navigation')}
                </div>
                {navigationItems.map((item, i) => (
                  <CommandItemRow
                    key={item.id}
                    item={item}
                    selected={selectedIndex === i}
                    onSelect={() => executeItem(item)}
                    onHover={() => setSelectedIndex(i)}
                    t={t}
                  />
                ))}
              </div>
            )}

            {actionItems.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t('cmd.group.actions')}
                </div>
                {actionItems.map((item, i) => (
                  <CommandItemRow
                    key={item.id}
                    item={item}
                    selected={selectedIndex === navCount + i}
                    onSelect={() => executeItem(item)}
                    onHover={() => setSelectedIndex(navCount + i)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer hints */}
        {!showHelp && (
          <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-text-muted">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              <ArrowDown className="h-3 w-3" />
              {t('cmd.hint_navigate')}
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" />
              {t('cmd.hint_select')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border px-1 font-mono text-[10px]">{modKey()} + /</kbd>
              {t('cmd.hint_shortcuts')}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Single command item row
// ---------------------------------------------------------------------------

interface CommandItemRowProps {
  item: CommandItem
  selected: boolean
  onSelect: () => void
  onHover: () => void
  t: (key: string) => string
}

function CommandItemRow({ item, selected, onSelect, onHover, t }: CommandItemRowProps) {
  const Icon = item.icon
  return (
    <button
      data-selected={selected}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer',
        selected
          ? 'bg-accent-purple/15 text-accent-purple'
          : 'text-text-secondary hover:bg-bg-input hover:text-text-primary',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{t(item.labelKey)}</span>
      {item.shortcut && (
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border bg-bg-input px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
          {item.shortcut}
        </kbd>
      )}
    </button>
  )
}
