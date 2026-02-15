import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { promotionsApi } from '@/api/endpoints/promotions'
import type { Promotion } from '@/api/endpoints/promotions'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency, formatDate } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

const PROMOTION_TYPES = ['PERCENTAGE', 'FIXED', 'BUY_X_GET_Y', 'FREE_SHIPPING'] as const
const STATUS_OPTIONS = ['active', 'expired', 'upcoming'] as const

const initialForm = {
  name: '',
  type: 'PERCENTAGE' as string,
  discount_value: '',
  buy_quantity: '',
  get_quantity: '',
  min_order_amount: '',
  min_quantity: '',
  start_date: '',
  end_date: '',
  max_uses: '',
  priority: '0',
}

export default function PromotionsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(initialForm)

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['promotions', { page, limit, status: statusFilter }],
    queryFn: () => promotionsApi.list({ offset: (page - 1) * limit, limit, status: statusFilter || undefined }),
  })

  const promotions = data?.promotions ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => promotionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      addToast('success', t('promotions.createSuccess', 'Promotion created successfully'))
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('promotions.createError', 'Failed to create promotion'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => promotionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      addToast('success', t('promotions.updateSuccess', 'Promotion updated successfully'))
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('promotions.updateError', 'Failed to update promotion'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => promotionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      addToast('success', t('promotions.deleteSuccess', 'Promotion deleted'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('promotions.deleteError', 'Failed to delete promotion'))
    },
  })

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(initialForm)
  }

  function handleCreate() {
    setEditingId(null)
    setForm(initialForm)
    setModalOpen(true)
  }

  function handleEdit(promo: Promotion) {
    setEditingId(promo.id)
    setForm({
      name: promo.name,
      type: promo.type,
      discount_value: String(promo.discount_value),
      buy_quantity: promo.buy_quantity != null ? String(promo.buy_quantity) : '',
      get_quantity: promo.get_quantity != null ? String(promo.get_quantity) : '',
      min_order_amount: String(promo.min_order_amount),
      min_quantity: String(promo.min_quantity),
      start_date: promo.start_date ? promo.start_date.slice(0, 10) : '',
      end_date: promo.end_date ? promo.end_date.slice(0, 10) : '',
      max_uses: String(promo.max_uses),
      priority: String(promo.priority),
    })
    setModalOpen(true)
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount) || 0,
      min_quantity: Number(form.min_quantity) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      max_uses: Number(form.max_uses) || 0,
      priority: Number(form.priority) || 0,
    }

    if (form.type === 'BUY_X_GET_Y') {
      payload.buy_quantity = Number(form.buy_quantity) || 0
      payload.get_quantity = Number(form.get_quantity) || 0
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(id: number) {
    if (window.confirm(t('promotions.confirmDelete', 'Are you sure you want to delete this promotion?'))) {
      deleteMutation.mutate(id)
    }
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value)
    resetPage()
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const columns = useMemo<Column<Promotion & Record<string, unknown>>[]>(
    () => [
      {
        key: 'name',
        header: t('promotions.name', 'Name'),
        render: (row) => <span className="text-text-primary text-sm font-medium">{row.name}</span>,
      },
      {
        key: 'type',
        header: t('promotions.type', 'Type'),
        render: (row) => <StatusBadge status={row.type} />,
      },
      {
        key: 'discount_value',
        header: t('promotions.discount', 'Discount'),
        render: (row) => (
          <span className="font-medium">
            {row.type === 'PERCENTAGE' ? `${row.discount_value}%`
              : row.type === 'FREE_SHIPPING' ? '-'
              : row.type === 'BUY_X_GET_Y' ? `${row.buy_quantity}+${row.get_quantity}`
              : formatCurrency(row.discount_value)}
          </span>
        ),
      },
      {
        key: 'start_date',
        header: t('promotions.period', 'Period'),
        render: (row) => (
          <span className="text-text-muted text-xs">
            {row.start_date ? formatDate(row.start_date) : '-'} ~ {row.end_date ? formatDate(row.end_date) : '-'}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'current_uses',
        header: t('promotions.usage', 'Usage'),
        render: (row) => (
          <span className="text-text-secondary text-sm">
            {row.current_uses}/{row.max_uses || '\u221E'}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'is_active',
        header: t('promotions.status', 'Status'),
        render: (row) => (
          <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        key: 'actions',
        header: t('common.actions', 'Actions'),
        render: (row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleEdit(row)}
                >
                  {t('common.edit', 'Edit')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDelete(row.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={14} />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [t, isAdmin, deleteMutation.isPending],
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('promotions.title', 'Promotions')}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {t('promotions.subtitle', 'Manage promotional discounts and campaigns')}
        </p>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)}>
                <option value="">{t('promotions.allStatuses', 'All Statuses')}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </Select>
            </div>
            {isAdmin && (
              <div className="ml-auto">
                <Button size="sm" variant="primary" onClick={handleCreate}>
                  <Plus size={14} />
                  {t('promotions.create', 'Create Promotion')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<Promotion & Record<string, unknown>>
            columns={columns}
            data={promotions as (Promotion & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t('promotions.empty', 'No promotions found')}
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

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('promotions.editPromotion', 'Edit Promotion') : t('promotions.createPromotion', 'Create Promotion')}
      >
        <div className="space-y-4">
          <Input
            label={t('promotions.name', 'Name')}
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder={t('promotions.namePlaceholder', 'e.g. Black Friday 20% Off')}
          />
          <Select
            label={t('promotions.type', 'Type')}
            value={form.type}
            onChange={(e) => updateForm('type', e.target.value)}
          >
            {PROMOTION_TYPES.map((pt) => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </Select>
          {form.type !== 'FREE_SHIPPING' && form.type !== 'BUY_X_GET_Y' && (
            <Input
              label={form.type === 'PERCENTAGE' ? t('promotions.percentage', 'Discount %') : t('promotions.amount', 'Discount Amount')}
              type="number"
              value={form.discount_value}
              onChange={(e) => updateForm('discount_value', e.target.value)}
              placeholder={form.type === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 1000'}
            />
          )}
          {form.type === 'BUY_X_GET_Y' && (
            <>
              <Input
                label={t('promotions.discountValue', 'Discount Value')}
                type="number"
                value={form.discount_value}
                onChange={(e) => updateForm('discount_value', e.target.value)}
                placeholder="e.g. 100"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('promotions.buyQuantity', 'Buy Quantity')}
                  type="number"
                  value={form.buy_quantity}
                  onChange={(e) => updateForm('buy_quantity', e.target.value)}
                  placeholder="e.g. 3"
                />
                <Input
                  label={t('promotions.getQuantity', 'Get Quantity')}
                  type="number"
                  value={form.get_quantity}
                  onChange={(e) => updateForm('get_quantity', e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('promotions.minOrder', 'Min Order Amount')}
              type="number"
              value={form.min_order_amount}
              onChange={(e) => updateForm('min_order_amount', e.target.value)}
              placeholder="0"
            />
            <Input
              label={t('promotions.minQuantity', 'Min Quantity')}
              type="number"
              value={form.min_quantity}
              onChange={(e) => updateForm('min_quantity', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('promotions.startDate', 'Start Date')}
              type="date"
              value={form.start_date}
              onChange={(e) => updateForm('start_date', e.target.value)}
            />
            <Input
              label={t('promotions.endDate', 'End Date')}
              type="date"
              value={form.end_date}
              onChange={(e) => updateForm('end_date', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('promotions.maxUses', 'Max Uses')}
              type="number"
              value={form.max_uses}
              onChange={(e) => updateForm('max_uses', e.target.value)}
              placeholder="0 = unlimited"
            />
            <Input
              label={t('promotions.priority', 'Priority')}
              type="number"
              value={form.priority}
              onChange={(e) => updateForm('priority', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isSaving}
              disabled={!form.name.trim()}
            >
              {editingId ? t('common.save', 'Save') : t('common.create', 'Create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
