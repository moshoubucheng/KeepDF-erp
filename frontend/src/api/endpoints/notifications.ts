import { api } from '../client'
import type { Notification } from '../types'

interface NotificationsParams {
  offset?: number
  limit?: number
}

export const notificationsApi = {
  list: (params: NotificationsParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return api.get<{
      notifications: Notification[]
      total: number
      count: number
      hasMore: boolean
    }>(`/notifications${qs ? `?${qs}` : ''}`)
  },

  getUnreadCount: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),

  markRead: (id: number) => api.patch<{ success: boolean }>(`/notifications/${id}/read`),

  markAllRead: () => api.post<{ success: boolean; marked: number }>('/notifications/read-all'),
}
