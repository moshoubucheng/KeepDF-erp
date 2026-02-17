import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, Download, RefreshCw, Truck, PackageCheck, XCircle } from 'lucide-react'
import { ordersApi } from '@/api/endpoints/orders'
import type { Order } from '@/api/types'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency, formatDate } from '@/utils/format'
import { PLATFORMS, ORDER_STATUSES } from '@/utils/constants'
import { downloadCsv } from '@/utils/download'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'
import { PlatformBadge } from '@/components/data/PlatformBadge'

export default function OrdersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)

  // Filters
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 300)
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Ship modal
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [shipOrderId, setShipOrderId] = useState<number | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['orders', { page, limit, platform, status, search }],
    queryFn: () => ordersApi.list({ offset: (page - 1) * limit, limit, platform: platform || undefined, status: status || undefined }),
  })

  const orders = data?.orders ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / limit)

  // Mutations
  const shipMutation = useMutation({
    mutationFn: ({ id, tracking }: { id: number; tracking: string }) => ordersApi.ship(id, tracking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      addToast('success', t('orders.shipSuccess', 'Order shipped successfully'))
      setShipModalOpen(false)
      setTrackingNumber('')
      setShipOrderId(null)
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('orders.shipError', 'Failed to ship order'))
    },
  })

  const deliverMutation = useMutation({
    mutationFn: (id: number) => ordersApi.deliver(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      addToast('success', t('orders.deliverSuccess', 'Order marked as delivered'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('orders.deliverError', 'Failed to deliver order'))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => ordersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      addToast('success', t('orders.cancelSuccess', 'Order cancelled'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('orders.cancelError', 'Failed to cancel order'))
    },
  })

  const [csvExporting, setCsvExporting] = useState(false)

  async function handleExportCsv() {
    setCsvExporting(true)
    try {
      const csv = await ordersApi.exportCsv({ platform: platform || undefined, status: status || undefined })
      if (csv) {
        downloadCsv(`orders_${new Date().toISOString().slice(0, 10)}.csv`, csv)
        addToast('success', t('orders.exportSuccess', 'CSV exported'))
      }
    } catch (err) {
      addToast('error', (err as Error).message || t('orders.exportError', 'Export failed'))
    } finally {
      setCsvExporting(false)
    }
  }

  function handleShipClick(orderId: number) {
    setShipOrderId(orderId)
    setTrackingNumber('')
    setShipModalOpen(true)
  }

  function handleShipConfirm() {
    if (!shipOrderId || !trackingNumber.trim()) return
    shipMutation.mutate({ id: shipOrderId, tracking: trackingNumber.trim() })
  }

  function handleDeliverClick(orderId: number) {
    if (window.confirm(t('orders.confirmDeliver', 'Mark this order as delivered?'))) {
      deliverMutation.mutate(orderId)
    }
  }

  function handleCancelClick(orderId: number) {
    if (window.confirm(t('orders.confirmCancel', 'Are you sure you want to cancel this order?'))) {
      cancelMutation.mutate(orderId)
    }
  }

  function handleSync() {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    addToast('info', t('orders.syncing', 'Refreshing orders...'))
  }

  // Reset page when filters change
  function handlePlatformChange(value: string) {
    setPlatform(value)
    resetPage()
  }

  function handleStatusChange(value: string) {
    setStatus(value)
    resetPage()
  }

  const columns = useMemo<Column<Order & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'platform',
        header: t('orders.platform', 'Platform'),
        render: (row) => <PlatformBadge platform={row.platform} />,
      },
      {
        key: 'platform_order_id',
        header: t('orders.orderNumber', 'Order #'),
        render: (row) => (
          <span className="font-mono text-xs text-text-secondary">{row.platform_order_id}</span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'status',
        header: t('orders.status', 'Status'),
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'total_amount',
        header: t('orders.amount', 'Amount'),
        render: (row) => (
          <span className="font-medium">{formatCurrency(row.total_amount, row.currency)}</span>
        ),
      },
      {
        key: 'tax_total',
        header: t('orders.tax', 'Tax'),
        render: (row) => (
          <span className="text-text-muted">{formatCurrency(row.tax_total, row.currency)}</span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'created_at',
        header: t('orders.date', 'Date'),
        render: (row) => <span className="text-text-muted text-xs">{formatDate(row.created_at)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'actions',
        header: t('common.actions', 'Actions'),
        render: (row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {row.status === 'PROCESSING' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleShipClick(row.id)}
                disabled={shipMutation.isPending}
              >
                <Truck size={14} />
                <span className="hidden sm:inline">{t('orders.ship', 'Ship')}</span>
              </Button>
            )}
            {row.status === 'SHIPPED' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleDeliverClick(row.id)}
                disabled={deliverMutation.isPending}
              >
                <PackageCheck size={14} />
                <span className="hidden sm:inline">{t('orders.deliver', 'Deliver')}</span>
              </Button>
            )}
            {(row.status === 'PENDING' || row.status === 'PROCESSING') && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleCancelClick(row.id)}
                disabled={cancelMutation.isPending}
              >
                <XCircle size={14} />
                <span className="hidden sm:inline">{t('orders.cancel', 'Cancel')}</span>
              </Button>
            )}
          </div>
        ),
      },
    ],
    [t, shipMutation.isPending, deliverMutation.isPending, cancelMutation.isPending],
  )

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          {t('orders.title', 'Orders')}
        </h1>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select value={platform} onChange={(e) => handlePlatformChange(e.target.value)}>
                <option value="">{t('orders.allPlatforms', 'All Platforms')}</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                <option value="">{t('orders.allStatuses', 'All Statuses')}</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="w-64">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder={t('orders.search', 'Search orders...')}
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); resetPage() }}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCsv}
                loading={csvExporting}
              >
                <Download size={14} />
                {t('orders.export', 'CSV')}
              </Button>
              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSync}
                >
                  <RefreshCw size={14} />
                  {t('orders.sync', 'Sync')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<Order & Record<string, unknown>>
            columns={columns}
            data={orders as (Order & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t('orders.empty', 'No orders found')}
            mobileCardView
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

      {/* Ship Modal */}
      <Modal
        open={shipModalOpen}
        onClose={() => { setShipModalOpen(false); setShipOrderId(null); setTrackingNumber('') }}
        title={t('orders.shipOrder', 'Ship Order')}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t('orders.shipPrompt', 'Enter the tracking number for order')} #{shipOrderId}
          </p>
          <Input
            label={t('orders.trackingNumber', 'Tracking Number')}
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. 1234567890"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => { setShipModalOpen(false); setShipOrderId(null); setTrackingNumber('') }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleShipConfirm}
              loading={shipMutation.isPending}
              disabled={!trackingNumber.trim()}
            >
              <Truck size={16} />
              {t('orders.confirmShip', 'Ship')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
