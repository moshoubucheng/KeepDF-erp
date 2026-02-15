import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, PackageCheck, Wallet } from 'lucide-react'
import { returnsApi } from '@/api/endpoints/returns'
import type { Return } from '@/api/types'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatCurrency, formatDate } from '@/utils/format'
import { RETURN_STATUSES } from '@/utils/constants'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'
import { StatusBadge } from '@/components/data/StatusBadge'

export default function ReturnsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)

  // Filters
  const [status, setStatus] = useState('')
  const { page, limit, setPage, resetPage } = usePagination(20)

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReturnId, setRejectReturnId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Query
  const { data, isLoading } = useQuery({
    queryKey: ['returns', { page, limit, status }],
    queryFn: () => returnsApi.list({ page, limit, status: status || undefined }),
  })

  const returns = data?.returns ?? []
  const pagination = data?.pagination

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: number) => returnsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      addToast('success', t('returns.approveSuccess', 'Return approved'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('returns.approveError', 'Failed to approve return'))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => returnsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      addToast('success', t('returns.rejectSuccess', 'Return rejected'))
      setRejectModalOpen(false)
      setRejectReturnId(null)
      setRejectReason('')
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('returns.rejectError', 'Failed to reject return'))
    },
  })

  const receiveMutation = useMutation({
    mutationFn: (id: number) => returnsApi.receive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      addToast('success', t('returns.receiveSuccess', 'Return items received'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('returns.receiveError', 'Failed to mark as received'))
    },
  })

  const refundMutation = useMutation({
    mutationFn: (id: number) => returnsApi.refund(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      addToast('success', t('returns.refundSuccess', 'Refund processed successfully'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('returns.refundError', 'Failed to process refund'))
    },
  })

  function handleApprove(id: number) {
    if (window.confirm(t('returns.confirmApprove', 'Approve this return request?'))) {
      approveMutation.mutate(id)
    }
  }

  function handleRejectClick(id: number) {
    setRejectReturnId(id)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  function handleRejectConfirm() {
    if (!rejectReturnId || !rejectReason.trim()) return
    rejectMutation.mutate({ id: rejectReturnId, reason: rejectReason.trim() })
  }

  function handleReceive(id: number) {
    if (window.confirm(t('returns.confirmReceive', 'Confirm that return items have been received?'))) {
      receiveMutation.mutate(id)
    }
  }

  function handleRefund(id: number) {
    if (window.confirm(t('returns.confirmRefund', 'Process refund for this return? This action cannot be undone.'))) {
      refundMutation.mutate(id)
    }
  }

  function handleStatusChange(value: string) {
    setStatus(value)
    resetPage()
  }

  const anyMutationPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    receiveMutation.isPending ||
    refundMutation.isPending

  const columns = useMemo<Column<Return & Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-16',
        render: (row) => <span className="text-text-muted font-mono text-xs">#{row.id}</span>,
      },
      {
        key: 'order_id',
        header: t('returns.orderId', 'Order ID'),
        render: (row) => <span className="font-mono text-xs">#{row.order_id}</span>,
      },
      {
        key: 'status',
        header: t('returns.status', 'Status'),
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'reason',
        header: t('returns.reason', 'Reason'),
        render: (row) => (
          <span className="text-sm text-text-secondary truncate max-w-[200px] block">
            {row.reason ?? '-'}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'refund_amount',
        header: t('returns.refundAmount', 'Refund Amount'),
        render: (row) => (
          <span className="font-medium">
            {row.refund_amount != null ? formatCurrency(row.refund_amount) : '-'}
          </span>
        ),
      },
      {
        key: 'created_at',
        header: t('returns.createdAt', 'Created At'),
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
            {row.status === 'REQUESTED' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleApprove(row.id)}
                  disabled={anyMutationPending}
                >
                  <CheckCircle size={14} />
                  <span className="hidden sm:inline">{t('returns.approve', 'Approve')}</span>
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleRejectClick(row.id)}
                  disabled={anyMutationPending}
                >
                  <XCircle size={14} />
                  <span className="hidden sm:inline">{t('returns.reject', 'Reject')}</span>
                </Button>
              </>
            )}
            {row.status === 'APPROVED' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleReceive(row.id)}
                disabled={anyMutationPending}
              >
                <PackageCheck size={14} />
                <span className="hidden sm:inline">{t('returns.receive', 'Receive')}</span>
              </Button>
            )}
            {row.status === 'RECEIVED' && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleRefund(row.id)}
                disabled={anyMutationPending}
              >
                <Wallet size={14} />
                <span className="hidden sm:inline">{t('returns.refund', 'Refund')}</span>
              </Button>
            )}
          </div>
        ),
      },
    ],
    [t, anyMutationPending],
  )

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          {t('returns.title', 'Returns')}
        </h1>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                <option value="">{t('returns.allStatuses', 'All Statuses')}</option>
                {RETURN_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable<Return & Record<string, unknown>>
            columns={columns}
            data={returns as (Return & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t('returns.empty', 'No returns found')}
          />
        </CardContent>
        {pagination && pagination.pages > 1 && (
          <div className="px-6 py-3 border-t border-border">
            <Pagination
              page={pagination.page}
              pages={pagination.pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Reject Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setRejectReturnId(null); setRejectReason('') }}
        title={t('returns.rejectReturn', 'Reject Return')}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t('returns.rejectPrompt', 'Please provide a reason for rejecting return')} #{rejectReturnId}
          </p>
          <Input
            label={t('returns.rejectReason', 'Reason')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('returns.rejectReasonPlaceholder', 'e.g. Item not eligible for return')}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => { setRejectModalOpen(false); setRejectReturnId(null); setRejectReason('') }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
              loading={rejectMutation.isPending}
              disabled={!rejectReason.trim()}
            >
              <XCircle size={16} />
              {t('returns.confirmReject', 'Reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
