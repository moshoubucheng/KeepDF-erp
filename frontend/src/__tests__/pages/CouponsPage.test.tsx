import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import CouponsPage from '@/pages/coupons/CouponsPage'

vi.mock('@/api/endpoints/coupons', () => ({
  couponsApi: {
    list: vi.fn().mockResolvedValue({
      coupons: [
        { id: 1, code: 'KDF-AAAA0001', name: 'Summer Sale', type: 'PERCENTAGE', value: 10, min_order_amount: 1000, max_uses: 100, per_user_limit: 1, used_count: 5, platform: null, valid_from: '2024-01-01', valid_to: '2024-12-31', is_active: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, code: 'KDF-BBBB0002', name: 'Free Ship', type: 'FREE_SHIPPING', value: 0, min_order_amount: 3000, max_uses: 50, per_user_limit: 2, used_count: 10, platform: 'TIKTOK', valid_from: '2024-02-01', valid_to: '2024-06-30', is_active: 1, created_at: '2024-02-01T00:00:00Z' },
      ],
      total: 2,
    }),
    create: vi.fn().mockResolvedValue({ coupon: {} }),
    update: vi.fn().mockResolvedValue({ coupon: {} }),
    deactivate: vi.fn().mockResolvedValue({ status: 'ok' }),
    validate: vi.fn().mockResolvedValue({ valid: true, discount: 500 }),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CouponsPage', () => {
  it('renders coupon list with codes', async () => {
    render(<CouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('KDF-AAAA0001')).toBeInTheDocument()
      expect(screen.getByText('KDF-BBBB0002')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<CouponsPage />)
    expect(screen.getByText('coupons.title')).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    render(<CouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('KDF-AAAA0001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const createBtn = screen.getByText('coupons.create')
    await user.click(createBtn)

    await waitFor(() => {
      expect(screen.getByText('coupons.createCoupon')).toBeInTheDocument()
    })
  })

  it('shows validate section', () => {
    render(<CouponsPage />)
    expect(screen.getByText('coupons.validateTitle')).toBeInTheDocument()
    expect(screen.getByText('coupons.couponCode')).toBeInTheDocument()
  })

  it('shows platform filter', () => {
    render(<CouponsPage />)
    expect(screen.getByText('coupons.allPlatforms')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    const { couponsApi } = await import('@/api/endpoints/coupons')
    vi.mocked(couponsApi.list).mockResolvedValueOnce({ coupons: [], total: 0, count: 0 })

    render(<CouponsPage />)

    await waitFor(() => {
      expect(screen.getByText('coupons.empty')).toBeInTheDocument()
    })
  })
})
