import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import OrdersPage from '@/pages/orders/OrdersPage'

vi.mock('@/api/endpoints/orders', () => ({
  ordersApi: {
    list: vi.fn().mockResolvedValue({
      orders: [
        { id: 1, platform: 'TIKTOK', platform_order_id: 'TT-001', status: 'PROCESSING', total_amount: 5000, tax_total: 500, distributor_id: 1, created_at: '2024-01-15T10:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
        { id: 2, platform: 'TEMU', platform_order_id: 'TM-002', status: 'SHIPPED', total_amount: 3000, tax_total: 300, distributor_id: 1, created_at: '2024-01-14T09:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
        { id: 3, platform: 'RAKUTEN', platform_order_id: 'RK-003', status: 'PENDING', total_amount: 8000, tax_total: 800, distributor_id: 1, created_at: '2024-01-13T08:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
      ],
      count: 3,
    }),
    ship: vi.fn().mockResolvedValue({ success: true }),
    deliver: vi.fn().mockResolvedValue({ success: true }),
    cancel: vi.fn().mockResolvedValue({ success: true }),
    exportCsv: vi.fn().mockResolvedValue('id,platform\n1,TIKTOK'),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

vi.mock('@/utils/download', () => ({
  downloadCsv: vi.fn(),
}))

// Mock window.confirm
const mockConfirm = vi.fn(() => true)
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true })

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockReturnValue(true)
})

describe('OrdersPage', () => {
  it('renders orders with platform/status columns', async () => {
    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('TT-001')).toBeInTheDocument()
      expect(screen.getByText('TM-002')).toBeInTheDocument()
      expect(screen.getByText('RK-003')).toBeInTheDocument()
    })
  })

  it('has filter dropdowns and search', () => {
    render(<OrdersPage />)

    expect(screen.getByText('orders.allPlatforms')).toBeInTheDocument()
    expect(screen.getByText('orders.allStatuses')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('orders.search')).toBeInTheDocument()
  })

  it('opens ship modal', async () => {
    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('TT-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const shipButtons = screen.getAllByText('orders.ship')
    await user.click(shipButtons[0])

    await waitFor(() => {
      expect(screen.getByText('orders.shipOrder')).toBeInTheDocument()
      expect(screen.getByText('orders.trackingNumber')).toBeInTheDocument()
    })
  })

  it('delivers order', async () => {
    const { ordersApi } = await import('@/api/endpoints/orders')
    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('TM-002')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const deliverBtn = screen.getAllByText('orders.deliver')[0]
    await user.click(deliverBtn)

    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(ordersApi.deliver).toHaveBeenCalledWith(2)
    })
  })

  it('cancels order', async () => {
    const { ordersApi } = await import('@/api/endpoints/orders')
    render(<OrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('RK-003')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    // PENDING orders have cancel buttons
    const cancelButtons = screen.getAllByText('orders.cancel')
    await user.click(cancelButtons[0])

    expect(mockConfirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(ordersApi.cancel).toHaveBeenCalled()
    })
  })

  it('has CSV export button', () => {
    render(<OrdersPage />)
    expect(screen.getByText('orders.export')).toBeInTheDocument()
  })
})
