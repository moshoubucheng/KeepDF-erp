import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import NotificationsPage from '@/pages/notifications/NotificationsPage'

vi.mock('@/api/endpoints/notifications', () => ({
  notificationsApi: {
    list: vi.fn().mockResolvedValue({
      notifications: [
        { id: 1, distributor_id: 1, type: 'LOW_STOCK', title: 'Low Stock Alert', message: 'SKU-001 is running low', is_read: 0, created_at: '2024-01-15T10:00:00Z' },
        { id: 2, distributor_id: 1, type: 'ORDER_UPDATE', title: 'Order Shipped', message: 'Order #101 has been shipped', is_read: 1, created_at: '2024-01-14T09:00:00Z' },
        { id: 3, distributor_id: 1, type: 'COMMISSION', title: 'Commission Settled', message: 'Your commission has been settled', is_read: 0, created_at: '2024-01-13T08:00:00Z' },
      ],
      total: 3,
      count: 3,
      hasMore: false,
    }),
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 2 }),
    markRead: vi.fn().mockResolvedValue({ success: true }),
    markAllRead: vi.fn().mockResolvedValue({ success: true, marked: 2 }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotificationsPage', () => {
  it('renders notification list with read/unread styling', async () => {
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
      expect(screen.getByText('Order Shipped')).toBeInTheDocument()
      expect(screen.getByText('Commission Settled')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<NotificationsPage />)
    expect(screen.getByText('notifications.title')).toBeInTheDocument()
  })

  it('marks single notification as read', async () => {
    const { notificationsApi } = await import('@/api/endpoints/notifications')
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const readButtons = screen.getAllByText('notifications.markRead')
    await user.click(readButtons[0])

    await waitFor(() => {
      expect(notificationsApi.markRead).toHaveBeenCalled()
    })
  })

  it('marks all as read', async () => {
    const { notificationsApi } = await import('@/api/endpoints/notifications')
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const markAllBtn = screen.getByText('notifications.markAllRead')
    await user.click(markAllBtn)

    await waitFor(() => {
      expect(notificationsApi.markAllRead).toHaveBeenCalled()
    })
  })

  it('shows empty state', async () => {
    const { notificationsApi } = await import('@/api/endpoints/notifications')
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      notifications: [],
      total: 0,
      count: 0,
      hasMore: false,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('notifications.empty')).toBeInTheDocument()
    })
  })
})
