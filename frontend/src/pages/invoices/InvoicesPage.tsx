import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { invoicesApi, type Invoice } from '@/api/endpoints/invoices'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DataTable, type Column } from '@/components/data/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatCurrency } from '@/utils/format'
import { Download, FileText, Eye } from 'lucide-react'

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

export default function InvoicesPage() {
  const { t } = useTranslation()
  const { addToast } = useUIStore()
  const { page, limit, setPage } = usePagination()

  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Detail modal
  const [showDetail, setShowDetail] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<InvoiceRow | null>(null)

  // PDF generation
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null)

  const fetchInvoices = useCallback(async (pg: number) => {
    setLoading(true)
    try {
      const res = await invoicesApi.list((pg - 1) * limit, limit)
      setInvoices(res.invoices as InvoiceRow[])
      setTotal(res.total)
    } catch {
      addToast('error', t('invoices.empty'))
    } finally {
      setLoading(false)
    }
  }, [limit, addToast, t])

  // Load on mount and page change
  useState(() => { fetchInvoices(page) })
  const handlePageChange = (pg: number) => {
    setPage(pg)
    fetchInvoices(pg)
  }

  const openDetail = (inv: InvoiceRow) => {
    setDetailInvoice(inv)
    setShowDetail(true)
  }

  const handleGeneratePdf = async (id: number) => {
    setGeneratingPdfId(id)
    try {
      await invoicesApi.generatePdf(id)
      addToast('success', t('invoices.pdf_generated'))
      fetchInvoices(page)
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('already')) {
        addToast('info', t('invoices.pdf_exists'))
      } else {
        addToast('error', msg)
      }
    } finally {
      setGeneratingPdfId(null)
    }
  }

  const handleDownloadPdf = (id: number) => {
    const token = localStorage.getItem('erp_token') || ''
    window.open(`${invoicesApi.downloadPdfUrl(id)}?token=${token}`, '_blank')
  }

  const handleExportCsv = () => {
    const token = localStorage.getItem('erp_token') || ''
    window.open(`${invoicesApi.exportCsvUrl()}?token=${token}`, '_blank')
  }

  const totalPages = Math.ceil(total / limit)

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
          <Button size="sm" variant="secondary" onClick={() => openDetail(row)}>
            <Eye size={14} />
          </Button>
          {row.pdf_url ? (
            <Button size="sm" variant="secondary" onClick={() => handleDownloadPdf(row.id)}>
              <Download size={14} />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleGeneratePdf(row.id)}
              loading={generatingPdfId === row.id}
              disabled={generatingPdfId !== null}
            >
              <FileText size={14} />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // Parse tax_details for detail modal
  let taxDetails: Record<string, unknown> | null = null
  if (detailInvoice?.tax_details) {
    try {
      taxDetails = typeof detailInvoice.tax_details === 'string'
        ? JSON.parse(detailInvoice.tax_details)
        : detailInvoice.tax_details as Record<string, unknown>
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('invoices.title')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('invoices.subtitle')}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleExportCsv}>
          <Download size={14} />
          CSV
        </Button>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={invoices}
            loading={loading}
            emptyMessage={t('invoices.empty')}
          />

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination page={page} pages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Modal */}
      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={t('invoices.detail_title')}
      >
        {detailInvoice && (
          <div className="space-y-4">
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
                <p className="text-sm text-text-primary">{detailInvoice.platform || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">{t('invoices.amount')}</span>
                <p className="text-sm font-medium text-text-primary">
                  {detailInvoice.total_amount != null ? formatCurrency(detailInvoice.total_amount) : '-'}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted">{t('invoices.date')}</span>
                <p className="text-sm text-text-primary">{formatDate(detailInvoice.created_at)}</p>
              </div>
            </div>

            {taxDetails && (
              <div>
                <span className="text-xs text-text-muted block mb-1">{t('invoices.detail')}</span>
                <pre className="text-xs bg-bg-input rounded-lg p-3 overflow-x-auto text-text-secondary max-h-60">
                  {JSON.stringify(taxDetails, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
