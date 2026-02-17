import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/data/StatusBadge'
import { PlatformBadge } from '@/components/data/PlatformBadge'
import { formatCurrency, formatDate } from '@/utils/format'

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 w-12 rounded bg-bg-input" />
          <div className="h-4 w-20 rounded bg-bg-input" />
          <div className="h-4 flex-1 rounded bg-bg-input" />
          <div className="h-4 w-16 rounded bg-bg-input" />
          <div className="h-4 w-24 rounded bg-bg-input" />
        </div>
      ))}
    </div>
  )
}

interface Order {
  id: number
  platform: string
  platform_order_id: string
  status: string
  total_amount: number
  currency?: string
  created_at: string
}

interface RecentOrdersTableProps {
  orders: Order[]
  isLoading: boolean
}

export function RecentOrdersTable({ orders, isLoading }: RecentOrdersTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t('dashboard.recent_orders')}
        </h3>
        <button
          onClick={() => navigate('/orders')}
          className="text-xs font-medium text-accent-purple hover:underline"
        >
          {t('dashboard.view_all')}
        </button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <TableSkeleton />
        ) : orders.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-sm text-text-muted">
            {t('dashboard.no_data')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                  <th className="px-6 py-2.5">{t('orders.id')}</th>
                  <th className="px-6 py-2.5">{t('orders.platform')}</th>
                  <th className="px-6 py-2.5">{t('orders.order_number')}</th>
                  <th className="px-6 py-2.5">{t('orders.status')}</th>
                  <th className="px-6 py-2.5 text-right">{t('orders.amount')}</th>
                  <th className="px-6 py-2.5 text-right">{t('orders.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="text-text-secondary transition-colors hover:bg-bg-card-hover"
                  >
                    <td className="whitespace-nowrap px-6 py-2.5 font-mono text-xs text-text-muted">
                      #{order.id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5">
                      <PlatformBadge platform={order.platform} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5 font-mono text-xs">
                      {order.platform_order_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5 text-right font-medium text-text-primary">
                      {formatCurrency(order.total_amount, order.currency)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-2.5 text-right text-xs text-text-muted">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
