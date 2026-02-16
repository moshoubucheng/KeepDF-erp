import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import SuppliersPage from '@/pages/suppliers/SuppliersPage'

vi.mock('@/api/endpoints/suppliers', () => ({
  suppliersApi: {
    list: vi.fn().mockResolvedValue({
      suppliers: [
        { id: 1, name: 'Supplier A', contact_person: 'Tanaka', email: 'a@test.com', phone: '090-1111', address: 'Tokyo', lead_time_days: 7, is_active: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'Supplier B', contact_person: 'Suzuki', email: 'b@test.com', phone: '090-2222', address: 'Osaka', lead_time_days: 14, is_active: 0, created_at: '2024-01-02T00:00:00Z' },
      ],
      total: 2,
    }),
    create: vi.fn().mockResolvedValue({ supplier: {} }),
    update: vi.fn().mockResolvedValue({ supplier: {} }),
    delete: vi.fn().mockResolvedValue({ status: 'ok' }),
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

describe('SuppliersPage', () => {
  it('renders supplier list', async () => {
    render(<SuppliersPage />)

    await waitFor(() => {
      expect(screen.getByText('Supplier A')).toBeInTheDocument()
      expect(screen.getByText('Supplier B')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<SuppliersPage />)
    expect(screen.getByText('supplier.page_title')).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    render(<SuppliersPage />)

    await waitFor(() => {
      expect(screen.getByText('Supplier A')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const addBtn = screen.getByText('supplier.add_new')
    await user.click(addBtn)

    await waitFor(() => {
      expect(screen.getByText('supplier.modal_create')).toBeInTheDocument()
      expect(screen.getByText('supplier.email_address')).toBeInTheDocument()
    })
  })

  it('shows active/inactive stat cards', async () => {
    render(<SuppliersPage />)

    await waitFor(() => {
      expect(screen.getByText('common.active')).toBeInTheDocument()
      expect(screen.getByText('common.inactive')).toBeInTheDocument()
    })
  })

  it('shows empty state', async () => {
    const { suppliersApi } = await import('@/api/endpoints/suppliers')
    vi.mocked(suppliersApi.list).mockResolvedValueOnce({ suppliers: [], total: 0 })

    render(<SuppliersPage />)

    await waitFor(() => {
      expect(screen.getByText('supplier.empty')).toBeInTheDocument()
    })
  })
})
