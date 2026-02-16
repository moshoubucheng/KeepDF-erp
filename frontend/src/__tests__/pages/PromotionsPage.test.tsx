import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import PromotionsPage from '@/pages/promotions/PromotionsPage'

vi.mock('@/api/endpoints/promotions', () => ({
  promotionsApi: {
    list: vi.fn().mockResolvedValue({
      promotions: [
        { id: 1, name: 'Black Friday', type: 'PERCENTAGE', discount_value: 20, buy_quantity: null, get_quantity: null, min_order_amount: 0, min_quantity: 0, start_date: '2024-11-29', end_date: '2024-11-30', max_uses: 1000, current_uses: 50, priority: 1, is_active: 1, created_at: '2024-11-01T00:00:00Z' },
        { id: 2, name: 'Free Ship Week', type: 'FREE_SHIPPING', discount_value: 0, buy_quantity: null, get_quantity: null, min_order_amount: 5000, min_quantity: 0, start_date: '2024-12-01', end_date: '2024-12-07', max_uses: 500, current_uses: 100, priority: 0, is_active: 1, created_at: '2024-12-01T00:00:00Z' },
      ],
      total: 2,
    }),
    create: vi.fn().mockResolvedValue({ promotion: {} }),
    update: vi.fn().mockResolvedValue({ promotion: {} }),
    delete: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

// Mock window.confirm
const mockConfirm = vi.fn(() => true)
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true })

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockReturnValue(true)
})

describe('PromotionsPage', () => {
  it('renders promotion list', async () => {
    render(<PromotionsPage />)

    await waitFor(() => {
      expect(screen.getByText('Black Friday')).toBeInTheDocument()
      expect(screen.getByText('Free Ship Week')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<PromotionsPage />)
    expect(screen.getByText('promotions.title')).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    render(<PromotionsPage />)

    const user = userEvent.setup()
    const createBtn = screen.getByText('promotions.create')
    await user.click(createBtn)

    await waitFor(() => {
      expect(screen.getByText('promotions.createPromotion')).toBeInTheDocument()
      expect(screen.getByText('promotions.startDate')).toBeInTheDocument()
    })
  })

  it('shows status filter', () => {
    render(<PromotionsPage />)
    expect(screen.getByText('promotions.allStatuses')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    const { promotionsApi } = await import('@/api/endpoints/promotions')
    vi.mocked(promotionsApi.list).mockResolvedValueOnce({ promotions: [], total: 0 })

    render(<PromotionsPage />)

    await waitFor(() => {
      expect(screen.getByText('promotions.empty')).toBeInTheDocument()
    })
  })
})
