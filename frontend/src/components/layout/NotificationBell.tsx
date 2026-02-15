import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bell, Check, X } from 'lucide-react'
import { api } from '@/api/client'
import type { Notification } from '@/api/types'
import { cn } from '@/utils/cn'

interface NotificationsResponse {
  success: boolean
  notifications: Notification[]
}

interface MarkReadResponse {
  success: boolean
}

export function NotificationBell() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationsResponse>('/notifications?limit=20'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const notifications = data?.notifications ?? []
  const unreadCount = notifications.filter((n) => n.is_read === 0).length

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.post<MarkReadResponse>('/notifications/mark-all-read')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch {
      // Silently fail -- the user can retry
    }
  }, [queryClient])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Close dropdown on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60_000)

    if (diffMin < 1) return t('notification.justNow')
    if (diffMin < 60) return t('notification.minutesAgo', { count: diffMin })
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return t('notification.hoursAgo', { count: diffHours })
    const diffDays = Math.floor(diffHours / 24)
    return t('notification.daysAgo', { count: diffDays })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
        aria-label={t('notification.title')}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-bg-card shadow-xl sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('notification.title')}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-accent-purple transition-colors hover:bg-accent-purple-glow"
                >
                  <Check className="h-3 w-3" />
                  {t('notification.markAllRead')}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-text-muted transition-colors hover:text-text-primary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-text-muted">
                <Bell className="h-8 w-8 opacity-40" />
                <span className="text-sm">{t('notification.empty')}</span>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-bg-card-hover',
                    notification.is_read === 0 && 'bg-accent-purple-glow',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                        {notification.message}
                      </p>
                    </div>
                    {notification.is_read === 0 && (
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-accent-purple" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {formatTime(notification.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
