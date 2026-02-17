import { useTranslation } from 'react-i18next'
import {
  DollarSign,
  ShoppingCart,
  PackageCheck,
  Package,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { formatCurrency, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'

// ---------- Skeleton ----------

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-20 rounded bg-bg-input" />
          <div className="h-6 w-28 rounded bg-bg-input" />
          <div className="h-3 w-16 rounded bg-bg-input" />
        </div>
        <div className="ml-3 h-9 w-9 rounded-lg bg-bg-input" />
      </div>
    </div>
  )
}

// ---------- Enhanced Stat Card ----------

type AccentColor = 'purple' | 'blue' | 'emerald' | 'amber'

const ACCENT_STYLES: Record<AccentColor, { icon: string; glow: string; border: string }> = {
  purple: {
    icon: 'text-accent-purple bg-accent-purple-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
    border: 'hover:border-accent-purple/30',
  },
  blue: {
    icon: 'text-accent-blue bg-accent-blue-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
    border: 'hover:border-accent-blue/30',
  },
  emerald: {
    icon: 'text-accent-emerald bg-accent-emerald-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    border: 'hover:border-accent-emerald/30',
  },
  amber: {
    icon: 'text-accent-amber bg-accent-amber-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    border: 'hover:border-accent-amber/30',
  },
}

interface EnhancedStatCardProps {
  icon: React.ReactNode
  title: string
  value: string | number
  changePercent?: number | null
  accent?: AccentColor
}

function EnhancedStatCard({
  icon,
  title,
  value,
  changePercent,
  accent = 'purple',
}: EnhancedStatCardProps) {
  const { t } = useTranslation()
  const styles = ACCENT_STYLES[accent]
  const hasChange = changePercent != null && !isNaN(changePercent)
  const isPositive = hasChange && changePercent >= 0

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-card p-4',
        'transition-all duration-300 ease-out',
        styles.glow,
        styles.border,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {title}
          </p>
          <p className="mt-1.5 text-xl font-bold text-text-primary truncate">
            {value}
          </p>
          {hasChange ? (
            <div className="mt-1 flex items-center gap-1">
              {isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-accent-emerald" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  isPositive ? 'text-accent-emerald' : 'text-red-400',
                )}
              >
                {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
              </span>
              <span className="text-xs text-text-muted">
                {t('dashboard.vs_previous')}
              </span>
            </div>
          ) : (
            <div className="mt-1 h-4" />
          )}
        </div>
        <div
          className={cn(
            'ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            styles.icon,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// ---------- Types ----------

export interface ChangePercents {
  revenue: number | null
  orders: number | null
  active: number | null
  products: number | null
  commission: number | null
  balance: number | null
}

interface DashboardStatCardsProps {
  isLoading: boolean
  isAdmin: boolean
  overview?: {
    totalRevenue?: number
    totalOrders?: number
    pendingOrders?: number
    processingOrders?: number
    totalProducts?: number
    totalCommission?: number
  }
  walletData?: { balance?: number }
  changes: ChangePercents
}

// ---------- Main export ----------

export function DashboardStatCards({ isLoading, isAdmin, overview, walletData, changes }: DashboardStatCardsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {isLoading ? (
        <>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </>
      ) : isAdmin ? (
        <>
          <EnhancedStatCard
            icon={<DollarSign className="h-4.5 w-4.5" />}
            title={t('dashboard.total_revenue')}
            value={formatCurrency(overview?.totalRevenue ?? 0)}
            changePercent={changes.revenue}
            accent="purple"
          />
          <EnhancedStatCard
            icon={<ShoppingCart className="h-4.5 w-4.5" />}
            title={t('dashboard.total_orders')}
            value={formatNumber(overview?.totalOrders ?? 0)}
            changePercent={changes.orders}
            accent="blue"
          />
          <EnhancedStatCard
            icon={<PackageCheck className="h-4.5 w-4.5" />}
            title={t('dashboard.active_orders')}
            value={formatNumber((overview?.pendingOrders ?? 0) + (overview?.processingOrders ?? 0))}
            changePercent={changes.active}
            accent="emerald"
          />
          <EnhancedStatCard
            icon={<Package className="h-4.5 w-4.5" />}
            title={t('dashboard.products')}
            value={formatNumber(overview?.totalProducts ?? 0)}
            changePercent={changes.products}
            accent="amber"
          />
        </>
      ) : (
        <>
          <EnhancedStatCard
            icon={<DollarSign className="h-4.5 w-4.5" />}
            title={t('dashboard.my_revenue')}
            value={formatCurrency(overview?.totalRevenue ?? 0)}
            changePercent={changes.revenue}
            accent="purple"
          />
          <EnhancedStatCard
            icon={<ShoppingCart className="h-4.5 w-4.5" />}
            title={t('dashboard.my_orders')}
            value={formatNumber(overview?.totalOrders ?? 0)}
            changePercent={changes.orders}
            accent="blue"
          />
          <EnhancedStatCard
            icon={<TrendingUp className="h-4.5 w-4.5" />}
            title={t('dashboard.my_commission')}
            value={formatCurrency(overview?.totalCommission ?? 0)}
            changePercent={changes.commission}
            accent="emerald"
          />
          <EnhancedStatCard
            icon={<Wallet className="h-4.5 w-4.5" />}
            title={t('dashboard.my_balance')}
            value={formatCurrency(walletData?.balance ?? 0)}
            changePercent={changes.balance}
            accent="amber"
          />
        </>
      )}
    </div>
  )
}
