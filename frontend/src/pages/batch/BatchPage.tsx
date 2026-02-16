import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Layers, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react'

import { batchApi, type BatchResult, type ProductUpdate, type StockAdjustment } from '@/api/endpoints/batch'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/utils/cn'

type Tab = 'orders' | 'products' | 'stock'

export default function BatchPage() {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)

  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [result, setResult] = useState<BatchResult | null>(null)

  // Orders tab
  const [orderIds, setOrderIds] = useState('')
  const [orderStatus, setOrderStatus] = useState('delivered')

  // Products tab
  const [productRows, setProductRows] = useState<ProductUpdate[]>([{ id: 0 }])

  // Stock tab
  const [stockRows, setStockRows] = useState<StockAdjustment[]>([{ sku: '', qty: 0, reason: '' }])

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-muted">{t('common.accessDenied', 'Access denied')}</p>
      </div>
    )
  }

  const orderMutation = useMutation({
    mutationFn: () => {
      const ids = orderIds
        .split(/[,\n]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
      if (ids.length === 0 || ids.length > 100) {
        throw new Error(t('batch.invalidCount', 'Enter 1-100 order IDs'))
      }
      return batchApi.updateOrderStatus({ order_ids: ids, status: orderStatus })
    },
    onSuccess: (data) => {
      setResult(data)
      addToast('success', t('batch.orderSuccess', '{{count}} orders updated', { count: data.success }))
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const productMutation = useMutation({
    mutationFn: () => {
      const valid = productRows.filter((r) => r.id > 0)
      if (valid.length === 0 || valid.length > 100) {
        throw new Error(t('batch.invalidCount', 'Enter 1-100 items'))
      }
      return batchApi.updateProducts(valid)
    },
    onSuccess: (data) => {
      setResult(data)
      addToast('success', t('batch.productSuccess', '{{count}} products updated', { count: data.success }))
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const stockMutation = useMutation({
    mutationFn: () => {
      const valid = stockRows.filter((r) => r.sku.trim() && r.qty !== 0)
      if (valid.length === 0 || valid.length > 100) {
        throw new Error(t('batch.invalidCount', 'Enter 1-100 items'))
      }
      return batchApi.adjustStock(valid)
    },
    onSuccess: (data) => {
      setResult(data)
      addToast('success', t('batch.stockSuccess', '{{count}} stocks adjusted', { count: data.success }))
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const handleExecute = () => {
    if (!window.confirm(t('batch.confirmExecute', 'Execute this batch operation?'))) return
    setResult(null)
    if (activeTab === 'orders') orderMutation.mutate()
    else if (activeTab === 'products') productMutation.mutate()
    else stockMutation.mutate()
  }

  const isPending = orderMutation.isPending || productMutation.isPending || stockMutation.isPending

  const tabs: { key: Tab; label: string }[] = [
    { key: 'orders', label: t('batch.tabOrders', 'Order Status') },
    { key: 'products', label: t('batch.tabProducts', 'Product Update') },
    { key: 'stock', label: t('batch.tabStock', 'Stock Adjustment') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          <Layers className="mr-2 inline h-6 w-6" />
          {t('batch.title', 'Batch Operations')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('batch.subtitle', 'Bulk update orders, products, and stock (max 100 per batch)')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setResult(null) }}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-b-2 border-accent-purple text-accent-purple'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Order Status Tab */}
      {activeTab === 'orders' && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-xs text-text-muted">
              {t('batch.orderHint', 'Enter order IDs separated by commas or newlines (max 100)')}
            </p>
            <textarea
              value={orderIds}
              onChange={(e) => setOrderIds(e.target.value)}
              rows={5}
              placeholder="101, 102, 103"
              className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
            />
            <div className="flex items-center gap-3">
              <Select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="w-48">
                <option value="delivered">{t('orders.deliver', 'Delivered')}</option>
                <option value="shipped">{t('orders.ship', 'Shipped')}</option>
                <option value="cancelled">{t('orders.cancel', 'Cancelled')}</option>
              </Select>
              <Button size="sm" disabled={!orderIds.trim() || isPending} onClick={handleExecute}>
                {t('batch.execute', 'Execute')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Update Tab */}
      {activeTab === 'products' && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-xs text-text-muted">
              {t('batch.productHint', 'Enter product ID and fields to update')}
            </p>
            {productRows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <Input
                  label={i === 0 ? t('batch.productId', 'Product ID') : undefined}
                  type="number"
                  value={row.id || ''}
                  onChange={(e) => {
                    const next = [...productRows]
                    next[i] = { ...next[i], id: parseInt(e.target.value, 10) || 0 }
                    setProductRows(next)
                  }}
                  placeholder="ID"
                  className="w-24"
                />
                <Input
                  label={i === 0 ? t('batch.costPrice', 'Cost Price') : undefined}
                  type="number"
                  value={row.cost_price ?? ''}
                  onChange={(e) => {
                    const next = [...productRows]
                    next[i] = { ...next[i], cost_price: e.target.value ? Number(e.target.value) : undefined }
                    setProductRows(next)
                  }}
                  placeholder="¥"
                  className="w-28"
                />
                <Input
                  label={i === 0 ? t('batch.nameJp', 'Name (JP)') : undefined}
                  value={row.name_jp ?? ''}
                  onChange={(e) => {
                    const next = [...productRows]
                    next[i] = { ...next[i], name_jp: e.target.value || undefined }
                    setProductRows(next)
                  }}
                  placeholder="日本語名"
                  className="flex-1"
                />
                <Input
                  label={i === 0 ? t('batch.nameCn', 'Name (CN)') : undefined}
                  value={row.name_cn ?? ''}
                  onChange={(e) => {
                    const next = [...productRows]
                    next[i] = { ...next[i], name_cn: e.target.value || undefined }
                    setProductRows(next)
                  }}
                  placeholder="中文名"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setProductRows(productRows.filter((_, j) => j !== i))}
                  disabled={productRows.length <= 1}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setProductRows([...productRows, { id: 0 }])}
                disabled={productRows.length >= 100}
              >
                <Plus size={14} /> {t('batch.addRow', 'Add Row')}
              </Button>
              <Button size="sm" disabled={isPending} onClick={handleExecute}>
                {t('batch.execute', 'Execute')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Adjustment Tab */}
      {activeTab === 'stock' && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-xs text-text-muted">
              {t('batch.stockHint', 'Enter SKU, quantity adjustment, and reason')}
            </p>
            {stockRows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <Input
                  label={i === 0 ? 'SKU' : undefined}
                  value={row.sku}
                  onChange={(e) => {
                    const next = [...stockRows]
                    next[i] = { ...next[i], sku: e.target.value }
                    setStockRows(next)
                  }}
                  placeholder="SKU-001"
                  className="w-36"
                />
                <Input
                  label={i === 0 ? t('batch.quantity', 'Qty') : undefined}
                  type="number"
                  value={row.qty || ''}
                  onChange={(e) => {
                    const next = [...stockRows]
                    next[i] = { ...next[i], qty: parseInt(e.target.value, 10) || 0 }
                    setStockRows(next)
                  }}
                  placeholder="±10"
                  className="w-24"
                />
                <Input
                  label={i === 0 ? t('batch.reason', 'Reason') : undefined}
                  value={row.reason}
                  onChange={(e) => {
                    const next = [...stockRows]
                    next[i] = { ...next[i], reason: e.target.value }
                    setStockRows(next)
                  }}
                  placeholder={t('batch.reasonPlaceholder', 'Adjustment reason')}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setStockRows(stockRows.filter((_, j) => j !== i))}
                  disabled={stockRows.length <= 1}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setStockRows([...stockRows, { sku: '', qty: 0, reason: '' }])}
                disabled={stockRows.length >= 100}
              >
                <Plus size={14} /> {t('batch.addRow', 'Add Row')}
              </Button>
              <Button size="sm" disabled={isPending} onClick={handleExecute}>
                {t('batch.execute', 'Execute')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 text-lg font-semibold text-text-primary">
              {t('batch.result', 'Result')}
            </h3>
            <div className="mb-4 flex gap-6">
              <div className="flex items-center gap-2 text-accent-green">
                <CheckCircle size={16} />
                <span className="text-sm">{t('common.success', 'Success')}:</span>
                <span className="font-semibold">{result.success}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-2 text-accent-red">
                  <AlertCircle size={16} />
                  <span className="text-sm">{t('common.errors', 'Errors')}:</span>
                  <span className="font-semibold">{result.errors.length}</span>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-base p-3">
                {result.errors.map((err, i) => (
                  <div key={i} className="py-1 text-xs text-accent-red">
                    {err.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
