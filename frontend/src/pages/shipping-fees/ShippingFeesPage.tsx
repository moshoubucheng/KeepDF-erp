import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { shippingFeesApi } from '@/api/endpoints/shipping-fees'
import type { ShippingFeeTemplate } from '@/api/endpoints/shipping-fees'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { formatCurrency } from '@/utils/format'
import { PLATFORMS } from '@/utils/constants'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

const CARRIERS = ['YAMATO', 'SAGAWA', 'JP_POST', 'EMS', 'OTHER'] as const
const REGIONS = ['DOMESTIC', 'ASIA', 'US_EU', 'OTHER'] as const

const initialForm = {
  name: '',
  carrier: 'YAMATO' as string,
  region: 'DOMESTIC' as string,
  weight_min_g: '',
  weight_max_g: '',
  base_fee: '',
  per_kg_fee: '',
  platform: '',
}

export default function ShippingFeesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)

  // Filters
  const [carrierFilter, setCarrierFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(initialForm)

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['shipping-fee-templates', { carrier: carrierFilter, region: regionFilter, platform: platformFilter }],
    queryFn: () => shippingFeesApi.listTemplates({
      carrier: carrierFilter || undefined,
      region: regionFilter || undefined,
      platform: platformFilter || undefined,
    }),
  })

  const templates = data?.templates ?? []

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => shippingFeesApi.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-fee-templates'] })
      addToast('success', t('shippingFees.createSuccess', 'Template created successfully'))
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('shippingFees.createError', 'Failed to create template'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => shippingFeesApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-fee-templates'] })
      addToast('success', t('shippingFees.updateSuccess', 'Template updated successfully'))
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('shippingFees.updateError', 'Failed to update template'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shippingFeesApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-fee-templates'] })
      addToast('success', t('shippingFees.deleteSuccess', 'Template deleted'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('shippingFees.deleteError', 'Failed to delete template'))
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

  function handleEdit(tpl: ShippingFeeTemplate) {
    setEditingId(tpl.id)
    setForm({
      name: tpl.name,
      carrier: tpl.carrier,
      region: tpl.region,
      weight_min_g: String(tpl.weight_min_g),
      weight_max_g: String(tpl.weight_max_g),
      base_fee: String(tpl.base_fee),
      per_kg_fee: String(tpl.per_kg_fee),
      platform: tpl.platform ?? '',
    })
    setModalOpen(true)
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      name: form.name,
      carrier: form.carrier,
      region: form.region,
      weight_min_g: Number(form.weight_min_g) || 0,
      weight_max_g: Number(form.weight_max_g) || 0,
      base_fee: Number(form.base_fee) || 0,
      per_kg_fee: Number(form.per_kg_fee) || 0,
      platform: form.platform || null,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(id: number) {
    if (window.confirm(t('shippingFees.confirmDelete', 'Are you sure you want to delete this template?'))) {
      deleteMutation.mutate(id)
    }
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const columns = useMemo<Column<ShippingFeeTemplate & Record<string, unknown>>[]>(
    () => [
      {
        key: 'name',
        header: t('shippingFees.name', 'Name'),
        render: (row) => <span className="text-text-primary text-sm font-medium">{row.name}</span>,
      },
      {
        key: 'carrier',
        header: t('shippingFees.carrier', 'Carrier'),
        render: (row) => <StatusBadge status={row.carrier} />,
      },
      {
        key: 'region',
        header: t('shippingFees.region', 'Region'),
        render: (row) => <StatusBadge status={row.region} />,
      },
      {
        key: 'weight_range',
        header: t('shippingFees.weightRange', 'Weight (g)'),
        render: (row) => (
          <span className="text-text-secondary text-sm font-mono">
            {row.weight_min_g.toLocaleString()} ~ {row.weight_max_g.toLocaleString()}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'base_fee',
        header: t('shippingFees.baseFee', 'Base Fee'),
        render: (row) => <span className="font-medium">{formatCurrency(row.base_fee)}</span>,
      },
      {
        key: 'per_kg_fee',
        header: t('shippingFees.perKgFee', 'Per kg'),
        render: (row) => <span className="text-text-secondary text-sm">{formatCurrency(row.per_kg_fee)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'platform',
        header: t('shippingFees.platform', 'Platform'),
        render: (row) => (
          <span className="text-text-muted text-sm">{row.platform || t('common.all', 'All')}</span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'is_active',
        header: t('shippingFees.status', 'Status'),
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
          {t('shippingFees.title', 'Shipping Fee Templates')}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {t('shippingFees.subtitle', 'Manage shipping fee calculation templates by carrier and region')}
        </p>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)}>
                <option value="">{t('shippingFees.allCarriers', 'All Carriers')}</option>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                <option value="">{t('shippingFees.allRegions', 'All Regions')}</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                <option value="">{t('shippingFees.allPlatforms', 'All Platforms')}</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            {isAdmin && (
              <div className="ml-auto">
                <Button size="sm" variant="primary" onClick={handleCreate}>
                  <Plus size={14} />
                  {t('shippingFees.create', 'Create Template')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<ShippingFeeTemplate & Record<string, unknown>>
            columns={columns}
            data={templates as (ShippingFeeTemplate & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t('shippingFees.empty', 'No shipping fee templates found')}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('shippingFees.editTemplate', 'Edit Template') : t('shippingFees.createTemplate', 'Create Template')}
      >
        <div className="space-y-4">
          <Input
            label={t('shippingFees.name', 'Name')}
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder={t('shippingFees.namePlaceholder', 'e.g. Yamato Domestic Standard')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('shippingFees.carrier', 'Carrier')}
              value={form.carrier}
              onChange={(e) => updateForm('carrier', e.target.value)}
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select
              label={t('shippingFees.region', 'Region')}
              value={form.region}
              onChange={(e) => updateForm('region', e.target.value)}
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('shippingFees.weightMin', 'Weight Min (g)')}
              type="number"
              value={form.weight_min_g}
              onChange={(e) => updateForm('weight_min_g', e.target.value)}
              placeholder="0"
            />
            <Input
              label={t('shippingFees.weightMax', 'Weight Max (g)')}
              type="number"
              value={form.weight_max_g}
              onChange={(e) => updateForm('weight_max_g', e.target.value)}
              placeholder="e.g. 5000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('shippingFees.baseFee', 'Base Fee')}
              type="number"
              value={form.base_fee}
              onChange={(e) => updateForm('base_fee', e.target.value)}
              placeholder="e.g. 800"
            />
            <Input
              label={t('shippingFees.perKgFee', 'Per kg Fee')}
              type="number"
              value={form.per_kg_fee}
              onChange={(e) => updateForm('per_kg_fee', e.target.value)}
              placeholder="e.g. 200"
            />
          </div>
          <Select
            label={t('shippingFees.platform', 'Platform')}
            value={form.platform}
            onChange={(e) => updateForm('platform', e.target.value)}
          >
            <option value="">{t('shippingFees.allPlatforms', 'All Platforms')}</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
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
