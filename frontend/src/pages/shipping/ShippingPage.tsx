import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, Plus, MapPin, Clock } from 'lucide-react'
import { shippingApi } from '@/api/endpoints/shipping'
import type { Shipment, ShipmentEvent } from '@/api/types'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { SHIPMENT_STATUSES, CARRIERS, STATUS_COLORS } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

export default function ShippingPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)

  // Filters
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Timeline modal
  const [timelineModalOpen, setTimelineModalOpen] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)

  // Create shipment modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    order_id: '',
    tracking_number: '',
    carrier: '' as string,
    estimated_delivery: '',
  })

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['shipping', { page, limit, status }],
    queryFn: () => shippingApi.list({ offset: (page - 1) * limit, limit, status: status || undefined }),
  })

  const shipments = data?.shipments ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  // Timeline query
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['shipping-timeline', selectedShipment?.id],
    queryFn: () => shippingApi.timeline(selectedShipment!.id),
    enabled: !!selectedShipment && timelineModalOpen,
  })

  const timelineEvents: ShipmentEvent[] = timelineData?.events ?? []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { order_id: number; tracking_number: string; carrier: string; estimated_delivery?: string }) =>
      shippingApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping'] })
      addToast('success', t('shipping.createSuccess', 'Shipment created successfully'))
      setCreateModalOpen(false)
      setCreateForm({ order_id: '', tracking_number: '', carrier: '', estimated_delivery: '' })
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('shipping.createError', 'Failed to create shipment'))
    },
  })

  function handleRowClick(shipment: Shipment) {
    setSelectedShipment(shipment)
    setTimelineModalOpen(true)
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const orderId = parseInt(createForm.order_id, 10)
    if (!orderId || !createForm.tracking_number.trim() || !createForm.carrier) return

    createMutation.mutate({
      order_id: orderId,
      tracking_number: createForm.tracking_number.trim(),
      carrier: createForm.carrier,
      estimated_delivery: createForm.estimated_delivery || undefined,
    })
  }

  function handleStatusChange(value: string) {
    setStatus(value)
    resetPage()
  }

  // Filter by search locally (tracking number or order ID)
  const filteredShipments = useMemo(() => {
    if (!searchInput.trim()) return shipments
    const q = searchInput.toLowerCase()
    return shipments.filter(
      (s) =>
        s.tracking_number.toLowerCase().includes(q) ||
        String(s.order_id).includes(q) ||
        s.carrier.toLowerCase().includes(q),
    )
  }, [shipments, searchInput])

  const columns = useMemo<Column<Shipment & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'order_id',
        header: t('shipping.orderId', 'Order ID'),
        render: (row) => <span className="font-mono text-xs">#{row.order_id}</span>,
      },
      {
        key: 'tracking_number',
        header: t('shipping.trackingNumber', 'Tracking #'),
        render: (row) => (
          <span className="font-mono text-xs text-accent-blue">{row.tracking_number}</span>
        ),
      },
      {
        key: 'carrier',
        header: t('shipping.carrier', 'Carrier'),
        render: (row) => (
          <span className="text-sm text-text-secondary">{row.carrier}</span>
        ),
      },
      {
        key: 'status',
        header: t('shipping.status', 'Status'),
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'shipped_at',
        header: t('shipping.shippedAt', 'Shipped At'),
        render: (row) => (
          <span className="text-text-muted text-xs">{formatDate(row.shipped_at)}</span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'estimated_delivery',
        header: t('shipping.estimatedDelivery', 'Est. Delivery'),
        render: (row) => (
          <span className="text-text-muted text-xs">
            {row.estimated_delivery ? formatDate(row.estimated_delivery) : '-'}
          </span>
        ),
        hideOnMobile: true,
      },
    ],
    [t],
  )

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          {t('shipping.title', 'Shipping')}
        </h1>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} />
          {t('shipping.create', 'Create Shipment')}
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                <option value="">{t('shipping.allStatuses', 'All Statuses')}</option>
                {SHIPMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="w-64">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder={t('shipping.search', 'Search tracking # or order ID...')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<Shipment & Record<string, unknown>>
            columns={columns}
            data={filteredShipments as (Shipment & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t('shipping.empty', 'No shipments found')}
            mobileCardView
            onRowClick={(row) => handleRowClick(row as unknown as Shipment)}
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

      {/* Timeline Modal */}
      <Modal
        open={timelineModalOpen}
        onClose={() => { setTimelineModalOpen(false); setSelectedShipment(null) }}
        title={
          selectedShipment
            ? `${t('shipping.timeline', 'Shipment Timeline')} - ${selectedShipment.tracking_number}`
            : t('shipping.timeline', 'Shipment Timeline')
        }
        className="max-w-xl"
      >
        {selectedShipment && (
          <div className="space-y-4">
            {/* Shipment summary */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-text-muted">{t('shipping.carrier', 'Carrier')}:</span>{' '}
                <span className="text-text-primary font-medium">{selectedShipment.carrier}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('shipping.status', 'Status')}:</span>{' '}
                <StatusBadge status={selectedShipment.status} />
              </div>
              <div>
                <span className="text-text-muted">{t('shipping.orderId', 'Order')}:</span>{' '}
                <span className="text-text-primary font-mono">#{selectedShipment.order_id}</span>
              </div>
            </div>

            {/* Timeline */}
            {timelineLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-sm">
                {t('shipping.noEvents', 'No tracking events yet')}
              </div>
            ) : (
              <div className="relative ml-3 border-l-2 border-border pl-6 space-y-6 py-2">
                {timelineEvents.map((event, idx) => {
                  const colorClass = STATUS_COLORS[event.status] ?? 'bg-gray-500/15 text-gray-400'
                  const isFirst = idx === 0

                  return (
                    <div key={event.id} className="relative">
                      {/* Dot on timeline */}
                      <div
                        className={cn(
                          'absolute -left-[31px] top-0.5 h-4 w-4 rounded-full border-2 border-bg-card',
                          isFirst
                            ? 'bg-accent-purple'
                            : 'bg-border',
                        )}
                      />

                      <div className="space-y-1">
                        {/* Status badge + time */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              colorClass,
                            )}
                          >
                            {event.status}
                          </span>
                          <span className="text-xs text-text-muted flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(event.event_time)}
                          </span>
                        </div>

                        {/* Location */}
                        {event.location && (
                          <div className="flex items-center gap-1 text-xs text-text-secondary">
                            <MapPin size={12} />
                            {event.location}
                          </div>
                        )}

                        {/* Description */}
                        {event.description && (
                          <p className="text-sm text-text-secondary">{event.description}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Shipment Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false)
          setCreateForm({ order_id: '', tracking_number: '', carrier: '', estimated_delivery: '' })
        }}
        title={t('shipping.createShipment', 'Create Shipment')}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label={t('shipping.orderId', 'Order ID')}
            type="number"
            value={createForm.order_id}
            onChange={(e) => setCreateForm((f) => ({ ...f, order_id: e.target.value }))}
            placeholder="e.g. 1"
            required
          />
          <Input
            label={t('shipping.trackingNumber', 'Tracking Number')}
            value={createForm.tracking_number}
            onChange={(e) => setCreateForm((f) => ({ ...f, tracking_number: e.target.value }))}
            placeholder="e.g. 1234567890"
            required
          />
          <Select
            label={t('shipping.carrier', 'Carrier')}
            value={createForm.carrier}
            onChange={(e) => setCreateForm((f) => ({ ...f, carrier: e.target.value }))}
            required
          >
            <option value="">{t('shipping.selectCarrier', 'Select a carrier...')}</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Input
            label={t('shipping.estimatedDelivery', 'Estimated Delivery')}
            type="date"
            value={createForm.estimated_delivery}
            onChange={(e) => setCreateForm((f) => ({ ...f, estimated_delivery: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreateModalOpen(false)
                setCreateForm({ order_id: '', tracking_number: '', carrier: '', estimated_delivery: '' })
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={!createForm.order_id || !createForm.tracking_number.trim() || !createForm.carrier}
            >
              <Plus size={16} />
              {t('shipping.create', 'Create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
