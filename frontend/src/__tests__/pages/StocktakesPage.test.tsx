import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import StocktakesPage from '@/pages/stocktakes/StocktakesPage'

vi.mock('@/api/endpoints/stocktakes', () => ({
  stocktakesApi: {
    list: vi.fn().mockResolvedValue({
      stocktakes: [
        { id: 1, status: 'DRAFT', total_items: 10, discrepancy_count: 0, notes: 'Monthly check', created_at: '2024-01-15T10:00:00Z', completed_at: null },
        { id: 2, status: 'IN_PROGRESS', total_items: 25, discrepancy_count: 3, notes: null, created_at: '2024-01-16T10:00:00Z', completed_at: null },
        { id: 3, status: 'COMPLETED', total_items: 15, discrepancy_count: 1, notes: 'Q1 audit', created_at: '2024-01-10T10:00:00Z', completed_at: '2024-01-12T10:00:00Z' },
      ],
      total: 3,
    }),
    create: vi.fn().mockResolvedValue({ stocktake: {} }),
    start: vi.fn().mockResolvedValue({ status: 'ok' }),
    complete: vi.fn().mockResolvedValue({ status: 'ok' }),
    cancel: vi.fn().mockResolvedValue({ status: 'ok' }),
    get: vi.fn().mockResolvedValue({ id: 1, status: 'DRAFT', total_items: 10, discrepancy_count: 0, items: [] }),
    countItem: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}))

// Mock window.confirm
const mockConfirm = vi.fn(() => true)
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true })

// Admin mock - default
const mockAuthState = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    return typeof selector === 'function' ? selector(mockAuthState) : mockAuthState
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockReturnValue(true)
  mockAuthState.isAdmin = true
})

describe('StocktakesPage', () => {
  it('renders stocktake list (admin)', async () => {
    render(<StocktakesPage />)

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
      expect(screen.getByText('#3')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<StocktakesPage />)
    expect(screen.getByText('stocktakes.title')).toBeInTheDocument()
  })

  it('shows admin-only message for non-admin', () => {
    mockAuthState.isAdmin = false
    render(<StocktakesPage />)

    expect(screen.getByText('stocktakes.adminOnly')).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    render(<StocktakesPage />)

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    // stocktakes.create text appears as both button and modal title
    const createBtns = screen.getAllByText('stocktakes.create')
    await user.click(createBtns[0])

    await waitFor(() => {
      expect(screen.getByText('stocktakes.createBtn')).toBeInTheDocument()
    })
  })

  it('shows start button for DRAFT', async () => {
    render(<StocktakesPage />)

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument()
    })

    // DRAFT items have a start button
    const startButtons = screen.getAllByText('stocktakes.start')
    expect(startButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows complete button for IN_PROGRESS', async () => {
    render(<StocktakesPage />)

    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument()
    })

    // IN_PROGRESS items have a complete button
    const completeButtons = screen.getAllByText('stocktakes.complete')
    expect(completeButtons.length).toBeGreaterThanOrEqual(1)
  })
})
