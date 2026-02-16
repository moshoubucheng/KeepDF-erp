import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import SkuMappingsPage from '@/pages/sku-mappings/SkuMappingsPage'

vi.mock('@/api/endpoints/sku-mappings', () => ({
  skuMappingsApi: {
    list: vi.fn().mockResolvedValue({
      mappings: [
        { id: 1, local_sku: 'SKU-001', platform: 'tiktok', platform_sku: 'TT-SKU-001', platform_title: 'TikTok Product A', price_sync: 1, stock_sync: 1, is_active: 1, last_synced_at: '2024-01-15T10:00:00Z', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, local_sku: 'SKU-002', platform: 'temu', platform_sku: 'TM-SKU-002', platform_title: 'Temu Product B', price_sync: 0, stock_sync: 1, is_active: 1, last_synced_at: null, created_at: '2024-01-02T00:00:00Z' },
      ],
      total: 2,
    }),
    create: vi.fn().mockResolvedValue({ mapping: {} }),
    update: vi.fn().mockResolvedValue({ mapping: {} }),
    delete: vi.fn().mockResolvedValue({ status: 'ok' }),
    validate: vi.fn().mockResolvedValue({ total: 2, valid: 2, invalid: 0, errors: [] }),
    export: vi.fn().mockResolvedValue('local_sku,platform\nSKU-001,tiktok'),
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

// Mock window.confirm
const mockConfirm = vi.fn(() => true)
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true })

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockReturnValue(true)
})

describe('SkuMappingsPage', () => {
  it('renders mapping list with local_sku', async () => {
    render(<SkuMappingsPage />)

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
      expect(screen.getByText('SKU-002')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<SkuMappingsPage />)
    expect(screen.getByText('skuMappings.title')).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    render(<SkuMappingsPage />)

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const addBtn = screen.getByText('skuMappings.add')
    await user.click(addBtn)

    await waitFor(() => {
      expect(screen.getByText('skuMappings.selectPlatform')).toBeInTheDocument()
    })
  })

  it('has validate button', () => {
    render(<SkuMappingsPage />)
    expect(screen.getByText('skuMappings.validate')).toBeInTheDocument()
  })

  it('has CSV export button', () => {
    render(<SkuMappingsPage />)
    expect(screen.getByText('skuMappings.csvExport')).toBeInTheDocument()
  })

  it('shows platform filter', () => {
    render(<SkuMappingsPage />)
    expect(screen.getByText('skuMappings.allPlatforms')).toBeInTheDocument()
  })
})
