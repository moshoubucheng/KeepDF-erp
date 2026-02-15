import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Play, Trash2, Edit2, Zap } from 'lucide-react'
import { automationApi, type AutomationRule, type AutomationLog } from '@/api/endpoints/automation'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

type Tab = 'rules' | 'logs'

const RULE_TYPES = ['AUTO_REORDER', 'AUTO_PRICE_ADJUST', 'STOCK_ALERT']

export default function AutomationPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)

  const [activeTab, setActiveTab] = useState<Tab>('rules')

  // Rule modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [ruleForm, setRuleForm] = useState({
    name: '',
    type: 'AUTO_REORDER',
    conditions: '{}',
    actions: '{}',
  })
  const [formErrors, setFormErrors] = useState<{ conditions?: string; actions?: string }>({})

  // Logs filters
  const [logRuleId, setLogRuleId] = useState('')
  const [logStatus, setLogStatus] = useState('')
  const { page, limit, setPage, resetPage } = usePagination(20)

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-muted">{t('common.accessDenied', 'Access denied')}</p>
      </div>
    )
  }

  // Rules query
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => automationApi.list(),
  })

  const rules = rulesData?.rules ?? []

  // Logs query
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['automation-logs', { logRuleId, logStatus, page, limit }],
    queryFn: () =>
      automationApi.logs({
        rule_id: logRuleId ? Number(logRuleId) : undefined,
        status: logStatus || undefined,
        offset: (page - 1) * limit,
        limit,
      }),
    enabled: activeTab === 'logs',
  })

  const logs = logsData?.logs ?? []
  const logsTotal = logsData?.total ?? 0
  const logsTotalPages = Math.ceil(logsTotal / limit)

  // Mutations
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: number }) =>
      automationApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      addToast('success', t('automation.toggleSuccess', 'Rule status updated'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('automation.toggleError', 'Failed to update rule status'))
    },
  })

  const runMutation = useMutation({
    mutationFn: (id: number) => automationApi.run(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] })
      addToast('success', t('automation.runSuccess', 'Rule executed successfully'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('automation.runError', 'Failed to execute rule'))
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: { id?: number; name: string; type: string; conditions: Record<string, unknown>; actions: Record<string, unknown> }) => {
      if (data.id) {
        return automationApi.update(data.id, {
          name: data.name,
          conditions: data.conditions,
          actions: data.actions,
        })
      }
      return automationApi.create({
        name: data.name,
        type: data.type,
        conditions: data.conditions,
        actions: data.actions,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      addToast('success', editingRule
        ? t('automation.updateSuccess', 'Rule updated successfully')
        : t('automation.createSuccess', 'Rule created successfully'),
      )
      closeRuleModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('automation.saveError', 'Failed to save rule'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => automationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      addToast('success', t('automation.deleteSuccess', 'Rule deleted'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('automation.deleteError', 'Failed to delete rule'))
    },
  })

  const evaluateAllMutation = useMutation({
    mutationFn: () => automationApi.evaluateAll(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] })
      addToast('success', t('automation.evaluateSuccess', `Evaluated: ${data.evaluated}, Executed: ${data.executed}`))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('automation.evaluateError', 'Failed to evaluate rules'))
    },
  })

  function openCreateModal() {
    setEditingRule(null)
    setRuleForm({ name: '', type: 'AUTO_REORDER', conditions: '{}', actions: '{}' })
    setFormErrors({})
    setRuleModalOpen(true)
  }

  function openEditModal(rule: AutomationRule) {
    setEditingRule(rule)
    setRuleForm({
      name: rule.name,
      type: rule.type,
      conditions: JSON.stringify(rule.conditions, null, 2),
      actions: JSON.stringify(rule.actions, null, 2),
    })
    setFormErrors({})
    setRuleModalOpen(true)
  }

  function closeRuleModal() {
    setRuleModalOpen(false)
    setEditingRule(null)
    setRuleForm({ name: '', type: 'AUTO_REORDER', conditions: '{}', actions: '{}' })
    setFormErrors({})
  }

  function handleSaveRule() {
    const errors: { conditions?: string; actions?: string } = {}
    let conditions: Record<string, unknown>
    let actions: Record<string, unknown>

    try {
      conditions = JSON.parse(ruleForm.conditions)
    } catch {
      errors.conditions = t('automation.invalidJson', 'Invalid JSON')
    }

    try {
      actions = JSON.parse(ruleForm.actions)
    } catch {
      errors.actions = t('automation.invalidJson', 'Invalid JSON')
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    saveMutation.mutate({
      id: editingRule?.id,
      name: ruleForm.name,
      type: ruleForm.type,
      conditions: conditions!,
      actions: actions!,
    })
  }

  function handleDeleteRule(id: number) {
    if (window.confirm(t('automation.confirmDelete', 'Delete this automation rule?'))) {
      deleteMutation.mutate(id)
    }
  }

  function handleToggleActive(rule: AutomationRule) {
    toggleActiveMutation.mutate({ id: rule.id, is_active: rule.is_active ? 0 : 1 })
  }

  function handleLogRuleIdChange(value: string) {
    setLogRuleId(value)
    resetPage()
  }

  function handleLogStatusChange(value: string) {
    setLogStatus(value)
    resetPage()
  }

  const ruleColumns = useMemo<Column<AutomationRule & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'name',
        header: t('automation.name', 'Name'),
        render: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
      },
      {
        key: 'type',
        header: t('automation.type', 'Type'),
        render: (row) => (
          <span className="text-xs font-medium text-accent-purple uppercase">{row.type}</span>
        ),
      },
      {
        key: 'is_active',
        header: t('automation.active', 'Active'),
        render: (row) => (
          <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        key: 'run_count',
        header: t('automation.runCount', 'Runs'),
        render: (row) => <span className="text-sm text-text-secondary">{row.run_count}</span>,
        hideOnMobile: true,
      },
      {
        key: 'last_run_at',
        header: t('automation.lastRun', 'Last Run'),
        render: (row) => (
          <span className="text-text-muted text-xs">
            {row.last_run_at ? formatDate(row.last_run_at) : '-'}
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
              onClick={() => handleToggleActive(row as unknown as AutomationRule)}
              disabled={toggleActiveMutation.isPending}
            >
              {row.is_active ? t('automation.deactivate', 'Off') : t('automation.activate', 'On')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => runMutation.mutate(row.id)}
              disabled={runMutation.isPending}
            >
              <Play size={14} />
              <span className="hidden sm:inline">{t('automation.run', 'Run')}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openEditModal(row as unknown as AutomationRule)}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleDeleteRule(row.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [t, toggleActiveMutation.isPending, runMutation.isPending, deleteMutation.isPending],
  )

  const logColumns = useMemo<Column<AutomationLog & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'rule_id',
        header: t('automation.ruleId', 'Rule ID'),
        render: (row) => <span className="font-mono text-xs text-text-secondary">#{row.rule_id}</span>,
      },
      {
        key: 'trigger_type',
        header: t('automation.triggerType', 'Trigger'),
        render: (row) => (
          <span className="text-xs font-medium text-text-secondary uppercase">{row.trigger_type}</span>
        ),
      },
      {
        key: 'status',
        header: t('automation.status', 'Status'),
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'result',
        header: t('automation.result', 'Result'),
        render: (row) => (
          <span className="text-xs text-text-muted truncate max-w-[200px] block" title={row.result ?? ''}>
            {row.result ?? '-'}
          </span>
        ),
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
          {t('automation.title', 'Automation Rules')}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => evaluateAllMutation.mutate()}
            loading={evaluateAllMutation.isPending}
          >
            <Zap size={14} />
            {t('automation.evaluateAll', 'Evaluate All')}
          </Button>
          <Button onClick={openCreateModal}>
            <Plus size={16} />
            {t('automation.createRule', 'New Rule')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'rules'
              ? 'border-accent-purple text-accent-purple'
              : 'border-transparent text-text-muted hover:text-text-secondary',
          )}
          onClick={() => setActiveTab('rules')}
        >
          {t('automation.rules', 'Rules')}
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'logs'
              ? 'border-accent-purple text-accent-purple'
              : 'border-transparent text-text-muted hover:text-text-secondary',
          )}
          onClick={() => setActiveTab('logs')}
        >
          {t('automation.logs', 'Logs')}
        </button>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <Card>
          <CardContent className="p-0">
            <DataTable<AutomationRule & Record<string, unknown>>
              columns={ruleColumns}
              data={rules as (AutomationRule & Record<string, unknown>)[]}
              loading={rulesLoading}
              emptyMessage={t('automation.emptyRules', 'No automation rules found')}
            />
          </CardContent>
        </Card>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <>
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Input
                    label={t('automation.ruleId', 'Rule ID')}
                    type="number"
                    value={logRuleId}
                    onChange={(e) => handleLogRuleIdChange(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="w-40">
                  <Select
                    label={t('automation.status', 'Status')}
                    value={logStatus}
                    onChange={(e) => handleLogStatusChange(e.target.value)}
                  >
                    <option value="">{t('common.all', 'All')}</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="ERROR">ERROR</option>
                    <option value="SKIPPED">SKIPPED</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <DataTable<AutomationLog & Record<string, unknown>>
                columns={logColumns}
                data={logs as (AutomationLog & Record<string, unknown>)[]}
                loading={logsLoading}
                emptyMessage={t('automation.emptyLogs', 'No automation logs found')}
              />
            </CardContent>
            {logsTotalPages > 1 && (
              <div className="px-6 py-3 border-t border-border">
                <Pagination
                  page={page}
                  pages={logsTotalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </Card>
        </>
      )}

      {/* Create/Edit Rule Modal */}
      <Modal
        open={ruleModalOpen}
        onClose={closeRuleModal}
        title={editingRule
          ? t('automation.editRule', 'Edit Rule')
          : t('automation.createRule', 'New Rule')
        }
      >
        <div className="space-y-4">
          <Input
            label={t('automation.name', 'Name')}
            value={ruleForm.name}
            onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('automation.namePlaceholder', 'e.g. Low stock auto reorder')}
          />
          <Select
            label={t('automation.type', 'Type')}
            value={ruleForm.type}
            onChange={(e) => setRuleForm((f) => ({ ...f, type: e.target.value }))}
          >
            {RULE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('automation.conditions', 'Conditions (JSON)')}
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple font-mono"
              rows={4}
              value={ruleForm.conditions}
              onChange={(e) => {
                setRuleForm((f) => ({ ...f, conditions: e.target.value }))
                setFormErrors((prev) => ({ ...prev, conditions: undefined }))
              }}
              placeholder='{"threshold": 10}'
            />
            {formErrors.conditions && (
              <p className="mt-1 text-xs text-red-400">{formErrors.conditions}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('automation.actions', 'Actions (JSON)')}
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple font-mono"
              rows={4}
              value={ruleForm.actions}
              onChange={(e) => {
                setRuleForm((f) => ({ ...f, actions: e.target.value }))
                setFormErrors((prev) => ({ ...prev, actions: undefined }))
              }}
              placeholder='{"reorder_quantity": 50}'
            />
            {formErrors.actions && (
              <p className="mt-1 text-xs text-red-400">{formErrors.actions}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeRuleModal}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSaveRule}
              loading={saveMutation.isPending}
              disabled={!ruleForm.name.trim()}
            >
              {editingRule
                ? t('common.save', 'Save')
                : t('common.create', 'Create')
              }
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
