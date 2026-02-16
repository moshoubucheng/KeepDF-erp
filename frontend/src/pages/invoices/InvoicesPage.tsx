import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { invoicesApi, type Invoice } from '@/api/endpoints/invoices'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatCard } from '@/components/data/StatCard'
import { Pagination } from '@/components/ui/Pagination'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatCurrency } from '@/utils/format'
import { Download, FileText, Eye, Plus, Receipt, FileCheck, FileWarning } from 'lucide-react'

// ── Types ──

interface InvoiceRow {
  id: number
  order_id: number
  invoice_number: string
  platform?: string
  total_amount?: number
  pdf_url?: string
  created_at: string
  tax_details: string
}

interface TaxItem {
  sku?: string
  name?: string
  quantity?: number
  unit_price?: number
  tax_rate?: number
  tax_amount?: number
  subtotal?: number
}

interface TaxDetails {
  seller?: { name?: string; address?: string; registration_number?: string }
  buyer?: { name?: string; address?: string }
  items?: TaxItem[]
  subtotal?: number
  tax_total?: number
  total?: number
  [key: string]: unknown
}

// ── Component ──

export default function InvoicesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  const { page, limit, setPage } = usePagination()

  // Modals
  const [showDetail, setShowDetail] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)

  // Generate form
  const [genOrderId, setGenOrderId] = useState('')
  const [genBuyerName, setGenBuyerName] = useState('')
  const [genDate, setGenDate] = useState('')

  // ── Queries ──

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, limit }],
    queryFn: () => invoicesApi.list((page - 1) * limit, limit),
  })

  const invoices = (data?.invoices ?? []) as InvoiceRow[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  // Stats
  const withPdf = invoices.filter((inv) => inv.pdf_url).length
  const withoutPdf = invoices.length - withPdf

  // Detail query
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['invoice-detail', detailId],
    queryFn: () => invoicesApi.detail(detailId!),
    enabled: !!detailId && showDetail,
  })

  // ── Mutations ──

  const generateMutation = useMutation({
    mutationFn: ({ orderId, buyerName, invoiceDate }: { orderId: number; buyerName: string; invoiceDate?: string }) =>
      invoicesApi.generate(orderId, buyerName, invoiceDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      addToast('success', t('invoices.generated'))
      setShowGenerate(false)
      setGenOrderId('')
      setGenBuyerName('')
      setGenDate('')
    },
    onError: (err: Error) => {
      addToast('error', err.message)
    },
  })

  const pdfMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.generatePdf(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      addToast('success', t('invoices.pdf_generated'))
    },
    onError: (err: Error) => {
      if (err.message.includes('already')) {
        addToast('info', t('invoices.pdf_exists'))
      } else {
        addToast('error', err.message)
      }
    },
  })

  // ── Handlers ──

  const openDetail = (inv: InvoiceRow) => {
    setDetailId(inv.id)
    setShowDetail(true)
  }

  const closeDetail = () => {
    setShowDetail(false)
    setDetailId(null)
  }

  const handleDownloadPdf = (id: number) => {
    const token = localStorage.getItem('erp_token') || ''
    window.open(`${invoicesApi.downloadPdfUrl(id)}?token=${token}`, '_blank')
  }

  const handleExportCsv = () => {
    const token = localStorage.getItem('erp_token') || ''
    window.open(`${invoicesApi.exportCsvUrl()}?token=${token}`, '_blank')
  }

  const handleGenerate = () => {
    const orderId = parseInt(genOrderId, 10)
    if (!orderId || !genBuyerName.trim()) return
    generateMutation.mutate({
      orderId,
      buyerName: genBuyerName.trim(),
      invoiceDate: genDate || undefined,
    })
  }

  // ── Parse detail tax_details ──

  const parseTaxDetails = (raw: string | Record<string, unknown> | undefined): TaxDetails | null => {
    if (!raw) return null
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw as TaxDetails
    } catch {
      return null
    }
  }

  const detailInvoice = detailData as (Invoice & { order?: Record<string, unknown>; platform?: string; total_amount?: number }) | undefined
  const taxDetails = parseTaxDetails(detailInvoice?.tax_details as string | undefined)

  // ── Columns ──

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice_number',
      header: t('invoices.number'),
      render: (row) => <span className="font-mono text-sm font-medium text-text-primary">{row.invoice_number}</span>,
    },
    {
      key: 'order_id',
      header: t('invoices.order_id'),
      render: (row) => <span className="font-mono text-xs text-text-muted">#{row.order_id}</span>,
    },
    {
      key: 'platform',
      header: t('invoices.platform'),
      hideOnMobile: true,
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-accent-purple/15 px-2 py-0.5 text-xs font-medium text-accent-purple">
          {row.platform || '-'}
        </span>
      ),
    },
    {
      key: 'total_amount',
      header: t('invoices.amount'),
      render: (row) => (
        <span className="text-sm font-medium tabular-nums text-text-primary">
          {row.total_amount != null ? formatCurrency(row.total_amount) : '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: t('invoices.date'),
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openDetail(row)} title={t('invoices.detail')}>
            <Eye size={14} />
          </Button>
          {row.pdf_url ? (
            <Button size="sm" variant="secondary" onClick={() => handleDownloadPdf(row.id)} title={t('invoices.download_pdf')}>
              <Download size={14} />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => pdfMutation.mutate(row.id)}
              loading={pdfMutation.isPending && pdfMutation.variables === row.id}
              disabled={pdfMutation.isPending}
              title={t('invoices.generate_pdf')}
            >
              <FileText size={14} />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('invoices.title')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('invoices.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={() => setShowGenerate(true)}>
            <Plus size={14} />
            {t('invoices.generate')}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleExportCsv}>
            <Download size={14} />
            CSV
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Receipt size={20} />}
          title={t('invoices.total_count')}
          value={total}
          accent="purple"
        />
        <StatCard
          icon={<FileCheck size={20} />}
          title={t('invoices.with_pdf')}
          value={withPdf}
          accent="emerald"
        />
        <StatCard
          icon={<FileWarning size={20} />}
          title={t('invoices.without_pdf')}
          value={withoutPdf}
          accent="amber"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={invoices}
            loading={isLoading}
            emptyMessage={t('invoices.empty')}
          />

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination page={page} pages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Invoice Modal */}
      <Modal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        title={t('invoices.generate_title')}
      >
        <div className="space-y-4">
          <Input
            label={t('invoices.order_id')}
            type="number"
            value={genOrderId}
            onChange={(e) => setGenOrderId(e.target.value)}
            placeholder="1001"
          />
          <Input
            label={t('invoices.buyer_name')}
            value={genBuyerName}
            onChange={(e) => setGenBuyerName(e.target.value)}
            placeholder={t('invoices.buyer_name_placeholder')}
          />
          <Input
            label={t('invoices.invoice_date')}
            type="date"
            value={genDate}
            onChange={(e) => setGenDate(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowGenerate(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleGenerate}
              loading={generateMutation.isPending}
              disabled={!genOrderId || !genBuyerName.trim()}
            >
              {t('invoices.generate')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        open={showDetail}
        onClose={closeDetail}
        title={t('invoices.detail_title')}
        className="max-w-2xl"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
          </div>
        ) : detailInvoice ? (
          <div className="space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-text-muted">{t('invoices.number')}</span>
                <p className="text-sm font-mono font-medium text-text-primary">{detailInvoice.invoice_number}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">{t('invoices.order_id')}</span>
                <p className="text-sm text-text-primary">#{detailInvoice.order_id}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">{t('invoices.platform')}</span>
                <p className="text-sm text-text-primary">
                  {detailInvoice.platform ? (
                    <span className="inline-flex items-center rounded-full bg-accent-purple/15 px-2 py-0.5 text-xs font-medium text-accent-purple">
                      {detailInvoice.platform}
                    </span>
                  ) : '-'}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted">{t('invoices.date')}</span>
                <p className="text-sm text-text-primary">{formatDate(detailInvoice.created_at)}</p>
              </div>
            </div>

            {/* Order info */}
            {detailInvoice.order && (
              <div className="rounded-lg border border-border bg-bg-input/50 p-3">
                <span className="text-xs font-medium text-text-muted block mb-2">{t('invoices.order_info')}</span>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-muted text-xs">{t('invoices.status')}</span>
                    <p className="text-text-primary">{(detailInvoice.order as Record<string, unknown>).status as string || '-'}</p>
                  </div>
                  <div>
                    <span className="text-text-muted text-xs">{t('invoices.platform_order_id')}</span>
                    <p className="text-text-primary font-mono text-xs">{(detailInvoice.order as Record<string, unknown>).platform_order_id as string || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Seller / Buyer */}
            {taxDetails && (taxDetails.seller || taxDetails.buyer) && (
              <div className="grid grid-cols-2 gap-4">
                {taxDetails.seller && (
                  <div className="rounded-lg border border-border p-3">
                    <span className="text-xs font-medium text-text-muted block mb-1">{t('invoices.seller')}</span>
                    <p className="text-sm text-text-primary">{taxDetails.seller.name || '-'}</p>
                    {taxDetails.seller.address && <p className="text-xs text-text-secondary mt-0.5">{taxDetails.seller.address}</p>}
                    {taxDetails.seller.registration_number && (
                      <p className="text-xs text-text-muted mt-0.5 font-mono">{taxDetails.seller.registration_number}</p>
                    )}
                  </div>
                )}
                {taxDetails.buyer && (
                  <div className="rounded-lg border border-border p-3">
                    <span className="text-xs font-medium text-text-muted block mb-1">{t('invoices.buyer')}</span>
                    <p className="text-sm text-text-primary">{taxDetails.buyer.name || '-'}</p>
                    {taxDetails.buyer.address && <p className="text-xs text-text-secondary mt-0.5">{taxDetails.buyer.address}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Items table */}
            {taxDetails?.items && taxDetails.items.length > 0 && (
              <div>
                <span className="text-xs font-medium text-text-muted block mb-2">{t('invoices.items')}</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-text-muted">
                        <th className="pb-2 pr-3">{t('invoices.item_sku')}</th>
                        <th className="pb-2 pr-3 text-right">{t('invoices.item_qty')}</th>
                        <th className="pb-2 pr-3 text-right">{t('invoices.item_price')}</th>
                        <th className="pb-2 pr-3 text-right">{t('invoices.item_tax_rate')}</th>
                        <th className="pb-2 pr-3 text-right">{t('invoices.item_tax')}</th>
                        <th className="pb-2 text-right">{t('invoices.item_subtotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxDetails.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-border/50">
                          <td className="py-2 pr-3">
                            <div className="font-mono text-xs">{item.sku || '-'}</div>
                            {item.name && <div className="text-xs text-text-muted">{item.name}</div>}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{item.quantity ?? '-'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{item.unit_price != null ? formatCurrency(item.unit_price) : '-'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{item.tax_rate != null ? `${item.tax_rate}%` : '-'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{item.tax_amount != null ? formatCurrency(item.tax_amount) : '-'}</td>
                          <td className="py-2 text-right tabular-nums font-medium">{item.subtotal != null ? formatCurrency(item.subtotal) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-3 flex flex-col items-end gap-1 border-t border-border pt-3">
                  {taxDetails.subtotal != null && (
                    <div className="flex gap-8 text-sm">
                      <span className="text-text-muted">{t('invoices.subtotal')}</span>
                      <span className="tabular-nums">{formatCurrency(taxDetails.subtotal)}</span>
                    </div>
                  )}
                  {taxDetails.tax_total != null && (
                    <div className="flex gap-8 text-sm">
                      <span className="text-text-muted">{t('invoices.tax')}</span>
                      <span className="tabular-nums">{formatCurrency(taxDetails.tax_total)}</span>
                    </div>
                  )}
                  {taxDetails.total != null && (
                    <div className="flex gap-8 text-sm font-bold">
                      <span className="text-text-primary">{t('invoices.total')}</span>
                      <span className="tabular-nums text-accent-purple">{formatCurrency(taxDetails.total)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fallback: raw JSON if no structured items */}
            {taxDetails && !taxDetails.items && (
              <div>
                <span className="text-xs text-text-muted block mb-1">{t('invoices.detail')}</span>
                <pre className="text-xs bg-bg-input rounded-lg p-3 overflow-x-auto text-text-secondary max-h-60">
                  {JSON.stringify(taxDetails, null, 2)}
                </pre>
              </div>
            )}

            {/* PDF actions */}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {detailInvoice.pdf_url ? (
                <Button size="sm" onClick={() => handleDownloadPdf(detailInvoice.id)}>
                  <Download size={14} />
                  {t('invoices.download_pdf')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => pdfMutation.mutate(detailInvoice.id)}
                  loading={pdfMutation.isPending}
                >
                  <FileText size={14} />
                  {t('invoices.generate_pdf')}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
