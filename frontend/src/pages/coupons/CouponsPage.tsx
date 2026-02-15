import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Ban, CheckCircle, Search } from 'lucide-react'
import { couponsApi } from '@/api/endpoints/coupons'
import type { Coupon } from '@/api/endpoints/coupons'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency, formatDate } from '@/utils/format'
import { PLATFORMS } from '@/utils/constants'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

const COUPON_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const

const initialForm = {
  name: '',
  type: 'PERCENTAGE' as string,
  value: '',
  min_order_amount: '',
  max_uses: '',
  per_user_limit: '',
  platform: '',
  valid_from: '',
  valid_to: '',
}

export default function CouponsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)

  // Filters
  const [platform, setPlatform] = useState('')
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(initialForm)

  // Validate section
  const [validateCode, setValidateCode] = useState('')
  const [validateTotal, setValidateTotal] = useState('')
  const [validateResult, setValidateResult] = useState<{ valid: boolean; discount?: number; message?: string } | null>(null)

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['coupons', { page, limit, platform }],
    queryFn: () => couponsApi.list({ offset: (page - 1) * limit, limit, platform: platform || undefined }),
  })

  const coupons = data?.coupons ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => couponsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      addToast('success', t('coupons.createSuccess', 'Coupon created successfully'))
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('coupons.createError', 'Failed to create coupon'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => couponsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      addToast('success', t('coupons.updateSuccess', 'Coupon updated successfully'))
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('coupons.updateError', 'Failed to update coupon'))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => couponsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] })
      addToast('success', t('coupons.deactivateSuccess', 'Coupon deactivated'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('coupons.deactivateError', 'Failed to deactivate coupon'))
    },
  })

  const validateMutation = useMutation({
    mutationFn: ({ code, orderTotal }: { code: string; orderTotal: number }) =>
      couponsApi.validate(code, orderTotal),
    onSuccess: (result) => {
      setValidateResult(result)
    },
    onError: (err: Error) => {
      setValidateResult({ valid: false, message: err.message })
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

  function handleEdit(coupon: Coupon) {
    setEditingId(coupon.id)
    setForm({
      name: coupon.name,
      type: coupon.type,
      value: String(coupon.value),
      min_order_amount: String(coupon.min_order_amount),
      max_uses: String(coupon.max_uses),
      per_user_limit: String(coupon.per_user_limit),
      platform: coupon.platform ?? '',
      valid_from: coupon.valid_from ? coupon.valid_from.slice(0, 10) : '',
      valid_to: coupon.valid_to ? coupon.valid_to.slice(0, 10) : '',
    })
    setModalOpen(true)
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      value: Number(form.value),
      min_order_amount: Number(form.min_order_amount) || 0,
      max_uses: Number(form.max_uses) || 0,
      per_user_limit: Number(form.per_user_limit) || 0,
      platform: form.platform || null,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDeactivate(id: number) {
    if (window.confirm(t('coupons.confirmDeactivate', 'Are you sure you want to deactivate this coupon?'))) {
      deactivateMutation.mutate(id)
    }
  }

  function handleValidate() {
    if (!validateCode.trim() || !validateTotal) return
    setValidateResult(null)
    validateMutation.mutate({ code: validateCode.trim(), orderTotal: Number(validateTotal) })
  }

  function handlePlatformChange(value: string) {
    setPlatform(value)
    resetPage()
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const columns = useMemo<Column<Coupon & Record<string, unknown>>[]>(
    () => [
      {
        key: 'code',
        header: t('coupons.code', 'Code'),
        render: (row) => <span className="font-mono text-xs text-accent-purple font-semibold">{row.code}</span>,
      },
      {
        key: 'name',
        header: t('coupons.name', 'Name'),
        render: (row) => <span className="text-text-primary text-sm">{row.name}</span>,
      },
      {
        key: 'type',
        header: t('coupons.type', 'Type'),
        render: (row) => <StatusBadge status={row.type} />,
      },
      {
        key: 'value',
        header: t('coupons.value', 'Value'),
        render: (row) => (
          <span className="font-medium">
            {row.type === 'PERCENTAGE' ? `${row.value}%` : row.type === 'FREE_SHIPPING' ? '-' : formatCurrency(row.value)}
          </span>
        ),
      },
      {
        key: 'min_order_amount',
        header: t('coupons.minOrder', 'Min Order'),
        render: (row) => (
          <span className="text-text-muted text-sm">{row.min_order_amount ? formatCurrency(row.min_order_amount) : '-'}</span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'used_count',
        header: t('coupons.usage', 'Usage'),
        render: (row) => (
          <span className="text-text-secondary text-sm">
            {row.used_count}/{row.max_uses || '\u221E'}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'valid_from',
        header: t('coupons.period', 'Period'),
        render: (row) => (
          <span className="text-text-muted text-xs">
            {row.valid_from ? formatDate(row.valid_from) : '-'} ~ {row.valid_to ? formatDate(row.valid_to) : '-'}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'is_active',
        header: t('coupons.status', 'Status'),
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
                {row.is_active === 1 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDeactivate(row.id)}
                    disabled={deactivateMutation.isPending}
                  >
                    <Ban size={14} />
                  </Button>
                )}
              </>
            )}
          </div>
        ),
      },
    ],
    [t, isAdmin, deactivateMutation.isPending],
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('coupons.title', 'Coupons')}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {t('coupons.subtitle', 'Manage discount coupons and validate codes')}
        </p>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select value={platform} onChange={(e) => handlePlatformChange(e.target.value)}>
                <option value="">{t('coupons.allPlatforms', 'All Platforms')}</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            {isAdmin && (
              <div className="ml-auto">
                <Button size="sm" variant="primary" onClick={handleCreate}>
                  <Plus size={14} />
                  {t('coupons.create', 'Create Coupon')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<Coupon & Record<string, unknown>>
            columns={columns}
            data={coupons as (Coupon & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t('coupons.empty', 'No coupons found')}
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

      {/* Validate Coupon Section */}
      <Card>
        <CardContent>
          <h3 className="text-base font-semibold text-text-primary mb-4">
            {t('coupons.validateTitle', 'Validate Coupon')}
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Input
                label={t('coupons.couponCode', 'Coupon Code')}
                value={validateCode}
                onChange={(e) => setValidateCode(e.target.value)}
                placeholder="e.g. KDF-XXXXXXXX"
              />
            </div>
            <div className="w-40">
              <Input
                label={t('coupons.orderTotal', 'Order Total')}
                type="number"
                value={validateTotal}
                onChange={(e) => setValidateTotal(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={handleValidate}
              loading={validateMutation.isPending}
              disabled={!validateCode.trim() || !validateTotal}
            >
              <Search size={14} />
              {t('coupons.validate', 'Validate')}
            </Button>
          </div>
          {validateResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${validateResult.valid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <div className="flex items-center gap-2">
                {validateResult.valid ? <CheckCircle size={16} /> : <Ban size={16} />}
                <span className="font-medium">
                  {validateResult.valid
                    ? t('coupons.validResult', 'Valid! Discount: {{discount}}', { discount: formatCurrency(validateResult.discount ?? 0) })
                    : validateResult.message || t('coupons.invalidResult', 'Invalid coupon')}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('coupons.editCoupon', 'Edit Coupon') : t('coupons.createCoupon', 'Create Coupon')}
      >
        <div className="space-y-4">
          <Input
            label={t('coupons.name', 'Name')}
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder={t('coupons.namePlaceholder', 'e.g. Summer Sale 10% Off')}
          />
          <Select
            label={t('coupons.type', 'Type')}
            value={form.type}
            onChange={(e) => updateForm('type', e.target.value)}
          >
            {COUPON_TYPES.map((ct) => (
              <option key={ct} value={ct}>{ct}</option>
            ))}
          </Select>
          {form.type !== 'FREE_SHIPPING' && (
            <Input
              label={form.type === 'PERCENTAGE' ? t('coupons.percentage', 'Discount %') : t('coupons.amount', 'Discount Amount')}
              type="number"
              value={form.value}
              onChange={(e) => updateForm('value', e.target.value)}
              placeholder={form.type === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 500'}
            />
          )}
          <Input
            label={t('coupons.minOrder', 'Min Order Amount')}
            type="number"
            value={form.min_order_amount}
            onChange={(e) => updateForm('min_order_amount', e.target.value)}
            placeholder="0"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('coupons.maxUses', 'Max Uses')}
              type="number"
              value={form.max_uses}
              onChange={(e) => updateForm('max_uses', e.target.value)}
              placeholder="0 = unlimited"
            />
            <Input
              label={t('coupons.perUserLimit', 'Per User Limit')}
              type="number"
              value={form.per_user_limit}
              onChange={(e) => updateForm('per_user_limit', e.target.value)}
              placeholder="0 = unlimited"
            />
          </div>
          <Select
            label={t('coupons.platform', 'Platform')}
            value={form.platform}
            onChange={(e) => updateForm('platform', e.target.value)}
          >
            <option value="">{t('coupons.allPlatforms', 'All Platforms')}</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('coupons.validFrom', 'Valid From')}
              type="date"
              value={form.valid_from}
              onChange={(e) => updateForm('valid_from', e.target.value)}
            />
            <Input
              label={t('coupons.validTo', 'Valid To')}
              type="date"
              value={form.valid_to}
              onChange={(e) => updateForm('valid_to', e.target.value)}
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
