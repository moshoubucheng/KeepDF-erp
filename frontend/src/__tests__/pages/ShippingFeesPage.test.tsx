import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import ShippingFeesPage from '@/pages/shipping-fees/ShippingFeesPage'

vi.mock('@/api/endpoints/shipping-fees', () => ({
  shippingFeesApi: {
    listTemplates: vi.fn().mockResolvedValue({
      templates: [
        { id: 1, name: 'Yamato Standard', carrier: 'YAMATO', region: 'DOMESTIC', weight_min_g: 0, weight_max_g: 5000, base_fee: 800, per_kg_fee: 200, platform: null, is_active: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'EMS Asia', carrier: 'EMS', region: 'ASIA', weight_min_g: 0, weight_max_g: 10000, base_fee: 2000, per_kg_fee: 500, platform: 'TIKTOK', is_active: 1, created_at: '2024-01-02T00:00:00Z' },
      ],
    }),
    createTemplate: vi.fn().mockResolvedValue({ template: {} }),
    updateTemplate: vi.fn().mockResolvedValue({ template: {} }),
    deleteTemplate: vi.fn().mockResolvedValue({ status: 'ok' }),
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

describe('ShippingFeesPage', () => {
  it('renders fee template list', async () => {
    render(<ShippingFeesPage />)

    await waitFor(() => {
      expect(screen.getByText('Yamato Standard')).toBeInTheDocument()
      expect(screen.getByText('EMS Asia')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<ShippingFeesPage />)
    expect(screen.getByText('shippingFees.title')).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    render(<ShippingFeesPage />)

    await waitFor(() => {
      expect(screen.getByText('Yamato Standard')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const createBtn = screen.getByText('shippingFees.create')
    await user.click(createBtn)

    await waitFor(() => {
      expect(screen.getByText('shippingFees.createTemplate')).toBeInTheDocument()
    })
  })

  it('shows carrier filter', () => {
    render(<ShippingFeesPage />)
    expect(screen.getByText('shippingFees.allCarriers')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    const { shippingFeesApi } = await import('@/api/endpoints/shipping-fees')
    vi.mocked(shippingFeesApi.listTemplates).mockResolvedValueOnce({ templates: [], total: 0 })

    render(<ShippingFeesPage />)

    await waitFor(() => {
      expect(screen.getByText('shippingFees.empty')).toBeInTheDocument()
    })
  })
})
