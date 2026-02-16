import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import PricingPage from '@/pages/pricing/PricingPage'

vi.mock('@/api/endpoints/pricing', () => ({
  pricingApi: {
    list: vi.fn().mockResolvedValue({
      rules: [
        { id: 1, sku: 'SKU-001', platform: 'tiktok', base_price: 3000, sale_price: 2500, valid_from: '2024-01-01', valid_to: null, is_active: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, sku: 'SKU-002', platform: null, base_price: 5000, sale_price: null, valid_from: null, valid_to: null, is_active: 1, created_at: '2024-01-02T00:00:00Z' },
      ],
      total: 2,
    }),
    history: vi.fn().mockResolvedValue({
      history: [
        { id: 1, sku: 'SKU-001', platform: 'tiktok', old_price: 3500, new_price: 3000, created_at: '2024-01-10T00:00:00Z' },
      ],
      total: 1,
    }),
    margins: vi.fn().mockResolvedValue({
      margins: [
        { sku: 'SKU-001', platform: 'tiktok', cost_price: 1500, base_price: 3000, margin: 1500, margin_percent: 50.0 },
      ],
    }),
    create: vi.fn().mockResolvedValue({ rule: {} }),
    update: vi.fn().mockResolvedValue({ rule: {} }),
    delete: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

vi.mock('@/utils/download', () => ({
  downloadObjectsCsv: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PricingPage', () => {
  it('renders rules tab by default', async () => {
    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
      expect(screen.getByText('SKU-002')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<PricingPage />)
    expect(screen.getByText('pricing.page_title')).toBeInTheDocument()
  })

  it('shows three tabs', () => {
    render(<PricingPage />)

    expect(screen.getByText('pricing.tab_rules')).toBeInTheDocument()
    expect(screen.getByText('pricing.tab_history')).toBeInTheDocument()
    expect(screen.getByText('pricing.margin')).toBeInTheDocument()
  })

  it('opens create rule modal', async () => {
    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const newBtn = screen.getByText('pricing.new_rule')
    await user.click(newBtn)

    await waitFor(() => {
      expect(screen.getByText('pricing.modal_create')).toBeInTheDocument()
    })
  })

  it('has CSV export button', () => {
    render(<PricingPage />)
    expect(screen.getByText('pricing.csv_export')).toBeInTheDocument()
  })

  it('shows platform filter', async () => {
    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getAllByText('pricing.all_platforms').length).toBeGreaterThanOrEqual(1)
    })
  })
})
