import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'

import { customersApi } from '@/api/endpoints/customers'
import type { Customer } from '@/api/types'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { PLATFORMS } from '@/utils/constants'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { SearchInput } from '@/components/data/SearchInput'
import { PlatformBadge } from '@/components/data/PlatformBadge'

// ---- Zod schema ----

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional().default(''),
  phone: z.string().optional().default(''),
  address_line1: z.string().optional().default(''),
  city: z.string().optional().default(''),
  prefecture: z.string().optional().default(''),
  postal_code: z.string().optional().default(''),
  country: z.string().optional().default('JP'),
  platform: z.string().optional().default(''),
  tags: z.string().optional().default(''),
  notes: z.string().optional().default(''),
})

type CustomerFormData = z.infer<typeof customerSchema>

// ---- Component ----

export default function CustomersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Search
  const [search, setSearch] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  // ---- Queries ----

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { page, limit, search }],
    queryFn: () => customersApi.list({ page, limit, search: search || undefined }),
  })

  const customers = data?.customers ?? []
  const pagination = data?.pagination

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (values: CustomerFormData) =>
      customersApi.create({
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        address_line1: values.address_line1 || null,
        city: values.city || null,
        prefecture: values.prefecture || null,
        postal_code: values.postal_code || null,
        country: values.country || 'JP',
        platform: values.platform || null,
        tags: values.tags || '',
        notes: values.notes || null,
      }),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: CustomerFormData }) =>
      customersApi.update(id, {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        address_line1: values.address_line1 || null,
        city: values.city || null,
        prefecture: values.prefecture || null,
        postal_code: values.postal_code || null,
        country: values.country || 'JP',
        platform: values.platform || null,
        tags: values.tags || '',
        notes: values.notes || null,
      }),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      closeModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customersApi.delete(id),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => {
      addToast('error', err.message)
    },
  })

  // ---- Handlers ----

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)
      resetPage()
    },
    [resetPage],
  )

  const openAdd = useCallback(() => {
    setEditingCustomer(null)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((customer: Customer) => {
    setEditingCustomer(customer)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingCustomer(null)
  }, [])

  // ---- Table columns ----

  const columns = useMemo<Column<Customer>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => (
          <span className="font-mono text-xs text-text-muted">{row.id}</span>
        ),
      },
      {
        key: 'name',
        header: t('customers.name'),
        render: (row) => (
          <span className="font-medium text-text-primary">{row.name}</span>
        ),
      },
      {
        key: 'email',
        header: t('customers.email'),
        hideOnMobile: true,
        render: (row) => row.email || '-',
      },
      {
        key: 'phone',
        header: t('customers.phone'),
        hideOnMobile: true,
        render: (row) => row.phone || '-',
      },
      {
        key: 'platform',
        header: t('orders.platform'),
        render: (row) =>
          row.platform ? (
            <PlatformBadge platform={row.platform} />
          ) : (
            <span className="text-text-muted">-</span>
          ),
      },
      {
        key: 'tags',
        header: t('customers.tags'),
        hideOnMobile: true,
        render: (row) => {
          if (!row.tags) return '-'
          const tagList = row.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
          if (tagList.length === 0) return '-'
          return (
            <div className="flex flex-wrap gap-1">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-accent-purple/15 px-2 py-0.5 text-xs font-medium text-accent-purple"
                >
                  {tag}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        key: 'created_at',
        header: t('orders.date'),
        hideOnMobile: true,
        render: (row) => (
          <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: t('orders.actions'),
        className: 'w-28',
        render: (row) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openEdit(row)
              }}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-input hover:text-accent-purple transition-colors cursor-pointer"
              title={t('customers.edit')}
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(row)
              }}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-input hover:text-accent-red transition-colors cursor-pointer"
              title={t('common.delete')}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
      },
    ],
    [t, openEdit],
  )

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('customers.title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('customers.subtitle')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder={t('common.search')}
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" onClick={openAdd}>
            <Plus size={16} />
            {t('customers.add')}
          </Button>
        </div>
      </div>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={customers}
            loading={isLoading}
            emptyMessage={t('customers.empty')}
            keyField="id"
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          onPageChange={setPage}
        />
      )}

      {/* Add/Edit Customer Modal */}
      <CustomerModal
        open={modalOpen}
        onClose={closeModal}
        customer={editingCustomer}
        saving={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values) => {
          if (editingCustomer) {
            updateMutation.mutate({ id: editingCustomer.id, values })
          } else {
            createMutation.mutate(values)
          }
        }}
      />

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('common.confirm_delete')}
      >
        <p className="text-sm text-text-secondary mb-6">
          {t('common.confirm_delete')}: <strong>{deleteTarget?.name}</strong>
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ---- Customer Modal ----

interface CustomerModalProps {
  open: boolean
  onClose: () => void
  customer: Customer | null
  saving: boolean
  onSubmit: (values: CustomerFormData) => void
}

function CustomerModal({ open, onClose, customer, saving, onSubmit }: CustomerModalProps) {
  const { t } = useTranslation()
  const isEdit = customer !== null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    values: isEdit
      ? {
          name: customer.name,
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          address_line1: customer.address_line1 ?? '',
          city: customer.city ?? '',
          prefecture: customer.prefecture ?? '',
          postal_code: customer.postal_code ?? '',
          country: customer.country || 'JP',
          platform: customer.platform ?? '',
          tags: customer.tags ?? '',
          notes: customer.notes ?? '',
        }
      : {
          name: '',
          email: '',
          phone: '',
          address_line1: '',
          city: '',
          prefecture: '',
          postal_code: '',
          country: 'JP',
          platform: '',
          tags: '',
          notes: '',
        },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? t('customers.edit') : t('customers.add')}
      className="max-w-2xl"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* Basic info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('customers.name') + ' *'}
            {...register('name')}
            error={errors.name?.message}
            autoFocus
          />
          <Input
            label={t('customers.email')}
            type="email"
            {...register('email')}
            error={errors.email?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('customers.phone')}
            {...register('phone')}
            error={errors.phone?.message}
          />
          <Select
            label={t('orders.platform')}
            {...register('platform')}
            error={errors.platform?.message}
          >
            <option value="">-</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {/* Address section */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-3">
            {t('customers.address')}
          </p>

          <Input
            label={t('customers.address')}
            {...register('address_line1')}
            error={errors.address_line1?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <Input
              label={t('customers.city')}
              {...register('city')}
              error={errors.city?.message}
            />
            <Input
              label={t('customers.prefecture')}
              {...register('prefecture')}
              error={errors.prefecture?.message}
            />
            <Input
              label={t('customers.postal_code')}
              {...register('postal_code')}
              error={errors.postal_code?.message}
            />
          </div>

          <div className="mt-4">
            <Input
              label="Country"
              {...register('country')}
              error={errors.country?.message}
            />
          </div>
        </div>

        {/* Tags & Notes */}
        <div className="border-t border-border pt-4 space-y-4">
          <Input
            label={t('customers.tags')}
            {...register('tags')}
            error={errors.tags?.message}
            placeholder="VIP, wholesale, retail"
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-text-secondary"
            >
              {t('customers.notes')}
            </label>
            <textarea
              id="notes"
              rows={3}
              {...register('notes')}
              className="w-full px-3 py-2 rounded-lg text-sm bg-bg-input text-text-primary placeholder:text-text-muted border border-border focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/50 transition-colors duration-200 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
