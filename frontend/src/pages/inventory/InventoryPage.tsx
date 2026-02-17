import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Plus, PackagePlus, Pencil, Trash2 } from 'lucide-react'

import { inventoryApi } from '@/api/endpoints/inventory'
import type { Product } from '@/api/types'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency } from '@/utils/format'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { SearchInput } from '@/components/data/SearchInput'

// ---- Zod schemas ----

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name_jp: z.string().optional().default(''),
  name_cn: z.string().optional().default(''),
  cost_price: z.coerce.number().min(0, 'Cost price must be >= 0'),
  tax_category: z.enum(['standard', 'reduced']),
})

type ProductFormData = z.infer<typeof productSchema>

const inboundSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  expected_qty: z.coerce.number().int().min(1, 'Quantity must be >= 1'),
  actual_qty: z.coerce.number().int().min(1, 'Quantity must be >= 1'),
  location_code: z.string().min(1, 'Location code is required'),
})

type InboundFormData = z.infer<typeof inboundSchema>

// ---- Component ----

export default function InventoryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Search
  const [search, setSearch] = useState('')

  // Modal state
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [inboundModalOpen, setInboundModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  // ---- Queries ----

  const { data, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list(),
  })

  // Client-side search/pagination since backend returns all products
  const allProducts = data?.products ?? []
  const filteredProducts = search
    ? allProducts.filter((p) =>
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.name_jp && p.name_jp.toLowerCase().includes(search.toLowerCase())) ||
        (p.name_cn && p.name_cn.toLowerCase().includes(search.toLowerCase()))
      )
    : allProducts
  const totalPages = Math.ceil(filteredProducts.length / limit)
  const products = filteredProducts.slice((page - 1) * limit, page * limit)

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (values: ProductFormData) => inventoryApi.create({
      sku: values.sku,
      name_jp: values.name_jp || undefined,
      name_cn: values.name_cn || undefined,
      cost_price: values.cost_price,
      tax_category: values.tax_category,
    }),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      closeProductModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: ProductFormData }) =>
      inventoryApi.update(id, {
        name_jp: values.name_jp || undefined,
        name_cn: values.name_cn || undefined,
        cost_price: values.cost_price,
        tax_category: values.tax_category,
      }),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      closeProductModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => inventoryApi.delete(id),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setDeleteTarget(null)
    },
    onError: (err: Error) => {
      addToast('error', err.message)
    },
  })

  const inboundMutation = useMutation({
    mutationFn: (values: InboundFormData) =>
      inventoryApi.inbound({
        sku: values.sku,
        location_code: values.location_code,
        expected_qty: values.expected_qty,
        actual_qty: values.actual_qty,
      }),
    onSuccess: () => {
      addToast('success', t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setInboundModalOpen(false)
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

  const openAddProduct = useCallback(() => {
    setEditingProduct(null)
    setProductModalOpen(true)
  }, [])

  const openEditProduct = useCallback((product: Product) => {
    setEditingProduct(product)
    setProductModalOpen(true)
  }, [])

  const closeProductModal = useCallback(() => {
    setProductModalOpen(false)
    setEditingProduct(null)
  }, [])

  // ---- Table columns ----

  const columns = useMemo<Column<Product>[]>(
    () => [
      {
        key: 'sku',
        header: t('inventory.sku'),
        render: (row) => (
          <span className="font-mono text-xs font-medium text-accent-purple">
            {row.sku}
          </span>
        ),
      },
      {
        key: 'name_jp',
        header: t('inventory.name_jp'),
        render: (row) => row.name_jp || '-',
      },
      {
        key: 'name_cn',
        header: t('inventory.name_cn'),
        hideOnMobile: true,
        render: (row) => row.name_cn || '-',
      },
      {
        key: 'cost_price',
        header: t('inventory.cost_price'),
        render: (row) => formatCurrency(row.cost_price),
      },
      {
        key: 'tax_category',
        header: t('inventory.tax_category'),
        hideOnMobile: true,
        render: (row) =>
          row.tax_category === 'standard' ? (
            <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
              {t('inventory.tax_standard')}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              {t('inventory.tax_reduced')}
            </span>
          ),
      },
      {
        key: 'total_stock',
        header: t('inventory.stock'),
        render: (row) => {
          const stock = (row as Product & { total_stock?: number }).total_stock ?? 0
          return (
            <span
              className={
                stock <= 0
                  ? 'font-semibold text-accent-red'
                  : stock <= 10
                    ? 'font-semibold text-amber-400'
                    : 'text-text-primary'
              }
            >
              {stock}
            </span>
          )
        },
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
                openEditProduct(row)
              }}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-input hover:text-accent-purple transition-colors cursor-pointer"
              title={t('inventory.edit')}
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(row)
              }}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-input hover:text-accent-red transition-colors cursor-pointer"
              title={t('inventory.delete')}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
      },
    ],
    [t, openEditProduct],
  )

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('inventory.title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('inventory.subtitle')}</p>
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
          <Button variant="secondary" size="sm" onClick={() => setInboundModalOpen(true)}>
            <PackagePlus size={16} />
            {t('inventory.inbound')}
          </Button>
          <Button size="sm" onClick={openAddProduct}>
            <Plus size={16} />
            {t('inventory.add_product')}
          </Button>
        </div>
      </div>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={products}
            loading={isLoading}
            emptyMessage={t('inventory.empty')}
            keyField="id"
            mobileCardView
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          pages={totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Add/Edit Product Modal */}
      <ProductModal
        open={productModalOpen}
        onClose={closeProductModal}
        product={editingProduct}
        saving={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values) => {
          if (editingProduct) {
            updateMutation.mutate({ id: editingProduct.id, values })
          } else {
            createMutation.mutate(values)
          }
        }}
      />

      {/* Inbound Modal */}
      <InboundModal
        open={inboundModalOpen}
        onClose={() => setInboundModalOpen(false)}
        saving={inboundMutation.isPending}
        onSubmit={(values) => inboundMutation.mutate(values)}
      />

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('common.confirm_delete')}
      >
        <p className="text-sm text-text-secondary mb-6">
          {t('confirm.delete_product', { sku: deleteTarget?.sku ?? '' })}
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

