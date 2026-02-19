import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Bot, Calculator, Download, Package, TrendingUp, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { forecastingApi, type Forecast, type ReorderSuggestion } from '@/api/endpoints/forecasting'
import { aiApi, type AiForecastItem } from '@/api/endpoints/ai'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate, formatNumber } from '@/utils/format'
import { downloadCsv } from '@/utils/download'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatCard } from '@/components/data/StatCard'
import { cn } from '@/utils/cn'

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: 'text-accent-red',
  HIGH: 'text-amber-400',
  MEDIUM: 'text-accent-purple',
  LOW: 'text-accent-emerald',
}

const URGENCY_BG: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-accent-red',
  HIGH: 'bg-amber-500/15 text-amber-400',
  MEDIUM: 'bg-purple-500/15 text-accent-purple',
  LOW: 'bg-emerald-500/15 text-accent-emerald',
}

const URGENCY_ICON: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' }

function AiForecastRow({ item }: { item: AiForecastItem }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-bg-card-hover/50 transition-colors">
      <span className="text-base mt-0.5">{URGENCY_ICON[item.urgency] || '⚪'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-medium text-accent-purple">{item.sku}</span>
          <span className="text-sm text-text-primary truncate">{item.name}</span>
        </div>
        <p className="text-xs text-text-muted mt-0.5">{item.reason}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
          <span>{t('forecasting.aiStock')}: {item.currentStock ?? 0}</span>
          <span>{t('forecasting.aiDaysLeft')}: {item.daysOfStock ?? 0}</span>
          {(item.incoming ?? 0) > 0 && <span>{t('forecasting.aiIncoming')}: {item.incoming}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {item.action === '発注' ? (
          <div className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1">
            <ArrowRight className="h-3 w-3 text-purple-600" />
            <span className="text-sm font-semibold text-purple-600">{item.qty}</span>
          </div>
        ) : (
          <span className="text-xs text-text-muted rounded-full bg-bg-card-hover px-3 py-1">{item.action}</span>
        )}
      </div>
    </div>
  )
}

export default function ForecastingPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)
  const { page, limit, setPage } = usePagination(20)

  const [csvExporting, setCsvExporting] = useState(false)
  const [aiExpanded, setAiExpanded] = useState(true)

  // Forecasts list query
  const forecastsQuery = useQuery({
    queryKey: ['forecasting', 'list', { page, limit }],
    queryFn: () => forecastingApi.list({ offset: (page - 1) * limit, limit }),
    staleTime: 60_000,
  })

  // Reorder suggestions query
  const suggestionsQuery = useQuery({
    queryKey: ['forecasting', 'reorder-suggestions'],
    queryFn: () => forecastingApi.reorderSuggestions(),
    staleTime: 60_000,
  })

  const forecasts = forecastsQuery.data?.forecasts ?? []
  const totalForecasts = forecastsQuery.data?.total ?? 0
  const totalPages = Math.ceil(totalForecasts / limit)

  const suggestions = suggestionsQuery.data?.suggestions ?? []
  const suggestionCount = suggestionsQuery.data?.count ?? 0

  // AI forecast mutation
  const aiForecastMutation = useMutation({
    mutationFn: () => aiApi.forecast(),
    onError: (err: Error) => {
      addToast('error', err.message || t('forecasting.aiForecastError'))
    },
  })

  const aiSuggestions = aiForecastMutation.data?.suggestions ?? []

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: () => forecastingApi.calculate(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['forecasting'] })
      addToast('success', t('forecasting.calculateSuccess', `Forecast calculated: ${data.calculated} products`))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('forecasting.calculateError', 'Failed to calculate forecast'))
    },
  })

  // CSV export
  async function handleExportCsv() {
    setCsvExporting(true)
    try {
      const csv = await forecastingApi.export()
      if (csv) {
        downloadCsv(`forecasting_${new Date().toISOString().slice(0, 10)}.csv`, csv)
        addToast('success', t('forecasting.exportSuccess', 'CSV exported'))
      }
    } catch (err) {
      addToast('error', (err as Error).message || t('forecasting.exportError', 'Export failed'))
    } finally {
      setCsvExporting(false)
    }
  }

  // Stat data
  const criticalCount = suggestions.filter((s) => s.urgency === 'CRITICAL').length
  const avgDaysOfStock = forecasts.length > 0
    ? Math.round(forecasts.reduce((sum, f) => sum + f.days_of_stock, 0) / forecasts.length)
    : 0

  // Reorder suggestion columns
  const suggestionColumns = useMemo<Column<ReorderSuggestion>[]>(
    () => [
      {
        key: 'sku',
        header: t('forecasting.sku', 'SKU'),
        render: (row) => (
          <span className="font-mono text-xs font-medium text-accent-purple">{row.sku}</span>
        ),
      },
      {
        key: 'product_name',
        header: t('forecasting.product', 'Product'),
        render: (row) => (
          <span className="text-sm text-text-primary truncate max-w-[180px] block">
            {row.product_name || '-'}
          </span>
        ),
      },
      {
        key: 'urgency',
        header: t('forecasting.urgency', 'Urgency'),
        render: (row) => (
          <span className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            URGENCY_BG[row.urgency] ?? 'bg-bg-input text-text-muted',
          )}>
            {row.urgency}
          </span>
        ),
      },
      {
        key: 'current_stock',
        header: t('forecasting.currentStock', 'Stock'),
        render: (row) => (
          <span className={cn('tabular-nums', row.current_stock <= 0 ? 'text-accent-red font-semibold' : 'text-text-primary')}>
            {formatNumber(row.current_stock)}
          </span>
        ),
      },
      {
        key: 'days_until_stockout',
        header: t('forecasting.daysUntilStockout', 'Days Left'),
        render: (row) => (
          <span className={cn('tabular-nums', URGENCY_COLORS[row.urgency] ?? 'text-text-primary')}>
            {row.days_until_stockout}
          </span>
        ),
      },
      {
        key: 'reorder_qty',
        header: t('forecasting.reorderQty', 'Reorder Qty'),
        render: (row) => <span className="tabular-nums font-medium">{formatNumber(row.reorder_qty)}</span>,
      },
      {
        key: 'predicted_demand',
        header: t('forecasting.predictedDemand', 'Demand'),
        render: (row) => <span className="tabular-nums text-text-secondary">{formatNumber(row.predicted_demand)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'supplier',
        header: t('forecasting.supplier', 'Supplier'),
        render: (row) => (
          <span className="text-xs text-text-muted">{row.supplier ?? '-'}</span>
        ),
        hideOnMobile: true,
      },
    ],
    [t],
  )

  // Forecast list columns
  const forecastColumns = useMemo<Column<Forecast>[]>(
    () => [
      {
        key: 'sku',
        header: t('forecasting.sku', 'SKU'),
        render: (row) => (
          <span className="font-mono text-xs font-medium text-accent-purple">{row.sku}</span>
        ),
      },
      {
        key: 'product_name',
        header: t('forecasting.product', 'Product'),
        render: (row) => (
          <span className="text-sm text-text-primary truncate max-w-[180px] block">
            {row.product_name || '-'}
          </span>
        ),
      },
      {
        key: 'current_stock',
        header: t('forecasting.currentStock', 'Stock'),
        render: (row) => (
          <span className={cn('tabular-nums', row.current_stock <= 0 ? 'text-accent-red font-semibold' : 'text-text-primary')}>
            {formatNumber(row.current_stock)}
          </span>
        ),
      },
      {
        key: 'daily_velocity',
        header: t('forecasting.velocity', 'Daily Velocity'),
        render: (row) => <span className="tabular-nums text-text-secondary">{row.daily_velocity.toFixed(1)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'days_of_stock',
        header: t('forecasting.daysOfStock', 'Days of Stock'),
        render: (row) => {
          const daysClass = row.days_of_stock <= 7
            ? 'text-accent-red font-semibold'
            : row.days_of_stock <= 14
              ? 'text-amber-400 font-medium'
              : 'text-text-primary'
          return <span className={cn('tabular-nums', daysClass)}>{row.days_of_stock}</span>
        },
      },
      {
        key: 'reorder_point',
        header: t('forecasting.reorderPoint', 'Reorder Point'),
        render: (row) => <span className="tabular-nums">{formatNumber(row.reorder_point)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'safety_stock',
        header: t('forecasting.safetyStock', 'Safety Stock'),
        render: (row) => <span className="tabular-nums text-text-muted">{formatNumber(row.safety_stock)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'calculated_at',
        header: t('forecasting.calculatedAt', 'Calculated'),
        render: (row) => (
          <span className="text-xs text-text-muted">{formatDate(row.calculated_at)}</span>
        ),
        hideOnMobile: true,
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('forecasting.title', 'Forecasting')}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {t('forecasting.subtitle', 'Inventory demand forecasting and reorder suggestions')}
        </p>
      </div>

      {/* Stat cards + actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 flex-1">
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            title={t('forecasting.reorderNeeded', 'Reorder Needed')}
            value={suggestionCount}
            subtitle={`${criticalCount} ${t('forecasting.critical', 'critical')}`}
            accent="amber"
          />
          <StatCard
            icon={<Package className="h-5 w-5" />}
            title={t('forecasting.totalProducts', 'Total Products')}
            value={totalForecasts}
            accent="blue"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            title={t('forecasting.avgDaysOfStock', 'Avg Days of Stock')}
            value={avgDaysOfStock}
            accent="emerald"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            loading={csvExporting}
          >
            <Download size={14} />
            {t('forecasting.exportCsv', 'CSV')}
          </Button>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => calculateMutation.mutate()}
              loading={calculateMutation.isPending}
            >
              <Calculator size={14} />
              {t('forecasting.runForecast', 'Run Forecast')}
            </Button>
          )}
        </div>
      </div>

      {/* AI Smart Replenishment */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-text-primary font-semibold text-base">
                  {t('forecasting.aiTitle')}
                </h3>
                <p className="text-xs text-text-muted">{t('forecasting.aiSubtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aiSuggestions.length > 0 && (
                <button
                  onClick={() => setAiExpanded(!aiExpanded)}
                  className="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
                >
                  {aiExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => aiForecastMutation.mutate()}
                loading={aiForecastMutation.isPending}
              >
                <Bot size={14} />
                {t('forecasting.aiGenerate')}
              </Button>
            </div>
          </div>
        </CardContent>

        {/* AI Results */}
        {aiForecastMutation.isPending && (
          <CardContent className="border-t border-border">
            <div className="flex items-center gap-3 py-4">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-text-muted">{t('forecasting.aiAnalyzing')}</span>
            </div>
          </CardContent>
        )}

        {aiForecastMutation.data?.summary && (
          <CardContent className="border-t border-border">
            <p className="text-sm text-text-primary whitespace-pre-wrap">{aiForecastMutation.data.summary}</p>
          </CardContent>
        )}

        {aiSuggestions.length > 0 && aiExpanded && (
          <CardContent className="border-t border-border p-0">
            <div className="divide-y divide-border">
              {aiSuggestions.map((item) => (
                <AiForecastRow key={item.sku} item={item} />
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Reorder Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" />
              <h3 className="text-text-primary font-semibold text-base">
                {t('forecasting.reorderSuggestions', 'Reorder Suggestions')}
              </h3>
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                {suggestionCount}
              </span>
            </div>
          </CardContent>
          <CardContent className="p-0">
            <DataTable
              columns={suggestionColumns}
              data={suggestions}
              loading={suggestionsQuery.isLoading}
              emptyMessage={t('forecasting.noSuggestions', 'No reorder suggestions')}
              keyField="sku"
            />
          </CardContent>
        </Card>
      )}

      {/* All Forecasts */}
      <Card>
        <CardContent>
          <h3 className="text-text-primary font-semibold text-base">
            {t('forecasting.allForecasts', 'All Forecasts')}
          </h3>
        </CardContent>
        <CardContent className="p-0">
          <DataTable
            columns={forecastColumns}
            data={forecasts}
            loading={forecastsQuery.isLoading}
            emptyMessage={t('forecasting.noForecasts', 'No forecast data. Run forecast calculation to generate data.')}
            keyField="sku"
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
    </div>
  )
}
