import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import PurchaseOrdersPage from '@/pages/purchase-orders/PurchaseOrdersPage'

vi.mock('@/api/endpoints/purchase-orders', () => ({
  purchaseOrdersApi: {
    list: vi.fn().mockResolvedValue({
      orders: [
        { id: 1, po_number: 'PO-20240115-001', supplier_id: 1, supplier_name: 'Supplier A', status: 'DRAFT', total_amount: 50000, expected_delivery: '2024-02-01', created_at: '2024-01-15T10:00:00Z' },
        { id: 2, po_number: 'PO-20240116-002', supplier_id: 2, supplier_name: 'Supplier B', status: 'CONFIRMED', total_amount: 80000, expected_delivery: '2024-02-15', created_at: '2024-01-16T10:00:00Z' },
      ],
      total: 2,
    }),
    create: vi.fn().mockResolvedValue({ order: {} }),
    updateStatus: vi.fn().mockResolvedValue({ status: 'ok' }),
    receive: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}))

vi.mock('@/api/endpoints/suppliers', () => ({
  suppliersApi: {
    list: vi.fn().mockResolvedValue({
      suppliers: [
        { id: 1, name: 'Supplier A' },
        { id: 2, name: 'Supplier B' },
      ],
      total: 2,
    }),
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

describe('PurchaseOrdersPage', () => {
  it('renders PO list with po_number', async () => {
    render(<PurchaseOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('PO-20240115-001')).toBeInTheDocument()
      expect(screen.getByText('PO-20240116-002')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<PurchaseOrdersPage />)
    expect(screen.getByText('po.page_title')).toBeInTheDocument()
  })

  it('shows stat cards', async () => {
    render(<PurchaseOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('po.status_draft')).toBeInTheDocument()
      expect(screen.getByText('po.status_submitted')).toBeInTheDocument()
      expect(screen.getByText('po.status_confirmed')).toBeInTheDocument()
      expect(screen.getByText('po.status_shipped')).toBeInTheDocument()
    })
  })

  it('opens create modal', async () => {
    render(<PurchaseOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('PO-20240115-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const newBtn = screen.getByText('po.new_order')
    await user.click(newBtn)

    await waitFor(() => {
      expect(screen.getByText('po.modal_create')).toBeInTheDocument()
      expect(screen.getByText('po.line_items')).toBeInTheDocument()
    })
  })

  it('has CSV export button', () => {
    render(<PurchaseOrdersPage />)
    expect(screen.getByText('po.csv_export')).toBeInTheDocument()
  })
})
