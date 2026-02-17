import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bell, CheckCheck, Circle, CheckCircle } from 'lucide-react'

import { notificationsApi } from '@/api/endpoints/notifications'
import type { Notification } from '@/api/types'
import { useUIStore } from '@/stores/ui.store'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/utils/format'

import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { DataTable, type Column } from '@/components/data/DataTable'

const TYPE_COLORS: Record<string, string> = {
  LOW_STOCK: 'text-amber-400',
  ORDER_UPDATE: 'text-blue-400',
  COMMISSION: 'text-emerald-400',
  SHIPMENT: 'text-purple-400',
  RETURN: 'text-orange-400',
  SYSTEM: 'text-red-400',
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const addToast = useUIStore((s) => s.addToast)
  const { page, limit, setPage } = usePagination(20)
  const [filterUnread, setFilterUnread] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { page, limit }],
    queryFn: () => notificationsApi.list({ offset: (page - 1) * limit, limit }),
  })

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30000,
  })

  const allNotifications = data?.notifications ?? []
  const notifications = filterUnread ? allNotifications.filter((n) => !n.is_read) : allNotifications
  const total = data?.total ?? 0
  const unreadCount = unreadData?.unreadCount ?? 0
  const totalPages = Math.ceil(total / limit)

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err: Error) => addToast('error', err.message),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (data) => {
      addToast('success', t('notifications.markedAllRead', `Marked ${data.marked} as read`))
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (err: Error) => addToast('error', err.message),
  })

  const columns = useMemo<Column<Notification>[]>(() => [
    {
      key: 'is_read', header: '', className: 'w-8',
      render: (row) => row.is_read ? <CheckCircle size={16} className="text-text-muted" /> : <Circle size={16} className="text-accent-purple fill-accent-purple" />,
    },
    {
      key: 'type', header: t('notifications.type', 'Type'), className: 'w-28',
      render: (row) => <span className={`text-xs font-semibold uppercase ${TYPE_COLORS[row.type] || 'text-text-muted'}`}>{row.type}</span>,
    },
    {
      key: 'title', header: t('notifications.notifTitle', 'Title'),
      render: (row) => <span className={`font-medium ${row.is_read ? 'text-text-muted' : 'text-text-primary'}`}>{row.title}</span>,
    },
    {
      key: 'message', header: t('notifications.message', 'Message'), hideOnMobile: true,
      render: (row) => {
        const truncated = row.message.length > 80 ? row.message.slice(0, 80) + '...' : row.message
        return <span className="text-sm text-text-secondary" title={row.message}>{truncated}</span>
      },
    },
    { key: 'created_at', header: t('common.date', 'Date'), render: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span> },
    {
      key: 'actions', header: '', className: 'w-20',
      render: (row) => !row.is_read ? (
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(row.id) }}>{t('notifications.markRead', 'Read')}</Button>
      ) : null,
    },
  ], [t, markReadMutation])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Bell size={24} />{t('notifications.title', 'Notifications')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('notifications.subtitle', 'System alerts and updates')}</p>
        </div>
        {unreadCount > 0 && (
          <span className="px-3 py-1.5 bg-accent-purple/15 text-accent-purple rounded-full text-sm font-semibold">{unreadCount} {t('notifications.unread', 'unread')}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" variant={filterUnread ? 'primary' : 'secondary'} onClick={() => setFilterUnread(!filterUnread)}>
          {filterUnread ? t('common.all', 'All') : t('notifications.unreadOnly', 'Unread only')}
        </Button>
        <div className="ml-auto">
          <Button size="sm" onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending} disabled={unreadCount === 0}>
            <CheckCheck size={16} />{t('notifications.markAllRead', 'Mark all read')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={notifications} loading={isLoading} emptyMessage={t('notifications.empty', 'No notifications')} keyField="id" mobileCardView />
        </CardContent>
      </Card>

      {totalPages > 1 && <Pagination page={page} pages={totalPages} onPageChange={setPage} />}
    </div>
  )
}
