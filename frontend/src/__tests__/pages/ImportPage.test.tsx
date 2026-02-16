import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import ImportPage from '@/pages/import/ImportPage'

vi.mock('@/api/endpoints/import', () => ({
  importApi: {
    importProducts: vi.fn().mockResolvedValue({ total: 5, success: 4, errors: [{ message: 'Bad row', row: 3 }] }),
    importOrders: vi.fn().mockResolvedValue({ total: 3, success: 3, errors: [] }),
    batchUpdateStatus: vi.fn().mockResolvedValue({ success: 2, errors: [] }),
    getLogs: vi.fn().mockResolvedValue({
      logs: [
        { id: 1, action: 'IMPORT_PRODUCTS', resource_type: 'product', details: 'Imported 5 products', created_at: '2024-01-15T10:00:00Z' },
        { id: 2, action: 'IMPORT_ORDERS', resource_type: 'order', details: 'Imported 3 orders', created_at: '2024-01-14T09:00:00Z' },
      ],
    }),
    getProductTemplateUrl: vi.fn().mockReturnValue('/api/v1/import/templates/products'),
    getOrderTemplateUrl: vi.fn().mockReturnValue('/api/v1/import/templates/orders'),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test-token' }
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

describe('ImportPage', () => {
  it('renders page title', () => {
    render(<ImportPage />)
    expect(screen.getByText('import.title')).toBeInTheDocument()
  })

  it('shows import cards for products and orders', () => {
    render(<ImportPage />)
    expect(screen.getByText('import.productImport')).toBeInTheDocument()
    expect(screen.getByText('import.orderImport')).toBeInTheDocument()
  })

  it('shows template download buttons', () => {
    render(<ImportPage />)
    const templateBtns = screen.getAllByText('import.template')
    expect(templateBtns.length).toBe(2)
  })

  it('shows import history table', async () => {
    render(<ImportPage />)
    await waitFor(() => {
      expect(screen.getByText('IMPORT_PRODUCTS')).toBeInTheDocument()
      expect(screen.getByText('IMPORT_ORDERS')).toBeInTheDocument()
    })
  })

  it('shows batch update section', () => {
    render(<ImportPage />)
    expect(screen.getByText('import.batchUpdate')).toBeInTheDocument()
  })

  it('has disabled upload buttons without file selection', () => {
    render(<ImportPage />)
    const uploadBtns = screen.getAllByText('import.upload')
    uploadBtns.forEach((btn) => {
      expect(btn.closest('button')).toBeDisabled()
    })
  })

  it('shows empty history when no logs', async () => {
    const { importApi } = await import('@/api/endpoints/import')
    vi.mocked(importApi.getLogs).mockResolvedValueOnce({ logs: [] })

    render(<ImportPage />)
    await waitFor(() => {
      expect(screen.getByText('import.emptyHistory')).toBeInTheDocument()
    })
  })
})
