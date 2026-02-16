import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import ShippingPage from '@/pages/shipping/ShippingPage'

vi.mock('@/api/endpoints/shipping', () => ({
  shippingApi: {
    list: vi.fn().mockResolvedValue({
      shipments: [
        { id: 1, order_id: 101, tracking_number: 'TRK-001', carrier: 'YAMATO', status: 'SHIPPED', shipped_at: '2024-01-15T10:00:00Z', estimated_delivery: '2024-01-18T00:00:00Z', created_at: '2024-01-15T10:00:00Z' },
        { id: 2, order_id: 102, tracking_number: 'TRK-002', carrier: 'SAGAWA', status: 'DELIVERED', shipped_at: '2024-01-14T09:00:00Z', estimated_delivery: '2024-01-17T00:00:00Z', created_at: '2024-01-14T09:00:00Z' },
      ],
      total: 2,
    }),
    create: vi.fn().mockResolvedValue({ shipment: {} }),
    updateStatus: vi.fn().mockResolvedValue({ status: 'ok' }),
    timeline: vi.fn().mockResolvedValue({ events: [] }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ShippingPage', () => {
  it('renders shipment list with tracking numbers', async () => {
    render(<ShippingPage />)

    await waitFor(() => {
      expect(screen.getByText('TRK-001')).toBeInTheDocument()
      expect(screen.getByText('TRK-002')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<ShippingPage />)
    expect(screen.getByText('shipping.title')).toBeInTheDocument()
  })

  it('opens create shipment modal', async () => {
    render(<ShippingPage />)

    await waitFor(() => {
      expect(screen.getByText('TRK-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const createBtn = screen.getByText('shipping.create')
    await user.click(createBtn)

    await waitFor(() => {
      expect(screen.getByText('shipping.createShipment')).toBeInTheDocument()
    })
  })

  it('shows status filter', () => {
    render(<ShippingPage />)
    expect(screen.getByText('shipping.allStatuses')).toBeInTheDocument()
  })

  it('shows search input', () => {
    render(<ShippingPage />)
    expect(screen.getByPlaceholderText('shipping.search')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    const { shippingApi } = await import('@/api/endpoints/shipping')
    vi.mocked(shippingApi.list).mockResolvedValueOnce({ shipments: [], total: 0, count: 0 })

    render(<ShippingPage />)

    await waitFor(() => {
      expect(screen.getByText('shipping.empty')).toBeInTheDocument()
    })
  })
})
