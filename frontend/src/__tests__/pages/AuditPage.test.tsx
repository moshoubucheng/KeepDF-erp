import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import AuditPage from '@/pages/audit/AuditPage'

vi.mock('@/api/endpoints/audit', () => ({
  auditApi: {
    list: vi.fn().mockResolvedValue({
      logs: [
        { id: 1, distributor_id: 1, action: 'CREATE_ORDER', resource_type: 'order', resource_id: '101', details: 'Created order #101', ip_address: '192.168.1.1', created_at: '2024-01-15T10:00:00Z' },
        { id: 2, distributor_id: null, action: 'UPDATE_PRODUCT', resource_type: 'product', resource_id: '5', details: 'Updated price', ip_address: '10.0.0.1', created_at: '2024-01-14T09:00:00Z' },
        { id: 3, distributor_id: 2, action: 'DELETE_CUSTOMER', resource_type: 'customer', resource_id: '20', details: null, ip_address: null, created_at: '2024-01-13T08:00:00Z' },
      ],
      total: 3,
      count: 3,
      hasMore: false,
    }),
  },
}))

// Mock auth store — default to admin so audit page renders
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuditPage', () => {
  it('renders audit log table', async () => {
    render(<AuditPage />)

    await waitFor(() => {
      expect(screen.getByText('CREATE_ORDER')).toBeInTheDocument()
      expect(screen.getByText('UPDATE_PRODUCT')).toBeInTheDocument()
      expect(screen.getByText('DELETE_CUSTOMER')).toBeInTheDocument()
    })
  })

  it('shows page title and subtitle', () => {
    render(<AuditPage />)
    expect(screen.getByText('audit.title')).toBeInTheDocument()
    expect(screen.getByText('audit.subtitle')).toBeInTheDocument()
  })

  it('opens filter panel on click', async () => {
    render(<AuditPage />)

    const user = userEvent.setup()
    const filterBtn = screen.getByText('common.filters')
    await user.click(filterBtn)

    await waitFor(() => {
      // audit.action appears as both column header and filter label
      expect(screen.getAllByText('audit.action').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('audit.startDate')).toBeInTheDocument()
    })
  })

  it('shows date filter inputs when filters open', async () => {
    render(<AuditPage />)

    const user = userEvent.setup()
    await user.click(screen.getByText('common.filters'))

    await waitFor(() => {
      expect(screen.getByText('audit.startDate')).toBeInTheDocument()
      expect(screen.getByText('audit.endDate')).toBeInTheDocument()
    })
  })

  it('shows empty state', async () => {
    const { auditApi } = await import('@/api/endpoints/audit')
    vi.mocked(auditApi.list).mockResolvedValueOnce({
      logs: [],
      total: 0,
      count: 0,
      hasMore: false,
    })

    render(<AuditPage />)

    await waitFor(() => {
      expect(screen.getByText('audit.empty')).toBeInTheDocument()
    })
  })
})
