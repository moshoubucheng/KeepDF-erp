import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { dashboardApi } from '@/api/endpoints/dashboard'
import { formatCurrency } from '@/utils/format'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'
import {
  ShoppingCart,
  DollarSign,
  Truck,
  RotateCcw,
  Maximize,
  Minimize,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface TodayStats {
  todayOrders: number
  todayRevenue: number
  todayShipped: number
  todayReturns: number
}

interface RecentOrder {
  id: number
  platform: string
  platform_order_id: string
  status: string
  total_amount: number
  created_at: string
}

export default function DataScreenPage() {
  const { t } = useTranslation()
  const { addToast, sidebarHidden, setSidebarHidden } = useUIStore()

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<TodayStats>({
    todayOrders: 0,
    todayRevenue: 0,
    todayShipped: 0,
    todayReturns: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, ordersRes] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.recentOrders(),
      ])

      setStats({
        todayOrders: statsRes.overview.totalOrders,
        todayRevenue: statsRes.overview.totalRevenue,
        todayShipped: statsRes.overview.processingOrders,
        todayReturns: statsRes.overview.pendingOrders,
      })
      setRecentOrders((ordersRes.orders || []) as RecentOrder[])
      setLastUpdated(new Date().toLocaleTimeString())
    } catch {
      addToast('error', 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000) // Auto-refresh every 60s
    return () => clearInterval(interval)
  }, [fetchData])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      // Restore sidebar when exiting fullscreen
      if (!fs) setSidebarHidden(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [setSidebarHidden])

  const statCards = [
    {
      key: 'orders',
      label: t('datascreen.today_orders'),
      value: stats.todayOrders,
      icon: <ShoppingCart className="h-6 w-6" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/15',
    },
    {
      key: 'revenue',
      label: t('datascreen.today_revenue'),
      value: formatCurrency(stats.todayRevenue),
      icon: <DollarSign className="h-6 w-6" />,
      color: 'text-accent-emerald',
      bg: 'bg-emerald-500/15',
    },
    {
      key: 'shipped',
      label: t('datascreen.today_shipped'),
      value: stats.todayShipped,
      icon: <Truck className="h-6 w-6" />,
      color: 'text-accent-purple',
      bg: 'bg-purple-500/15',
    },
    {
      key: 'returns',
      label: t('datascreen.today_returns'),
      value: stats.todayReturns,
      icon: <RotateCcw className="h-6 w-6" />,
      color: 'text-accent-red',
      bg: 'bg-red-500/15',
    },
  ]

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-500/15 text-yellow-400',
    PROCESSING: 'bg-blue-500/15 text-blue-400',
    SHIPPED: 'bg-purple-500/15 text-accent-purple',
    DELIVERED: 'bg-emerald-500/15 text-accent-emerald',
    CANCELLED: 'bg-red-500/15 text-accent-red',
  }

  return (
    <div className="space-y-6">
      {/* Sidebar toggle -- only visible in fullscreen */}
      {isFullscreen && (
        <button
          onClick={() => setSidebarHidden(!sidebarHidden)}
          className="fixed left-0 top-1/2 z-[60] -translate-y-1/2 rounded-r-lg border border-l-0 border-border bg-bg-card/90 p-1.5 text-text-muted backdrop-blur-sm transition-colors hover:bg-bg-card hover:text-text-primary"
          title={sidebarHidden ? t('datascreen.show_sidebar') : t('datascreen.hide_sidebar')}
        >
          {sidebarHidden ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('datascreen.title')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('datascreen.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-text-muted">{lastUpdated}</span>
          )}
          <button
            onClick={fetchData}
            className={cn(
              'rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-card hover:text-text-primary',
              loading && 'animate-spin',
            )}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-card hover:text-text-primary"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-border/80"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('rounded-lg p-2', card.bg, card.color)}>
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary tabular-nums">
              {loading ? (
                <span className="inline-block h-7 w-20 animate-pulse rounded bg-bg-input" />
              ) : (
                card.value
              )}
            </p>
            <p className="text-xs text-text-muted mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Latest Orders */}
      <div className="rounded-xl border border-border bg-bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">{t('datascreen.latest_orders')}</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded bg-bg-input" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-muted">
              {t('dashboard.no_data')}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">ID</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('orders.platform')}</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted hidden md:table-cell">{t('orders.order_number')}</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('orders.status')}</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted text-right">{t('orders.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-bg-card-hover transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-text-muted">#{order.id}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-accent-purple/15 px-2 py-0.5 text-xs font-medium text-accent-purple">
                        {order.platform}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-text-secondary hidden md:table-cell">
                      {order.platform_order_id}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusColor[order.status] || 'bg-bg-input text-text-muted')}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-text-primary">
                      {formatCurrency(order.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
