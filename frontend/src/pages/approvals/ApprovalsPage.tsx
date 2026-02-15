import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, CheckCircle, XCircle, Trash2, Edit2 } from 'lucide-react'
import { approvalsApi, type ApprovalRequest, type ApprovalWorkflow } from '@/api/endpoints/approvals'
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

type Tab = 'requests' | 'workflows'

const RESOURCE_TYPES = ['order', 'product', 'distributor', 'commission', 'return', 'pricing']

export default function ApprovalsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const addToast = useUIStore((s) => s.addToast)

  const [activeTab, setActiveTab] = useState<Tab>('requests')

  // Request filters
  const [reqStatus, setReqStatus] = useState('')
  const [reqResourceType, setReqResourceType] = useState('')
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Approve/Reject modal
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [actionRequestId, setActionRequestId] = useState<number | null>(null)
  const [actionReason, setActionReason] = useState('')

  // Workflow modal
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null)
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    resource_type: 'order',
    approval_steps: '1',
    is_active: true,
  })

  // Requests query
  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['approval-requests', { reqStatus, reqResourceType, page, limit }],
    queryFn: () =>
      approvalsApi.listRequests({
        offset: (page - 1) * limit,
        limit,
        status: reqStatus || undefined,
        resource_type: reqResourceType || undefined,
      }),
    enabled: activeTab === 'requests',
  })

  const requests = reqData?.requests ?? []
  const reqTotal = reqData?.total ?? 0
  const reqTotalPages = Math.ceil(reqTotal / limit)

  // Workflows query
  const { data: wfData, isLoading: wfLoading } = useQuery({
    queryKey: ['approval-workflows'],
    queryFn: () => approvalsApi.listWorkflows(),
    enabled: activeTab === 'workflows' && isAdmin,
  })

  const workflows = wfData?.workflows ?? []

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      approvalsApi.approve(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      addToast('success', t('approvals.approveSuccess', 'Request approved'))
      closeActionModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('approvals.approveError', 'Failed to approve request'))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      approvalsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] })
      addToast('success', t('approvals.rejectSuccess', 'Request rejected'))
      closeActionModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('approvals.rejectError', 'Failed to reject request'))
    },
  })

  const saveWorkflowMutation = useMutation({
    mutationFn: (data: { id?: number; name: string; resource_type: string; approval_steps: number; is_active: number }) => {
      if (data.id) {
        return approvalsApi.updateWorkflow(data.id, {
          name: data.name,
          resource_type: data.resource_type,
          approval_steps: data.approval_steps,
          is_active: data.is_active,
        })
      }
      return approvalsApi.createWorkflow({
        name: data.name,
        resource_type: data.resource_type,
        approval_steps: data.approval_steps,
        is_active: data.is_active,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      addToast('success', editingWorkflow
        ? t('approvals.workflowUpdateSuccess', 'Workflow updated')
        : t('approvals.workflowCreateSuccess', 'Workflow created'),
      )
      closeWorkflowModal()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('approvals.workflowSaveError', 'Failed to save workflow'))
    },
  })

  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: number) => approvalsApi.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      addToast('success', t('approvals.workflowDeleteSuccess', 'Workflow deleted'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('approvals.workflowDeleteError', 'Failed to delete workflow'))
    },
  })

  function openActionModal(type: 'approve' | 'reject', requestId: number) {
    setActionType(type)
    setActionRequestId(requestId)
    setActionReason('')
    setActionModalOpen(true)
  }

  function closeActionModal() {
    setActionModalOpen(false)
    setActionRequestId(null)
    setActionReason('')
  }

  function handleActionConfirm() {
    if (!actionRequestId) return
    if (actionType === 'approve') {
      approveMutation.mutate({ id: actionRequestId, reason: actionReason.trim() || undefined })
    } else {
      if (!actionReason.trim()) return
      rejectMutation.mutate({ id: actionRequestId, reason: actionReason.trim() })
    }
  }

  function openCreateWorkflow() {
    setEditingWorkflow(null)
    setWorkflowForm({ name: '', resource_type: 'order', approval_steps: '1', is_active: true })
    setWorkflowModalOpen(true)
  }

  function openEditWorkflow(wf: ApprovalWorkflow) {
    setEditingWorkflow(wf)
    setWorkflowForm({
      name: wf.name,
      resource_type: wf.resource_type,
      approval_steps: String(wf.approval_steps),
      is_active: !!wf.is_active,
    })
    setWorkflowModalOpen(true)
  }

  function closeWorkflowModal() {
    setWorkflowModalOpen(false)
    setEditingWorkflow(null)
    setWorkflowForm({ name: '', resource_type: 'order', approval_steps: '1', is_active: true })
  }

  function handleSaveWorkflow() {
    const steps = parseInt(workflowForm.approval_steps, 10)
    if (!workflowForm.name.trim() || isNaN(steps) || steps < 1) return
    saveWorkflowMutation.mutate({
      id: editingWorkflow?.id,
      name: workflowForm.name.trim(),
      resource_type: workflowForm.resource_type,
      approval_steps: steps,
      is_active: workflowForm.is_active ? 1 : 0,
    })
  }

  function handleDeleteWorkflow(id: number) {
    if (window.confirm(t('approvals.confirmDeleteWorkflow', 'Delete this approval workflow?'))) {
      deleteWorkflowMutation.mutate(id)
    }
  }

  function handleReqStatusChange(value: string) {
    setReqStatus(value)
    resetPage()
  }

  function handleReqResourceTypeChange(value: string) {
    setReqResourceType(value)
    resetPage()
  }

  const requestColumns = useMemo<Column<ApprovalRequest & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'resource_type',
        header: t('approvals.resourceType', 'Resource Type'),
        render: (row) => (
          <span className="text-xs font-medium text-text-secondary uppercase">{row.resource_type}</span>
        ),
      },
      {
        key: 'request_data',
        header: t('approvals.requestData', 'Request Data'),
        render: (row) => {
          const text = JSON.stringify(row.request_data)
          const truncated = text.length > 60 ? text.slice(0, 60) + '...' : text
          return (
            <span className="text-xs text-text-muted font-mono truncate max-w-[200px] block" title={text}>
              {truncated}
            </span>
          )
        },
        hideOnMobile: true,
      },
      {
        key: 'status',
        header: t('approvals.status', 'Status'),
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'requested_by',
        header: t('approvals.requestedBy', 'Requested By'),
        render: (row) => (
          <span className="text-sm text-text-muted">#{row.requested_by}</span>
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
      ...(isAdmin
        ? [
            {
              key: 'actions' as const,
              header: t('common.actions', 'Actions'),
              render: (row: ApprovalRequest & Record<string, unknown>) => (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {row.status === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openActionModal('approve', row.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <CheckCircle size={14} />
                        <span className="hidden sm:inline">{t('approvals.approve', 'Approve')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openActionModal('reject', row.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <XCircle size={14} />
                        <span className="hidden sm:inline">{t('approvals.reject', 'Reject')}</span>
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [t, isAdmin, approveMutation.isPending, rejectMutation.isPending],
  )

  const workflowColumns = useMemo<Column<ApprovalWorkflow & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'name',
        header: t('approvals.workflowName', 'Name'),
        render: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
      },
      {
        key: 'resource_type',
        header: t('approvals.resourceType', 'Resource Type'),
        render: (row) => (
          <span className="text-xs font-medium text-text-secondary uppercase">{row.resource_type}</span>
        ),
      },
      {
        key: 'approval_steps',
        header: t('approvals.steps', 'Steps'),
        render: (row) => <span className="text-sm text-text-secondary">{row.approval_steps}</span>,
      },
      {
        key: 'is_active',
        header: t('approvals.active', 'Active'),
        render: (row) => (
          <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        key: 'created_at',
        header: t('common.date', 'Date'),
        render: (row) => (
          <span className="text-text-muted text-xs">{formatDate(row.created_at)}</span>
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
              onClick={() => openEditWorkflow(row as unknown as ApprovalWorkflow)}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleDeleteWorkflow(row.id)}
              disabled={deleteWorkflowMutation.isPending}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [t, deleteWorkflowMutation.isPending],
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          {t('approvals.title', 'Approvals')}
        </h1>
        {isAdmin && activeTab === 'workflows' && (
          <Button onClick={openCreateWorkflow}>
            <Plus size={16} />
            {t('approvals.createWorkflow', 'New Workflow')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'requests'
              ? 'border-accent-purple text-accent-purple'
              : 'border-transparent text-text-muted hover:text-text-secondary',
          )}
          onClick={() => setActiveTab('requests')}
        >
          {t('approvals.requests', 'Requests')}
        </button>
        {isAdmin && (
          <button
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'workflows'
                ? 'border-accent-purple text-accent-purple'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
            onClick={() => setActiveTab('workflows')}
          >
            {t('approvals.workflows', 'Workflows')}
          </button>
        )}
      </div>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <>
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Select
                    label={t('approvals.status', 'Status')}
                    value={reqStatus}
                    onChange={(e) => handleReqStatusChange(e.target.value)}
                  >
                    <option value="">{t('common.all', 'All')}</option>
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </Select>
                </div>
                <div className="w-40">
                  <Select
                    label={t('approvals.resourceType', 'Resource Type')}
                    value={reqResourceType}
                    onChange={(e) => handleReqResourceTypeChange(e.target.value)}
                  >
                    <option value="">{t('common.all', 'All')}</option>
                    {RESOURCE_TYPES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <DataTable<ApprovalRequest & Record<string, unknown>>
                columns={requestColumns}
                data={requests as (ApprovalRequest & Record<string, unknown>)[]}
                loading={reqLoading}
                emptyMessage={t('approvals.emptyRequests', 'No approval requests found')}
              />
            </CardContent>
            {reqTotalPages > 1 && (
              <div className="px-6 py-3 border-t border-border">
                <Pagination
                  page={page}
                  pages={reqTotalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </Card>
        </>
      )}

      {/* Workflows Tab (Admin Only) */}
      {activeTab === 'workflows' && isAdmin && (
        <Card>
          <CardContent className="p-0">
            <DataTable<ApprovalWorkflow & Record<string, unknown>>
              columns={workflowColumns}
              data={workflows as (ApprovalWorkflow & Record<string, unknown>)[]}
              loading={wfLoading}
              emptyMessage={t('approvals.emptyWorkflows', 'No approval workflows found')}
            />
          </CardContent>
        </Card>
      )}

      {/* Approve/Reject Modal */}
      <Modal
        open={actionModalOpen}
        onClose={closeActionModal}
        title={actionType === 'approve'
          ? t('approvals.approveRequest', 'Approve Request')
          : t('approvals.rejectRequest', 'Reject Request')
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {actionType === 'approve'
              ? t('approvals.approvePrompt', 'Approve this request? You may provide an optional reason.')
              : t('approvals.rejectPrompt', 'Please provide a reason for rejecting this request.')
            }
          </p>
          <Input
            label={t('approvals.reason', 'Reason')}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder={actionType === 'approve'
              ? t('approvals.optionalReason', 'Optional reason...')
              : t('approvals.requiredReason', 'Reason for rejection...')
            }
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeActionModal}>
              {t('common.cancel', 'Cancel')}
            </Button>
            {actionType === 'approve' ? (
              <Button
                variant="primary"
                onClick={handleActionConfirm}
                loading={approveMutation.isPending}
              >
                <CheckCircle size={16} />
                {t('approvals.approve', 'Approve')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={handleActionConfirm}
                loading={rejectMutation.isPending}
                disabled={!actionReason.trim()}
              >
                <XCircle size={16} />
                {t('approvals.reject', 'Reject')}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Create/Edit Workflow Modal */}
      <Modal
        open={workflowModalOpen}
        onClose={closeWorkflowModal}
        title={editingWorkflow
          ? t('approvals.editWorkflow', 'Edit Workflow')
          : t('approvals.createWorkflow', 'New Workflow')
        }
      >
        <div className="space-y-4">
          <Input
            label={t('approvals.workflowName', 'Name')}
            value={workflowForm.name}
            onChange={(e) => setWorkflowForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('approvals.workflowNamePlaceholder', 'e.g. Order approval')}
          />
          <Select
            label={t('approvals.resourceType', 'Resource Type')}
            value={workflowForm.resource_type}
            onChange={(e) => setWorkflowForm((f) => ({ ...f, resource_type: e.target.value }))}
          >
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
          <Input
            label={t('approvals.steps', 'Approval Steps')}
            type="number"
            value={workflowForm.approval_steps}
            onChange={(e) => setWorkflowForm((f) => ({ ...f, approval_steps: e.target.value }))}
            placeholder="1"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={workflowForm.is_active}
              onChange={(e) => setWorkflowForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-accent-purple focus:ring-accent-purple"
            />
            <span className="text-sm text-text-secondary">
              {t('approvals.isActive', 'Active')}
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeWorkflowModal}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSaveWorkflow}
              loading={saveWorkflowMutation.isPending}
              disabled={!workflowForm.name.trim() || !workflowForm.approval_steps}
            >
              {editingWorkflow
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
