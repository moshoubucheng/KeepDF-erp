import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import ForecastingPage from '@/pages/forecasting/ForecastingPage'

vi.mock('@/api/endpoints/forecasting', () => ({
  forecastingApi: {
    list: vi.fn().mockResolvedValue({
      forecasts: [
        { sku: 'SKU-001', product_name: 'Product A', current_stock: 100, daily_velocity: 5.0, days_of_stock: 20, reorder_point: 30, safety_stock: 15, calculated_at: '2024-01-15T10:00:00Z' },
        { sku: 'SKU-002', product_name: 'Product B', current_stock: 10, daily_velocity: 3.0, days_of_stock: 3, reorder_point: 20, safety_stock: 10, calculated_at: '2024-01-15T10:00:00Z' },
      ],
      total: 2,
    }),
    reorderSuggestions: vi.fn().mockResolvedValue({
      suggestions: [
        { sku: 'SKU-002', product_name: 'Product B', urgency: 'CRITICAL', current_stock: 10, days_until_stockout: 3, reorder_qty: 50, predicted_demand: 90, supplier: 'Supplier A' },
      ],
      count: 1,
    }),
    calculate: vi.fn().mockResolvedValue({ calculated: 10 }),
    export: vi.fn().mockResolvedValue('sku,product_name\nSKU-001,Product A'),
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForecastingPage', () => {
  it('renders stat cards', async () => {
    render(<ForecastingPage />)

    await waitFor(() => {
      expect(screen.getByText('forecasting.reorderNeeded')).toBeInTheDocument()
      expect(screen.getByText('forecasting.totalProducts')).toBeInTheDocument()
      expect(screen.getByText('forecasting.avgDaysOfStock')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<ForecastingPage />)
    expect(screen.getByText('forecasting.title')).toBeInTheDocument()
  })

  it('shows reorder suggestions table', async () => {
    render(<ForecastingPage />)

    await waitFor(() => {
      expect(screen.getByText('forecasting.reorderSuggestions')).toBeInTheDocument()
    })
  })

  it('shows all forecasts table', async () => {
    render(<ForecastingPage />)

    await waitFor(() => {
      expect(screen.getByText('forecasting.allForecasts')).toBeInTheDocument()
    })
  })

  it('shows run forecast button', () => {
    render(<ForecastingPage />)
    expect(screen.getByText('forecasting.runForecast')).toBeInTheDocument()
  })
})
