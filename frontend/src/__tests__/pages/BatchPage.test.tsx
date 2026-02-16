import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import BatchPage from '@/pages/batch/BatchPage'

vi.mock('@/api/endpoints/batch', () => ({
  batchApi: {
    updateOrderStatus: vi.fn().mockResolvedValue({ success: 3, errors: [] }),
    updateProducts: vi.fn().mockResolvedValue({ success: 2, errors: [] }),
    adjustStock: vi.fn().mockResolvedValue({ success: 1, errors: [] }),
  },
}))

const mockAuthStore = vi.fn()
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (...args: unknown[]) => mockAuthStore(...args),
}))

vi.mock('@/stores/ui.store', () => ({
  useUIStore: vi.fn((selector) => {
    const state = { addToast: vi.fn() }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthStore.mockImplementation((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  })
})

describe('BatchPage', () => {
  it('renders page title', () => {
    render(<BatchPage />)
    expect(screen.getByText('batch.title')).toBeInTheDocument()
  })

  it('shows access denied for non-admin', () => {
    mockAuthStore.mockImplementation((selector) => {
      const state = { isAdmin: false, user: { id: 2, name: 'User', role: 'distributor' }, token: 'test' }
      return typeof selector === 'function' ? selector(state) : state
    })
    render(<BatchPage />)
    expect(screen.getByText('common.accessDenied')).toBeInTheDocument()
  })

  it('renders three tabs', () => {
    render(<BatchPage />)
    expect(screen.getByText('batch.tabOrders')).toBeInTheDocument()
    expect(screen.getByText('batch.tabProducts')).toBeInTheDocument()
    expect(screen.getByText('batch.tabStock')).toBeInTheDocument()
  })

  it('defaults to order status tab', () => {
    render(<BatchPage />)
    expect(screen.getByText('batch.orderHint')).toBeInTheDocument()
  })

  it('switches to product tab', async () => {
    render(<BatchPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('batch.tabProducts'))
    await waitFor(() => {
      expect(screen.getByText('batch.productHint')).toBeInTheDocument()
    })
  })

  it('switches to stock tab', async () => {
    render(<BatchPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('batch.tabStock'))
    await waitFor(() => {
      expect(screen.getByText('batch.stockHint')).toBeInTheDocument()
    })
  })

  it('shows order ID textarea', () => {
    render(<BatchPage />)
    const textarea = screen.getByPlaceholderText('101, 102, 103')
    expect(textarea).toBeInTheDocument()
  })

  it('shows add/remove row buttons on product tab', async () => {
    render(<BatchPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('batch.tabProducts'))
    await waitFor(() => {
      expect(screen.getByText('batch.addRow')).toBeInTheDocument()
    })
  })
})
