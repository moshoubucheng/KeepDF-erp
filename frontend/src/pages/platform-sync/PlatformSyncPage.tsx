import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Loader2 } from 'lucide-react'

import { platformSyncApi, type SyncLog } from '@/api/endpoints/platform-sync'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

const PLATFORMS = ['TIKTOK', 'TEMU', 'RAKUTEN'] as const
type Platform = (typeof PLATFORMS)[number]

const PLATFORM_COLORS: Record<Platform, string> = {
  TIKTOK: 'bg-pink-500/10 text-pink-500 border-pink-500/30',
  TEMU: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  RAKUTEN: 'bg-red-500/10 text-red-500 border-red-500/30',
}

export default function PlatformSyncPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)
  const [filterPlatform, setFilterPlatform] = useState('')

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-muted">{t('common.accessDenied', 'Access denied')}</p>
      </div>
    )
  }

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['sync-logs', filterPlatform],
    queryFn: () =>
      platformSyncApi.logs({
        platform: filterPlatform || undefined,
        limit: 50,
      }),
  })

  const syncMutation = useMutation({
    mutationFn: (platform: string) => platformSyncApi.sync(platform),
    onSuccess: (data) => {
      addToast(
        'success',
        t('platformSync.syncSuccess', '{{platform}}: {{fetched}} fetched, {{queued}} queued', {
          platform: data.platform,
          fetched: data.ordersFetched,
          queued: data.ordersQueued,
        }),
      )
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] })
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const logColumns = useMemo<Column<SyncLog>[]>(
    () => [
      {
        key: 'platform',
        header: t('platformSync.platform', 'Platform'),
        render: (row) => (
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[row.platform as Platform] || 'text-text-muted'}`}
          >
            {row.platform}
          </span>
        ),
      },
      {
        key: 'trigger',
        header: t('platformSync.trigger', 'Trigger'),
        render: (row) => <span className="text-xs text-text-secondary">{row.trigger}</span>,
      },
      {
        key: 'status',
        header: t('common.status', 'Status'),
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'orders_fetched',
        header: t('platformSync.fetched', 'Fetched'),
        render: (row) => <span className="font-mono text-sm">{row.orders_fetched}</span>,
      },
      {
        key: 'orders_created',
        header: t('platformSync.created', 'Created'),
        hideOnMobile: true,
        render: (row) => <span className="font-mono text-sm">{row.orders_created}</span>,
      },
      {
        key: 'errors',
        header: t('platformSync.errors', 'Errors'),
        hideOnMobile: true,
        render: (row) =>
          row.errors ? (
            <span className="text-xs text-accent-red" title={row.errors}>
              {row.errors.length > 40 ? row.errors.slice(0, 40) + '...' : row.errors}
            </span>
          ) : (
            <span className="text-text-muted">-</span>
          ),
      },
      {
        key: 'started_at',
        header: t('platformSync.startedAt', 'Started'),
        render: (row) => (
          <span className="text-xs text-text-muted">{formatDate(row.started_at)}</span>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          <RefreshCw className="mr-2 inline h-6 w-6" />
          {t('platformSync.title', 'Platform Sync')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('platformSync.subtitle', 'Manually trigger platform synchronization and view logs')}
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Card key={platform}>
            <CardContent className="flex flex-col items-center gap-3 p-6">
              <span
                className={`inline-block rounded-full border px-3 py-1 text-sm font-bold ${PLATFORM_COLORS[platform]}`}
              >
                {platform}
              </span>
              <Button
                size="sm"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate(platform)}
              >
                {syncMutation.isPending && syncMutation.variables === platform ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {t('platformSync.syncNow', 'Sync Now')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Logs */}
      <div className="flex items-center gap-3">
        <Select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="w-48"
        >
          <option value="">{t('common.all', 'All')}</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={logColumns}
            data={logsData?.logs ?? []}
            loading={isLoading}
            emptyMessage={t('platformSync.emptyLogs', 'No sync logs')}
            keyField="id"
          />
        </CardContent>
      </Card>
    </div>
  )
}
