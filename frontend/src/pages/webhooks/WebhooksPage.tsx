import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Edit2, Send, FileText } from 'lucide-react'
import { webhooksApi, type WebhookEndpoint, type WebhookLog } from '@/api/endpoints/webhooks'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

const WEBHOOK_EVENTS = [
  'order.created',
  'order.updated',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'product.created',
  'product.updated',
  'inventory.low_stock',
  'commission.settled',
]

export default function WebhooksPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)

  // Endpoint modal
  const [endpointModalOpen, setEndpointModalOpen] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null)
  const [endpointForm, setEndpointForm] = useState({
    url: '',
    events: [] as string[],
    secret: '',
    is_active: true,
  })

  // Logs modal
  const [logsModalOpen, setLogsModalOpen] = useState(false)
  const [logsEndpointId, setLogsEndpointId] = useState<number | null>(null)
  const { page: logsPage, limit: logsLimit, setPage: setLogsPage } = usePagination(20)

  // Endpoints query
  const { data: endpointsData, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => webhooksApi.list(),
  })

  const endpoints = endpointsData?.endpoints ?? []

  // Logs query
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['webhook-logs', logsEndpointId, logsPage, logsLimit],
    queryFn: () => webhooksApi.logs(logsEndpointId!, logsLimit, (logsPage - 1) * logsLimit),
    enabled: logsModalOpen && !!logsEndpointId,
  })

  const logs = logsData?.logs ?? []
  const logsTotal = logsData?.count ?? 0
  const logsTotalPages = Math.ceil(logsTotal / logsLimit)

  // Mutations
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: number }) =>
      webhooksApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      addToast('success', t('webhooks.toggleSuccess', 'Webhook status updated'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('webhooks.toggleError', 'Failed to update webhook status'))
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => webhooksApi.test(id),
    onSuccess: (data) => {
      if (data.success) {
        addToast('success', t('webhooks.testSuccess', 'Test webhook sent successfully'))
      } else {
        addToast('error', data.error || t('webhooks.testFailed', 'Test webhook failed'))
      }
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('webhooks.testError', 'Failed to send test webhook'))
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: { id?: number; url: string; events: string; secret?: string; is_active: number }) => {
      if (data.id) {
        return webhooksApi.update(data.id, {
          url: data.url,
          events: data.events,
          secret: data.secret || undefined,
          is_active: data.is_active,
        })
      }
      return webhooksApi.create({
        url: data.url,
        events: data.events,
        secret: data.secret || undefined,
        is_active: data.is_active,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      addToast('success', editingEndpoint
        ? t('webhooks.updateSuccess', 'Webhook updated successfully')
        : t('webhooks.createSuccess', 'Webhook created successfully'),
      )
      closeEndpointModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('webhooks.saveError', 'Failed to save webhook'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => webhooksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      addToast('success', t('webhooks.deleteSuccess', 'Webhook deleted'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('webhooks.deleteError', 'Failed to delete webhook'))
    },
  })

  function openCreateModal() {
    setEditingEndpoint(null)
    setEndpointForm({ url: '', events: [], secret: '', is_active: true })
    setEndpointModalOpen(true)
  }

  function openEditModal(endpoint: WebhookEndpoint) {
    setEditingEndpoint(endpoint)
    setEndpointForm({
      url: endpoint.url,
      events: endpoint.events ? endpoint.events.split(',').map((e) => e.trim()) : [],
      secret: '',
      is_active: !!endpoint.is_active,
    })
    setEndpointModalOpen(true)
  }

  function closeEndpointModal() {
    setEndpointModalOpen(false)
    setEditingEndpoint(null)
    setEndpointForm({ url: '', events: [], secret: '', is_active: true })
  }

  function handleSaveEndpoint() {
    if (!endpointForm.url.trim() || endpointForm.events.length === 0) return
    saveMutation.mutate({
      id: editingEndpoint?.id,
      url: endpointForm.url.trim(),
      events: endpointForm.events.join(','),
      secret: endpointForm.secret.trim() || undefined,
      is_active: endpointForm.is_active ? 1 : 0,
    })
  }

  function handleToggleEvent(event: string) {
    setEndpointForm((f) => ({
      ...f,
      events: f.events.includes(event)
        ? f.events.filter((e) => e !== event)
        : [...f.events, event],
    }))
  }

  function handleDeleteEndpoint(id: number) {
    if (window.confirm(t('webhooks.confirmDelete', 'Delete this webhook endpoint?'))) {
      deleteMutation.mutate(id)
    }
  }

  function handleToggleActive(endpoint: WebhookEndpoint) {
    toggleActiveMutation.mutate({ id: endpoint.id, is_active: endpoint.is_active ? 0 : 1 })
  }

  function openLogsModal(endpointId: number) {
    setLogsEndpointId(endpointId)
    setLogsPage(1)
    setLogsModalOpen(true)
  }

  function closeLogsModal() {
    setLogsModalOpen(false)
    setLogsEndpointId(null)
  }

  const endpointColumns = useMemo<Column<WebhookEndpoint & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'url',
        header: t('webhooks.url', 'URL'),
        render: (row) => {
          const truncated = row.url.length > 50 ? row.url.slice(0, 50) + '...' : row.url
          return (
            <span className="text-sm text-text-primary font-mono" title={row.url}>
              {truncated}
            </span>
          )
        },
      },
      {
        key: 'events',
        header: t('webhooks.events', 'Events'),
        render: (row) => {
          const eventsStr = row.events || ''
          const truncated = eventsStr.length > 40 ? eventsStr.slice(0, 40) + '...' : eventsStr
          return (
            <span className="text-xs text-text-secondary" title={eventsStr}>
              {truncated}
            </span>
          )
        },
        hideOnMobile: true,
      },
      {
        key: 'is_active',
        header: t('webhooks.active', 'Active'),
        render: (row) => (
          <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        key: 'failure_count',
        header: t('webhooks.failures', 'Failures'),
        render: (row) => (
          <span className={`text-sm ${row.failure_count > 0 ? 'text-red-400 font-medium' : 'text-text-muted'}`}>
            {row.failure_count}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'last_triggered_at',
        header: t('webhooks.lastTriggered', 'Last Triggered'),
        render: (row) => (
          <span className="text-text-muted text-xs">
            {row.last_triggered_at ? formatDate(row.last_triggered_at) : '-'}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'actions',
        header: t('common.actions', 'Actions'),
        render: (row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleToggleActive(row as unknown as WebhookEndpoint)}
              disabled={toggleActiveMutation.isPending}
            >
              {row.is_active ? t('webhooks.deactivate', 'Off') : t('webhooks.activate', 'On')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => testMutation.mutate(row.id)}
              disabled={testMutation.isPending}
            >
              <Send size={14} />
              <span className="hidden sm:inline">{t('webhooks.test', 'Test')}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openLogsModal(row.id)}
            >
              <FileText size={14} />
              <span className="hidden sm:inline">{t('webhooks.logs', 'Logs')}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openEditModal(row as unknown as WebhookEndpoint)}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleDeleteEndpoint(row.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [t, toggleActiveMutation.isPending, testMutation.isPending, deleteMutation.isPending],
  )

  const logColumns = useMemo<Column<WebhookLog & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'event_type',
        header: t('webhooks.eventType', 'Event'),
        render: (row) => (
          <span className="text-xs font-medium text-text-secondary">{row.event_type}</span>
        ),
      },
      {
        key: 'response_status',
        header: t('webhooks.responseStatus', 'Status'),
        render: (row) => {
          if (row.response_status == null) return <span className="text-text-muted">-</span>
          const isOk = row.response_status >= 200 && row.response_status < 300
          return (
            <span className={`text-xs font-mono font-medium ${isOk ? 'text-green-400' : 'text-red-400'}`}>
              {row.response_status}
            </span>
          )
        },
      },
      {
        key: 'error',
        header: t('webhooks.error', 'Error'),
        render: (row) => {
          if (!row.error) return <span className="text-text-muted">-</span>
          const truncated = row.error.length > 50 ? row.error.slice(0, 50) + '...' : row.error
          return (
            <span className="text-xs text-red-400 truncate max-w-[200px] block" title={row.error}>
              {truncated}
            </span>
          )
        },
        hideOnMobile: true,
      },
      {
        key: 'created_at',
        header: t('common.date', 'Date'),
        render: (row) => (
          <span className="text-text-muted text-xs">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          {t('webhooks.title', 'Webhooks')}
        </h1>
        <Button onClick={openCreateModal}>
          <Plus size={16} />
          {t('webhooks.createEndpoint', 'New Webhook')}
        </Button>
      </div>

      {/* Endpoints Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<WebhookEndpoint & Record<string, unknown>>
            columns={endpointColumns}
            data={endpoints as (WebhookEndpoint & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t('webhooks.empty', 'No webhook endpoints found')}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Endpoint Modal */}
      <Modal
        open={endpointModalOpen}
        onClose={closeEndpointModal}
        title={editingEndpoint
          ? t('webhooks.editEndpoint', 'Edit Webhook')
          : t('webhooks.createEndpoint', 'New Webhook')
        }
      >
        <div className="space-y-4">
          <Input
            label={t('webhooks.url', 'URL')}
            type="url"
            value={endpointForm.url}
            onChange={(e) => setEndpointForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://example.com/webhook"
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('webhooks.events', 'Events')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={endpointForm.events.includes(event)}
                    onChange={() => handleToggleEvent(event)}
                    className="h-4 w-4 rounded border-border text-accent-purple focus:ring-accent-purple"
                  />
                  <span className="text-sm text-text-secondary">{event}</span>
                </label>
              ))}
            </div>
          </div>
          <Input
            label={t('webhooks.secret', 'Secret')}
            type="password"
            value={endpointForm.secret}
            onChange={(e) => setEndpointForm((f) => ({ ...f, secret: e.target.value }))}
            placeholder={editingEndpoint
              ? t('webhooks.secretPlaceholder', 'Leave empty to keep current secret')
              : t('webhooks.secretPlaceholderNew', 'Optional signing secret')
            }
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={endpointForm.is_active}
              onChange={(e) => setEndpointForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-accent-purple focus:ring-accent-purple"
            />
            <span className="text-sm text-text-secondary">
              {t('webhooks.isActive', 'Active')}
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeEndpointModal}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSaveEndpoint}
              loading={saveMutation.isPending}
              disabled={!endpointForm.url.trim() || endpointForm.events.length === 0}
            >
              {editingEndpoint
                ? t('common.save', 'Save')
                : t('common.create', 'Create')
              }
            </Button>
          </div>
        </div>
      </Modal>

      {/* Logs Modal */}
      <Modal
        open={logsModalOpen}
        onClose={closeLogsModal}
        title={t('webhooks.endpointLogs', 'Webhook Logs')}
      >
        <div className="space-y-4">
          <DataTable<WebhookLog & Record<string, unknown>>
            columns={logColumns}
            data={logs as (WebhookLog & Record<string, unknown>)[]}
            loading={logsLoading}
            emptyMessage={t('webhooks.emptyLogs', 'No webhook logs found')}
          />
          {logsTotalPages > 1 && (
            <Pagination
              page={logsPage}
              pages={logsTotalPages}
              onPageChange={setLogsPage}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
