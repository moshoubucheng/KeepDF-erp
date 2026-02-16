import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react'

import { importApi, type ImportResult, type ImportLog } from '@/api/endpoints/import'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { DataTable, type Column } from '@/components/data/DataTable'

export default function ImportPage() {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const addToast = useUIStore((s) => s.addToast)

  // File upload state
  const [productFile, setProductFile] = useState<File | null>(null)
  const [orderFile, setOrderFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [resultType, setResultType] = useState<'products' | 'orders' | null>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const orderInputRef = useRef<HTMLInputElement>(null)

  // Batch update state
  const [batchText, setBatchText] = useState('')
  const [batchStatus, setBatchStatus] = useState('delivered')

  // Import logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['import-logs'],
    queryFn: () => importApi.getLogs(),
  })

  const productMutation = useMutation({
    mutationFn: (file: File) => importApi.importProducts(file),
    onSuccess: (data) => {
      setImportResult(data)
      setResultType('products')
      setProductFile(null)
      if (productInputRef.current) productInputRef.current.value = ''
      addToast('success', t('import.success', 'Import completed'))
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const orderMutation = useMutation({
    mutationFn: (file: File) => importApi.importOrders(file),
    onSuccess: (data) => {
      setImportResult(data)
      setResultType('orders')
      setOrderFile(null)
      if (orderInputRef.current) orderInputRef.current.value = ''
      addToast('success', t('import.success', 'Import completed'))
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const batchMutation = useMutation({
    mutationFn: () => {
      const lines = batchText.trim().split('\n').filter(Boolean)
      const updates = lines.map((line) => {
        const [idStr] = line.split(',')
        return { order_id: parseInt(idStr.trim(), 10), status: batchStatus }
      })
      return importApi.batchUpdateStatus(updates)
    },
    onSuccess: (data) => {
      addToast(
        'success',
        t('import.batchSuccess', 'Updated {{count}} orders', { count: data.success }),
      )
      setBatchText('')
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const templateProductUrl = importApi.getProductTemplateUrl() + (token ? `?token=${token}` : '')
  const templateOrderUrl = importApi.getOrderTemplateUrl() + (token ? `?token=${token}` : '')

  const logColumns = useMemo<Column<ImportLog>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="font-mono text-xs text-text-muted">{row.id}</span>,
      },
      {
        key: 'action',
        header: t('import.action', 'Action'),
        render: (row) => (
          <span className="text-xs font-medium uppercase text-accent-purple">{row.action}</span>
        ),
      },
      {
        key: 'resource_type',
        header: t('import.resourceType', 'Type'),
        render: (row) => <span className="text-sm text-text-secondary">{row.resource_type}</span>,
      },
      {
        key: 'details',
        header: t('import.details', 'Details'),
        hideOnMobile: true,
        render: (row) => {
          if (!row.details) return <span className="text-text-muted">-</span>
          const truncated =
            row.details.length > 80 ? row.details.slice(0, 80) + '...' : row.details
          return (
            <span className="text-xs text-text-muted" title={row.details}>
              {truncated}
            </span>
          )
        },
      },
      {
        key: 'created_at',
        header: t('common.date', 'Date'),
        render: (row) => (
          <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('import.title', 'Data Import')}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('import.subtitle', 'Import products and orders via CSV files')}
        </p>
      </div>

      {/* Import Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Product Import */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent-purple" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('import.productImport', 'Product Import')}
              </h2>
            </div>
            <div>
              <input
                ref={productInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setProductFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-accent-purple/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-purple hover:file:bg-accent-purple/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={!productFile || productMutation.isPending}
                onClick={() => productFile && productMutation.mutate(productFile)}
              >
                <Upload size={16} />
                {productMutation.isPending
                  ? t('common.loading', 'Loading...')
                  : t('import.upload', 'Upload')}
              </Button>
              <a href={templateProductUrl} download className="inline-flex">
                <Button size="sm" variant="secondary" type="button">
                  <Download size={16} />
                  {t('import.template', 'Template')}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Order Import */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent-blue" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('import.orderImport', 'Order Import')}
              </h2>
            </div>
            <div>
              <input
                ref={orderInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setOrderFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-accent-blue/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-blue hover:file:bg-accent-blue/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={!orderFile || orderMutation.isPending}
                onClick={() => orderFile && orderMutation.mutate(orderFile)}
              >
                <Upload size={16} />
                {orderMutation.isPending
                  ? t('common.loading', 'Loading...')
                  : t('import.upload', 'Upload')}
              </Button>
              <a href={templateOrderUrl} download className="inline-flex">
                <Button size="sm" variant="secondary" type="button">
                  <Download size={16} />
                  {t('import.template', 'Template')}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 text-lg font-semibold text-text-primary">
              {t('import.result', 'Import Result')} ({resultType})
            </h3>
            <div className="mb-4 flex gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">{t('import.total', 'Total')}:</span>
                <span className="font-semibold">{importResult.total}</span>
              </div>
              <div className="flex items-center gap-2 text-accent-green">
                <CheckCircle size={16} />
                <span className="text-sm">{t('import.successCount', 'Success')}:</span>
                <span className="font-semibold">{importResult.success}</span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="flex items-center gap-2 text-accent-red">
                  <AlertCircle size={16} />
                  <span className="text-sm">{t('import.errorCount', 'Errors')}:</span>
                  <span className="font-semibold">{importResult.errors.length}</span>
                </div>
              )}
            </div>
            {importResult.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-base p-3">
                {importResult.errors.map((err, i) => (
                  <div key={i} className="flex gap-2 py-1 text-xs text-accent-red">
                    {err.row != null && (
                      <span className="font-mono text-text-muted">
                        {t('import.row', 'Row')} {err.row}:
                      </span>
                    )}
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch Status Update */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {t('import.batchUpdate', 'Batch Status Update')}
          </h3>
          <p className="text-xs text-text-muted">
            {t('import.batchHint', 'Enter one order ID per line')}
          </p>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={5}
            placeholder="101&#10;102&#10;103"
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
          />
          <div className="flex items-center gap-3">
            <Select
              value={batchStatus}
              onChange={(e) => setBatchStatus(e.target.value)}
              className="w-48"
            >
              <option value="delivered">{t('orders.deliver', 'Delivered')}</option>
              <option value="shipped">{t('orders.ship', 'Shipped')}</option>
              <option value="cancelled">{t('orders.cancel', 'Cancelled')}</option>
            </Select>
            <Button
              size="sm"
              disabled={!batchText.trim() || batchMutation.isPending}
              onClick={() => batchMutation.mutate()}
            >
              {t('import.execute', 'Execute')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-text-primary">
          {t('import.history', 'Import History')}
        </h3>
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={logColumns}
              data={logsData?.logs ?? []}
              loading={logsLoading}
              emptyMessage={t('import.emptyHistory', 'No import history')}
              keyField="id"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
