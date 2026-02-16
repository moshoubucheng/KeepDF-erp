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
    listRestorable: vi.fn().mockResolvedValue({
      logs: [
        { id: 10, distributor_id: 1, action: 'UPDATE_ORDER', resource_type: 'order', resource_id: '50', details: null, ip_address: null, created_at: '2024-01-15T10:00:00Z', snapshot_id: 1, before_data: '{"status":"pending"}', after_data: '{"status":"shipped"}', distributor_name: 'Admin' },
        { id: 11, distributor_id: 1, action: 'DELETE_PRODUCT', resource_type: 'product', resource_id: '30', details: null, ip_address: null, created_at: '2024-01-14T09:00:00Z', snapshot_id: 2, before_data: '{"name":"Widget"}', after_data: 'null', distributor_name: 'Admin' },
      ],
      total: 2,
    }),
    getSnapshot: vi.fn().mockResolvedValue({
      snapshot: { id: 1, audit_log_id: 10, before_data: '{"status":"pending"}', after_data: '{"status":"shipped"}' },
    }),
    restore: vi.fn().mockResolvedValue({ success: true, restored: { table: 'orders', id: 50 } }),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

vi.mock('@/stores/ui.store', () => ({
  useUIStore: vi.fn((selector) => {
    const state = { addToast: vi.fn() }
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

  // --- Recovery tab tests ---

  it('renders tabs for logs and recovery', () => {
    render(<AuditPage />)
    expect(screen.getByText('audit.tabLogs')).toBeInTheDocument()
    expect(screen.getByText('audit.tabRecovery')).toBeInTheDocument()
  })

  it('defaults to logs tab', () => {
    render(<AuditPage />)
    // Logs tab content is visible (filter button)
    expect(screen.getByText('common.filters')).toBeInTheDocument()
  })

  it('switches to recovery tab', async () => {
    render(<AuditPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('audit.tabRecovery'))

    await waitFor(() => {
      expect(screen.getByText('UPDATE_ORDER')).toBeInTheDocument()
      expect(screen.getByText('DELETE_PRODUCT')).toBeInTheDocument()
    })
  })

  it('shows restorable entries with view and restore buttons', async () => {
    render(<AuditPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('audit.tabRecovery'))

    await waitFor(() => {
      const viewBtns = screen.getAllByText('audit.view')
      expect(viewBtns.length).toBe(2)
      const restoreBtns = screen.getAllByText('audit.restore')
      expect(restoreBtns.length).toBe(2)
    })
  })

  it('shows empty recovery state', async () => {
    const { auditApi } = await import('@/api/endpoints/audit')
    vi.mocked(auditApi.listRestorable).mockResolvedValueOnce({ logs: [], total: 0 })

    render(<AuditPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('audit.tabRecovery'))

    await waitFor(() => {
      expect(screen.getByText('audit.emptyRestorable')).toBeInTheDocument()
    })
  })

  it('opens snapshot modal with before/after JSON', async () => {
    render(<AuditPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('audit.tabRecovery'))

    await waitFor(() => {
      expect(screen.getAllByText('audit.view').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('audit.view')[0])

    await waitFor(() => {
      expect(screen.getByText('audit.before')).toBeInTheDocument()
      expect(screen.getByText('audit.after')).toBeInTheDocument()
    })
  })

  it('opens restore confirmation modal', async () => {
    render(<AuditPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('audit.tabRecovery'))

    await waitFor(() => {
      expect(screen.getAllByText('audit.restore').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('audit.restore')[0])

    await waitFor(() => {
      expect(screen.getByText('audit.confirmRestoreTitle')).toBeInTheDocument()
    })
  })

  it('calls restore API on confirmation', async () => {
    const { auditApi } = await import('@/api/endpoints/audit')

    render(<AuditPage />)
    const user = userEvent.setup()
    await user.click(screen.getByText('audit.tabRecovery'))

    await waitFor(() => {
      expect(screen.getAllByText('audit.restore').length).toBeGreaterThan(0)
    })

    // Click first restore button (in the table)
    await user.click(screen.getAllByText('audit.restore')[0])

    await waitFor(() => {
      expect(screen.getByText('audit.confirmRestoreTitle')).toBeInTheDocument()
    })

    // Click restore button inside modal — it's the last one
    const restoreBtns = screen.getAllByText('audit.restore')
    await user.click(restoreBtns[restoreBtns.length - 1])

    await waitFor(() => {
      expect(auditApi.restore).toHaveBeenCalledWith(10)
    })
  })
})
