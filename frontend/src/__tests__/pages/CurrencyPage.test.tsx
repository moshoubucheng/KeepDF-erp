import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import CurrencyPage from '@/pages/currency/CurrencyPage'

vi.mock('@/api/endpoints/currency', () => ({
  currencyApi: {
    getRates: vi.fn().mockResolvedValue({
      rates: [
        { id: 1, from_currency: 'USD', to_currency: 'JPY', rate: 150.5, updated_at: '2024-01-15T10:00:00Z' },
        { id: 2, from_currency: 'CNY', to_currency: 'JPY', rate: 21.3, updated_at: '2024-01-14T10:00:00Z' },
      ],
    }),
    setRate: vi.fn().mockResolvedValue({ status: 'ok' }),
    convert: vi.fn().mockResolvedValue({ converted: 15050 }),
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

describe('CurrencyPage', () => {
  it('renders exchange rate table', async () => {
    render(<CurrencyPage />)

    await waitFor(() => {
      expect(screen.getByText('150.5000')).toBeInTheDocument()
      expect(screen.getByText('21.3000')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<CurrencyPage />)
    expect(screen.getByText('currency.title')).toBeInTheDocument()
  })

  it('shows converter section', () => {
    render(<CurrencyPage />)
    expect(screen.getByText('currency.converter')).toBeInTheDocument()
    expect(screen.getByText('currency.convert')).toBeInTheDocument()
  })

  it('shows stat cards', async () => {
    render(<CurrencyPage />)

    await waitFor(() => {
      expect(screen.getByText('currency.rate_count')).toBeInTheDocument()
      expect(screen.getByText('currency.last_updated')).toBeInTheDocument()
    })
  })

  it('opens update rate modal', async () => {
    render(<CurrencyPage />)

    await waitFor(() => {
      expect(screen.getByText('150.5000')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const editButtons = screen.getAllByText('common.edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('currency.update_rate_modal')).toBeInTheDocument()
      expect(screen.getByText('currency.new_rate')).toBeInTheDocument()
    })
  })
})
