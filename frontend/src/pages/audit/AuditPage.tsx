import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Filter, X, Eye, RotateCcw } from 'lucide-react'

import { auditApi, type AuditLog, type RestorableLog } from '@/api/endpoints/audit'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'

const RESOURCE_TYPES = ['order', 'product', 'distributor', 'commission', 'wallet', 'shipment', 'return', 'customer']

type Tab = 'logs' | 'recovery'

export default function AuditPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)
  const { page, limit, setPage, resetPage } = usePagination(50)

  const [activeTab, setActiveTab] = useState<Tab>('logs')
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Recovery state
  const [recoveryPage, setRecoveryPage] = useState(1)
  const [snapshotModal, setSnapshotModal] = useState<RestorableLog | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<RestorableLog | null>(null)

  if (!isAdmin) {
    return <div className="flex items-center justify-center py-20"><p className="text-text-muted">{t('common.accessDenied', 'Access denied')}</p></div>
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, limit, action, resourceType, startDate, endDate }],
    queryFn: () => auditApi.list({
      offset: (page - 1) * limit, limit,
      action: action || undefined,
      resource_type: resourceType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
    enabled: activeTab === 'logs',
  })

  const { data: restorableData, isLoading: restorableLoading } = useQuery({
    queryKey: ['restorable-logs', recoveryPage],
    queryFn: () => auditApi.listRestorable({ offset: (recoveryPage - 1) * 50, limit: 50 }),
    enabled: activeTab === 'recovery',
  })

  const restoreMutation = useMutation({
    mutationFn: (logId: number) => auditApi.restore(logId),
    onSuccess: (data) => {
      addToast(
        'success',
        t('audit.restoreSuccess', 'Restored {{table}} #{{id}}', { table: data.restored.table, id: data.restored.id }),
      )
      setConfirmRestore(null)
      queryClient.invalidateQueries({ queryKey: ['restorable-logs'] })
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)
  const hasFilters = action || resourceType || startDate || endDate

  const restorableLogs = restorableData?.logs ?? []
  const restorableTotal = restorableData?.total ?? 0
  const restorableTotalPages = Math.ceil(restorableTotal / 50)

  const columns = useMemo<Column<AuditLog>[]>(() => [
    { key: 'id', header: 'ID', className: 'w-16', render: (row) => <span className="font-mono text-xs text-text-muted">{row.id}</span> },
    { key: 'action', header: t('audit.action', 'Action'), render: (row) => <span className="font-medium text-accent-purple text-xs uppercase">{row.action}</span> },
    { key: 'resource_type', header: t('audit.resourceType', 'Resource'), render: (row) => <span className="text-sm text-text-secondary">{row.resource_type}</span> },
    { key: 'resource_id', header: t('audit.resourceId', 'Resource ID'), hideOnMobile: true, render: (row) => <span className="font-mono text-xs text-text-muted">{row.resource_id || '-'}</span> },
    { key: 'distributor_id', header: t('audit.user', 'User'), hideOnMobile: true, render: (row) => <span className="text-sm text-text-muted">{row.distributor_id ? `#${row.distributor_id}` : 'System'}</span> },
    {
      key: 'details', header: t('audit.details', 'Details'), hideOnMobile: true,
      render: (row) => {
        if (!row.details) return <span className="text-text-muted">-</span>
        const truncated = row.details.length > 60 ? row.details.slice(0, 60) + '...' : row.details
        return <span className="text-xs text-text-muted" title={row.details}>{truncated}</span>
      },
    },
    { key: 'created_at', header: t('common.date', 'Date'), render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span> },
  ], [t])

  const recoveryColumns = useMemo<Column<RestorableLog>[]>(() => [
    { key: 'id', header: 'ID', className: 'w-16', render: (row) => <span className="font-mono text-xs text-text-muted">{row.id}</span> },
    { key: 'action', header: t('audit.action', 'Action'), render: (row) => <span className="font-medium text-accent-purple text-xs uppercase">{row.action}</span> },
    { key: 'resource_type', header: t('audit.resourceType', 'Resource'), render: (row) => <span className="text-sm text-text-secondary">{row.resource_type}</span> },
    { key: 'resource_id', header: t('audit.resourceId', 'Resource ID'), hideOnMobile: true, render: (row) => <span className="font-mono text-xs text-text-muted">{row.resource_id || '-'}</span> },
    { key: 'distributor_name', header: t('audit.user', 'User'), hideOnMobile: true, render: (row) => <span className="text-sm text-text-muted">{row.distributor_name || 'System'}</span> },
    { key: 'created_at', header: t('common.date', 'Date'), render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span> },
    {
      key: 'actions', header: t('common.actions', 'Actions'),
      render: (row) => (
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => setSnapshotModal(row)}>
            <Eye size={14} /> {t('audit.view', 'View')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirmRestore(row)}>
            <RotateCcw size={14} /> {t('audit.restore', 'Restore')}
          </Button>
        </div>
      ),
    },
  ], [t])

  function formatJson(raw: string | null) {
    if (!raw) return '-'
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('audit.title', 'Audit Logs')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('audit.subtitle', 'System activity and change history')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'logs' ? 'border-b-2 border-accent-purple text-accent-purple' : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {t('audit.tabLogs', 'Logs')}
        </button>
        <button
          onClick={() => setActiveTab('recovery')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'recovery' ? 'border-b-2 border-accent-purple text-accent-purple' : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {t('audit.tabRecovery', 'Recovery')}
        </button>
      </div>

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} />{t('common.filters', 'Filters')}
              {hasFilters && <span className="ml-1 px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple rounded-full text-xs">{[action, resourceType, startDate, endDate].filter(Boolean).length}</span>}
            </Button>
            {hasFilters && <Button size="sm" variant="secondary" onClick={() => { setAction(''); setResourceType(''); setStartDate(''); setEndDate(''); resetPage() }}><X size={16} />{t('common.clear', 'Clear')}</Button>}
          </div>

          {showFilters && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Input label={t('audit.action', 'Action')} value={action} onChange={(e) => { setAction(e.target.value); resetPage() }} placeholder="e.g. CREATE_ORDER" />
                  <Select label={t('audit.resourceType', 'Resource Type')} value={resourceType} onChange={(e) => { setResourceType(e.target.value); resetPage() }}>
                    <option value="">{t('common.all', 'All')}</option>
                    {RESOURCE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  <Input label={t('audit.startDate', 'Start Date')} type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); resetPage() }} />
                  <Input label={t('audit.endDate', 'End Date')} type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); resetPage() }} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <DataTable columns={columns} data={logs} loading={isLoading} emptyMessage={t('audit.empty', 'No audit logs found')} keyField="id" />
            </CardContent>
          </Card>

          {totalPages > 1 && <Pagination page={page} pages={totalPages} onPageChange={setPage} />}
        </>
      )}

      {/* Recovery Tab */}
      {activeTab === 'recovery' && (
        <>
          <Card>
            <CardContent className="p-0">
              <DataTable columns={recoveryColumns} data={restorableLogs} loading={restorableLoading} emptyMessage={t('audit.emptyRestorable', 'No restorable entries')} keyField="id" />
            </CardContent>
          </Card>

          {restorableTotalPages > 1 && <Pagination page={recoveryPage} pages={restorableTotalPages} onPageChange={setRecoveryPage} />}
        </>
      )}

      {/* Snapshot Modal */}
      {snapshotModal && (
        <Modal
          open={true}
          onClose={() => setSnapshotModal(null)}
          title={t('audit.snapshotTitle', 'Snapshot: {{type}} #{{id}}', { type: snapshotModal.resource_type, id: snapshotModal.resource_id })}
          className="max-w-4xl"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-text-secondary">{t('audit.before', 'Before')}</h4>
              <pre className="max-h-80 overflow-auto rounded-lg bg-bg-base p-3 text-xs text-text-muted">
                {formatJson(snapshotModal.before_data)}
              </pre>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-text-secondary">{t('audit.after', 'After')}</h4>
              <pre className="max-h-80 overflow-auto rounded-lg bg-bg-base p-3 text-xs text-text-muted">
                {formatJson(snapshotModal.after_data)}
              </pre>
            </div>
          </div>
        </Modal>
      )}

      {/* Restore Confirmation Modal */}
      {confirmRestore && (
        <Modal
          open={true}
          onClose={() => setConfirmRestore(null)}
          title={t('audit.confirmRestoreTitle', 'Confirm Restore')}
        >
          <p className="mb-4 text-sm text-text-secondary">
            {t('audit.confirmRestoreMsg', 'This will restore {{type}} #{{id}} to its previous state. This action cannot be undone.', {
              type: confirmRestore.resource_type,
              id: confirmRestore.resource_id,
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmRestore(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate(confirmRestore.id)}
            >
              <RotateCcw size={16} /> {t('audit.restore', 'Restore')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