// ---- Product Modal ----

interface ProductModalProps {
  open: boolean
  onClose: () => void
  product: Product | null
  saving: boolean
  onSubmit: (values: ProductFormData) => void
}

function ProductModal({ open, onClose, product, saving, onSubmit }: ProductModalProps) {
  const { t } = useTranslation()
  const isEdit = product !== null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    values: isEdit
      ? {
          sku: product.sku,
          name_jp: product.name_jp ?? '',
          name_cn: product.name_cn ?? '',
          cost_price: product.cost_price,
          tax_category: product.tax_category,
        }
      : {
          sku: '',
          name_jp: '',
          name_cn: '',
          cost_price: 0,
          tax_category: 'standard',
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
      title={isEdit ? t('inventory.edit') : t('inventory.add_product')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Input
          label="SKU"
          {...register('sku')}
          error={errors.sku?.message}
          autoFocus
        />
        <Input
          label={t('inventory.name_jp')}
          {...register('name_jp')}
          error={errors.name_jp?.message}
        />
        <Input
          label={t('inventory.name_cn')}
          {...register('name_cn')}
          error={errors.name_cn?.message}
        />
        <Input
          label={t('inventory.cost_price')}
          type="number"
          min={0}
          step={1}
          {...register('cost_price')}
          error={errors.cost_price?.message}
        />
        <Select
          label={t('inventory.tax_category')}
          {...register('tax_category')}
          error={errors.tax_category?.message}
        >
          <option value="standard">{t('inventory.tax_standard')}</option>
          <option value="reduced">{t('inventory.tax_reduced')}</option>
        </Select>

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

// ---- Inbound Modal ----

interface InboundModalProps {
  open: boolean
  onClose: () => void
  saving: boolean
  onSubmit: (values: InboundFormData) => void
}

function InboundModal({ open, onClose, saving, onSubmit }: InboundModalProps) {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InboundFormData>({
    resolver: zodResolver(inboundSchema),
    defaultValues: {
      sku: '',
      expected_qty: 1,
      actual_qty: 1,
      location_code: '',
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
      title={t('inventory.inbound')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Input
          label="SKU"
          {...register('sku')}
          error={errors.sku?.message}
          autoFocus
        />
        <Input
          label="Location Code"
          {...register('location_code')}
          error={errors.location_code?.message}
          placeholder="e.g. A-01-01"
        />
        <Input
          label={t('inventory.expectedQty', 'Expected Qty')}
          type="number"
          min={1}
          step={1}
          {...register('expected_qty')}
          error={errors.expected_qty?.message}
        />
        <Input
          label={t('inventory.actualQty', 'Actual Qty')}
          type="number"
          min={1}
          step={1}
          {...register('actual_qty')}
          error={errors.actual_qty?.message}
        />

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
