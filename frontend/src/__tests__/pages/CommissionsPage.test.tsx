import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import CommissionsPage from '@/pages/commissions/CommissionsPage'

vi.mock('@/api/endpoints/commissions', () => ({
  commissionsApi: {
    rates: vi.fn().mockResolvedValue({
      rates: [
        { id: 1, sku: 'SKU-001', platform: 'TIKTOK', rate: 0.15 },
        { id: 2, sku: 'SKU-002', platform: 'TEMU', rate: 0.12 },
        { id: 3, sku: 'SKU-003', platform: 'RAKUTEN', rate: 0.1 },
      ],
      count: 3,
    }),
    history: vi.fn().mockResolvedValue({
      settlements: [
        { id: 1, distributor_id: 1, order_id: 101, sku: 'SKU-001', platform: 'TIKTOK', qty: 2, unit_price: 3000, commission_rate: 0.15, commission_amount: 900, status: 'SETTLED', settled_at: '2024-01-15T10:00:00Z', created_at: '2024-01-14T10:00:00Z' },
        { id: 2, distributor_id: 1, order_id: 102, sku: 'SKU-002', platform: 'TEMU', qty: 1, unit_price: 5000, commission_rate: 0.12, commission_amount: 600, status: 'PENDING', settled_at: null, created_at: '2024-01-13T10:00:00Z' },
      ],
      total: 2,
      count: 2,
      hasMore: false,
    }),
    settle: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CommissionsPage', () => {
  it('renders commission rates table', async () => {
    render(<CommissionsPage />)

    await waitFor(() => {
      // SKU-001 and SKU-002 appear in both rates and settlements tables
      expect(screen.getAllByText('SKU-001').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('SKU-002').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('SKU-003')).toBeInTheDocument()
    })
  })

  it('renders settlement history', async () => {
    render(<CommissionsPage />)

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument()
      expect(screen.getByText('#102')).toBeInTheDocument()
    })
  })

  it('shows empty state for rates', async () => {
    const { commissionsApi } = await import('@/api/endpoints/commissions')
    vi.mocked(commissionsApi.rates).mockResolvedValueOnce({ rates: [], count: 0 })

    render(<CommissionsPage />)

    await waitFor(() => {
      expect(screen.getByText('commissions.noRates')).toBeInTheDocument()
    })
  })

  it('shows empty state for settlements', async () => {
    const { commissionsApi } = await import('@/api/endpoints/commissions')
    vi.mocked(commissionsApi.history).mockResolvedValueOnce({ settlements: [], total: 0, count: 0, hasMore: false })

    render(<CommissionsPage />)

    await waitFor(() => {
      expect(screen.getByText('commissions.noSettlements')).toBeInTheDocument()
    })
  })

  it('shows section headers', async () => {
    render(<CommissionsPage />)

    expect(screen.getByText('commissions.title')).toBeInTheDocument()
    expect(screen.getByText('commissions.rates')).toBeInTheDocument()
    expect(screen.getByText('commissions.settlements')).toBeInTheDocument()
  })
})
