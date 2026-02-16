import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, DollarSign, FileText, Receipt, Scale } from 'lucide-react'
import { financialReportsApi } from '@/api/endpoints/financial-reports'
import { useUIStore } from '@/stores/ui.store'
import { formatCurrency } from '@/utils/format'
import { downloadCsv } from '@/utils/download'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/data/DataTable'
import { cn } from '@/utils/cn'

type Tab = 'pnl' | 'balance' | 'cashflow' | 'tax'

const TABS: { value: Tab; icon: React.ReactNode; labelKey: string }[] = [
  { value: 'pnl', icon: <FileText size={16} />, labelKey: 'financial.pnl' },
  { value: 'balance', icon: <Scale size={16} />, labelKey: 'financial.balance_sheet' },
  { value: 'cashflow', icon: <DollarSign size={16} />, labelKey: 'financial.cash_flow' },
  { value: 'tax', icon: <Receipt size={16} />, labelKey: 'financial.tax_summary' },
]

export default function FinancialReportsPage() {
  const { t } = useTranslation()
  const addToast = useUIStore((s) => s.addToast)

  const [tab, setTab] = useState<Tab>('pnl')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [csvExporting, setCsvExporting] = useState(false)

  const dateRange = {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  }

  // P&L query
  const pnlQuery = useQuery({
    queryKey: ['financial-reports', 'pnl', startDate, endDate],
    queryFn: () => financialReportsApi.pnl(dateRange),
    enabled: tab === 'pnl',
    staleTime: 60_000,
  })

  // Balance sheet query
  const balanceQuery = useQuery({
    queryKey: ['financial-reports', 'balance-sheet'],
    queryFn: () => financialReportsApi.balanceSheet(),
    enabled: tab === 'balance',
    staleTime: 60_000,
  })

  // Reconciliation (cash flow) query
  const reconciliationQuery = useQuery({
    queryKey: ['financial-reports', 'reconciliation', startDate, endDate],
    queryFn: () => financialReportsApi.reconciliation(dateRange),
    enabled: tab === 'cashflow',
    staleTime: 60_000,
  })

  // Tax summary query
  const taxQuery = useQuery({
    queryKey: ['financial-reports', 'tax-summary', startDate, endDate],
    queryFn: () => financialReportsApi.taxSummary(dateRange),
    enabled: tab === 'tax',
    staleTime: 60_000,
  })

  // CSV export handler
  async function handleExportCsv() {
    setCsvExporting(true)
    try {
      let csv: string | undefined
      const dateStr = new Date().toISOString().slice(0, 10)

      if (tab === 'pnl') {
        csv = await financialReportsApi.pnlExport(dateRange)
        if (csv) downloadCsv(`pnl_${dateStr}.csv`, csv)
      } else if (tab === 'tax') {
        csv = await financialReportsApi.taxSummaryExport(dateRange)
        if (csv) downloadCsv(`tax_summary_${dateStr}.csv`, csv)
      } else if (tab === 'cashflow') {
        csv = await financialReportsApi.reconciliationExport(dateRange)
        if (csv) downloadCsv(`reconciliation_${dateStr}.csv`, csv)
      }

      if (csv) {
        addToast('success', t('financial.export_success'))
      }
    } catch (err) {
      addToast('error', (err as Error).message || t('financial.export_error'))
    } finally {
      setCsvExporting(false)
    }
  }

  // Cash flow transactions columns
  const transactionColumns = useMemo<Column<{ type: string; count: number; total: number }>[]>(
    () => [
      {
        key: 'type',
        header: t('financial.tx_type'),
        render: (row) => <span className="font-medium text-text-primary">{row.type}</span>,
      },
      {
        key: 'count',
        header: t('financial.count'),
        render: (row) => <span className="tabular-nums">{row.count}</span>,
      },
      {
        key: 'total',
        header: t('financial.total'),
        render: (row) => (
          <span className={cn('tabular-nums font-medium', row.total >= 0 ? 'text-accent-emerald' : 'text-accent-red')}>
            {formatCurrency(row.total)}
          </span>
        ),
      },
    ],
    [t],
  )

  // Tax breakdown columns
  const taxColumns = useMemo<Column<{ rate_label: string; order_count: number; taxable_amount: number; tax_amount: number }>[]>(
    () => [
      {
        key: 'rate_label',
        header: t('financial.tax_rate'),
        render: (row) => <span className="font-medium text-text-primary">{row.rate_label}</span>,
      },
      {
        key: 'order_count',
        header: t('financial.orders'),
        render: (row) => <span className="tabular-nums">{row.order_count}</span>,
      },
      {
        key: 'taxable_amount',
        header: t('financial.total_taxable'),
        render: (row) => <span className="tabular-nums">{formatCurrency(row.taxable_amount)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'tax_amount',
        header: t('financial.tax'),
        render: (row) => (
          <span className="tabular-nums font-medium text-accent-purple">{formatCurrency(row.tax_amount)}</span>
        ),
      },
    ],
    [t],
  )

  const pnl = pnlQuery.data
  const balance = balanceQuery.data
  const reconciliation = reconciliationQuery.data
  const tax = taxQuery.data

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('financial.title')}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {t('financial.subtitle')}
        </p>
      </div>

      {/* Tab selector + date range + export */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Tab buttons */}
            <div className="flex items-center rounded-lg border border-border bg-bg-input p-0.5">
              {TABS.map(({ value, icon, labelKey }) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    tab === value
                      ? 'bg-accent-purple text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {icon}
                  <span className="hidden sm:inline">{t(labelKey)}</span>
                </button>
              ))}
            </div>

            {/* Date range */}
            {tab !== 'balance' && (
              <>
                <div className="w-40">
                  <Input
                    type="date"
                    label={t('financial.start_date')}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <Input
                    type="date"
                    label={t('financial.end_date')}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Export CSV */}
            <div className="ml-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCsv}
                loading={csvExporting}
                disabled={tab === 'balance'}
              >
                <Download size={14} />
                {t('financial.export_csv')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* P&L Tab */}
      {tab === 'pnl' && (
        <Card>
          <CardContent>
            <h3 className="text-text-primary font-semibold text-base mb-4">
              {t('financial.pnl_summary')}
            </h3>
            {pnlQuery.isLoading ? (
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-5 w-full rounded bg-bg-input" />
                ))}
              </div>
            ) : pnl ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-text-secondary">{t('financial.revenue')}</span>
                  <span className="text-sm font-semibold text-accent-emerald tabular-nums">
                    {formatCurrency(pnl.revenue.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-text-secondary">{t('financial.orders')}</span>
                  <span className="text-sm text-text-primary tabular-nums">
                    {pnl.revenue.orders}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-text-secondary">{t('financial.cogs')}</span>
                  <span className="text-sm font-medium text-text-primary tabular-nums">
                    {formatCurrency(pnl.cogs)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm font-semibold text-text-primary">{t('financial.gross_profit')}</span>
                  <span className={cn('text-sm font-semibold tabular-nums', pnl.gross_profit >= 0 ? 'text-accent-emerald' : 'text-accent-red')}>
                    {formatCurrency(pnl.gross_profit)} ({pnl.gross_margin}%)
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-text-secondary">{t('financial.commission')}</span>
                  <span className="text-sm text-text-muted tabular-nums">
                    {formatCurrency(pnl.expenses.commission)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-text-secondary">{t('financial.refunds')}</span>
                  <span className="text-sm text-text-muted tabular-nums">
                    {formatCurrency(pnl.expenses.refunds)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-base font-bold text-text-primary">{t('financial.net_profit')}</span>
                  <span className={cn('text-base font-bold tabular-nums', pnl.net_profit >= 0 ? 'text-accent-emerald' : 'text-accent-red')}>
                    {formatCurrency(pnl.net_profit)} ({pnl.net_margin}%)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">{t('financial.no_data')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Balance Sheet Tab */}
      {tab === 'balance' && (
        <Card>
          <CardContent>
            <h3 className="text-text-primary font-semibold text-base mb-4">
              {t('financial.balance_sheet')}
              {balance?.as_of && (
                <span className="ml-2 text-xs text-text-muted font-normal">
                  {t('financial.as_of')} {balance.as_of}
                </span>
              )}
            </h3>
            {balanceQuery.isLoading ? (
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-5 w-full rounded bg-bg-input" />
                ))}
              </div>
            ) : balance ? (
              <div className="space-y-6">
                {/* Assets */}
                <div>
                  <h4 className="text-sm font-semibold text-accent-emerald mb-2">
                    {t('financial.assets')}
                  </h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-text-secondary">{t('financial.cash')}</span>
                      <span className="text-sm tabular-nums">{formatCurrency(balance.assets.cash)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-text-secondary">{t('financial.frozen')}</span>
                      <span className="text-sm tabular-nums">{formatCurrency(balance.assets.frozen)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-text-secondary">{t('financial.inventory')}</span>
                      <span className="text-sm tabular-nums">{formatCurrency(balance.assets.inventory)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-t border-border">
                      <span className="text-sm font-semibold text-text-primary">{t('financial.total_assets')}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(balance.assets.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities */}
                <div>
                  <h4 className="text-sm font-semibold text-accent-red mb-2">
                    {t('financial.liabilities')}
                  </h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-text-secondary">{t('financial.pending_refunds')}</span>
                      <span className="text-sm tabular-nums">{formatCurrency(balance.liabilities.pending_refunds)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-text-secondary">{t('financial.pending_commissions')}</span>
                      <span className="text-sm tabular-nums">{formatCurrency(balance.liabilities.pending_commissions)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-t border-border">
                      <span className="text-sm font-semibold text-text-primary">{t('financial.total_liabilities')}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(balance.liabilities.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Equity */}
                <div>
                  <h4 className="text-sm font-semibold text-accent-purple mb-2">
                    {t('financial.equity')}
                  </h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center justify-between py-1 border-t border-border">
                      <span className="text-sm font-semibold text-text-primary">{t('financial.total_equity')}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(balance.equity)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">{t('financial.no_data')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cash Flow Tab */}
      {tab === 'cashflow' && (
        <>
          {/* Summary */}
          <Card>
            <CardContent>
              <h3 className="text-text-primary font-semibold text-base mb-4">
                {t('financial.reconciliation')}
              </h3>
              {reconciliationQuery.isLoading ? (
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-5 w-full rounded bg-bg-input" />
                  ))}
                </div>
              ) : reconciliation ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-text-secondary">{t('financial.current_balance')}</span>
                    <span className="text-sm font-semibold text-accent-emerald tabular-nums">{formatCurrency(reconciliation.current_balance)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-text-secondary">{t('financial.frozen')}</span>
                    <span className="text-sm tabular-nums text-text-muted">{formatCurrency(reconciliation.current_frozen)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-semibold text-text-primary">{t('financial.available_balance')}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(reconciliation.current_balance - reconciliation.current_frozen)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t('financial.no_data')}</p>
              )}
            </CardContent>
          </Card>

          {/* Transactions */}
          {reconciliation && reconciliation.transactions.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="text-text-primary font-semibold text-base mb-2">
                  {t('financial.transactions')}
                </h3>
              </CardContent>
              <CardContent className="p-0">
                <DataTable
                  columns={transactionColumns}
                  data={reconciliation.transactions}
                  keyField="type"
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Tax Summary Tab */}
      {tab === 'tax' && (
        <>
          {/* Total Tax */}
          {tax && (
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <h3 className="text-text-primary font-semibold text-base">
                    {t('financial.total_tax')}
                  </h3>
                  <span className="text-2xl font-bold text-accent-purple tabular-nums">
                    {formatCurrency(tax.total_tax)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tax Breakdown */}
          <Card>
            <CardContent>
              <h3 className="text-text-primary font-semibold text-base mb-2">
                {t('financial.tax_breakdown')}
              </h3>
            </CardContent>
            <CardContent className="p-0">
              <DataTable
                columns={taxColumns}
                data={tax?.breakdown ?? []}
                loading={taxQuery.isLoading}
                emptyMessage={t('financial.no_tax_data')}
                keyField="rate_label"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
