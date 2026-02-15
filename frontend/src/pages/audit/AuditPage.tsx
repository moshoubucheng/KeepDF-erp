import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Filter, X } from 'lucide-react'

import { auditApi, type AuditLog } from '@/api/endpoints/audit'
import { useAuthStore } from '@/stores/auth.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'

const RESOURCE_TYPES = ['order', 'product', 'distributor', 'commission', 'wallet', 'shipment', 'return', 'customer']

export default function AuditPage() {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const { page, limit, setPage, resetPage } = usePagination(50)

  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

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
  })

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)
  const hasFilters = action || resourceType || startDate || endDate

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('audit.title', 'Audit Logs')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('audit.subtitle', 'System activity and change history')}</p>
      </div>

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
    </div>
  )
}
