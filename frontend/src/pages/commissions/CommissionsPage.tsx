import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Percent, Receipt } from 'lucide-react'
import { commissionsApi } from '@/api/endpoints/commissions'
import type { Commission, CommissionSettlement } from '@/api/types'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'
import { PlatformBadge } from '@/components/data/PlatformBadge'
import { Pagination } from '@/components/ui/Pagination'
import { formatCurrency, formatDate, formatPercent } from '@/utils/format'
import { usePagination } from '@/hooks/usePagination'

const SETTLEMENT_STATUSES = ['', 'PENDING', 'SETTLED', 'FAILED'] as const

export default function CommissionsPage() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState('')
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Commission rates query
  const ratesQuery = useQuery({
    queryKey: ['commissions', 'rates'],
    queryFn: () => commissionsApi.rates(),
  })

  // Settlements query
  const settlementsQuery = useQuery({
    queryKey: ['commissions', 'history', { page, limit, status: statusFilter }],
    queryFn: () =>
      commissionsApi.history({
        offset: (page - 1) * limit,
        limit,
        status: statusFilter || undefined,
      }),
  })

  const rates = ratesQuery.data?.rates ?? []
  const settlements = settlementsQuery.data?.settlements ?? []
  const total = settlementsQuery.data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const rateColumns: Column<Commission>[] = [
    {
      key: 'sku',
      header: t('commissions.sku', 'SKU'),
      render: (row) => (
        <span className="font-mono text-xs text-text-primary">{row.sku}</span>
      ),
    },
    {
      key: 'platform',
      header: t('commissions.platform', 'Platform'),
      render: (row) => <PlatformBadge platform={row.platform} />,
    },
    {
      key: 'rate',
      header: t('commissions.rate', 'Rate'),
      render: (row) => (
        <span className="font-semibold text-accent-purple">
          {formatPercent(row.rate)}
        </span>
      ),
    },
  ]

  const settlementColumns: Column<CommissionSettlement>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (row) => (
        <span className="font-mono text-xs text-text-muted">#{row.id}</span>
      ),
    },
    {
      key: 'order_id',
      header: t('commissions.orderId', 'Order ID'),
      render: (row) => (
        <span className="font-mono text-xs">#{row.order_id}</span>
      ),
    },
    {
      key: 'sku',
      header: t('commissions.sku', 'SKU'),
      render: (row) => (
        <span className="font-mono text-xs">{row.sku}</span>
      ),
    },
    {
      key: 'platform',
      header: t('commissions.platform', 'Platform'),
      render: (row) => <PlatformBadge platform={row.platform} />,
      hideOnMobile: true,
    },
    {
      key: 'qty',
      header: t('commissions.qty', 'Qty'),
      render: (row) => <span>{row.qty}</span>,
      hideOnMobile: true,
    },
    {
      key: 'unit_price',
      header: t('commissions.unitPrice', 'Unit Price'),
      render: (row) => (
        <span className="tabular-nums">{formatCurrency(row.unit_price)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'commission_amount',
      header: t('commissions.amount', 'Commission'),
      render: (row) => (
        <span className="font-semibold text-accent-emerald tabular-nums">
          {formatCurrency(row.commission_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('commissions.status', 'Status'),
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: t('commissions.date', 'Date'),
      render: (row) => (
        <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>
      ),
      hideOnMobile: true,
    },
  ]

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setStatusFilter(e.target.value)
    resetPage()
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('commissions.title', 'Commissions')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('commissions.subtitle', 'Commission rates and settlement history')}
        </p>
      </div>

      {/* Commission Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Percent size={18} className="text-accent-purple" />
            <h3 className="text-text-primary font-semibold text-base">
              {t('commissions.rates', 'Commission Rates')}
            </h3>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={rateColumns}
            data={rates}
            loading={ratesQuery.isLoading}
            emptyMessage={t('commissions.noRates', 'No commission rates configured')}
          />
        </CardContent>
      </Card>

      {/* Settlement History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-accent-emerald" />
              <h3 className="text-text-primary font-semibold text-base">
                {t('commissions.settlements', 'Settlement History')}
              </h3>
            </div>
            <div className="w-40">
              <Select value={statusFilter} onChange={handleStatusChange}>
                <option value="">{t('common.allStatuses', 'All Statuses')}</option>
                {SETTLEMENT_STATUSES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={settlementColumns}
            data={settlements}
            loading={settlementsQuery.isLoading}
            emptyMessage={t('commissions.noSettlements', 'No settlements found')}
          />
        </CardContent>
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border">
            <Pagination
              page={page}
              pages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
