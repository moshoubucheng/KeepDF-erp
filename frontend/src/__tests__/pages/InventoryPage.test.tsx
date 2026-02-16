import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import InventoryPage from '@/pages/inventory/InventoryPage'

vi.mock('@/api/endpoints/inventory', () => ({
  inventoryApi: {
    list: vi.fn().mockResolvedValue({
      products: [
        { id: 1, sku: 'SKU-001', name_jp: 'テスト商品A', name_cn: '测试商品A', cost_price: 1000, tax_category: 'standard', image_url: null, total_stock: 50 },
        { id: 2, sku: 'SKU-002', name_jp: 'テスト商品B', name_cn: '测试商品B', cost_price: 2000, tax_category: 'reduced', image_url: null, total_stock: 5 },
        { id: 3, sku: 'SKU-003', name_jp: 'テスト商品C', name_cn: null, cost_price: 500, tax_category: 'standard', image_url: null, total_stock: 0 },
      ],
    }),
    create: vi.fn().mockResolvedValue({ status: 'ok', sku: 'SKU-NEW' }),
    update: vi.fn().mockResolvedValue({ product: {} }),
    delete: vi.fn().mockResolvedValue({ status: 'ok', id: 1 }),
    inbound: vi.fn().mockResolvedValue({ status: 'ok', sku: 'SKU-001', actual: 10 }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InventoryPage', () => {
  it('renders product list with stock info', async () => {
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
      expect(screen.getByText('SKU-002')).toBeInTheDocument()
      expect(screen.getByText('SKU-003')).toBeInTheDocument()
      expect(screen.getByText('テスト商品A')).toBeInTheDocument()
    })
  })

  it('has search input', () => {
    render(<InventoryPage />)
    expect(screen.getByPlaceholderText('common.search')).toBeInTheDocument()
  })

  it('opens add product modal', async () => {
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    // Button and modal title share 'inventory.add_product' text
    const addButtons = screen.getAllByText('inventory.add_product')
    await user.click(addButtons[0])

    await waitFor(() => {
      // cost_price appears in both table header and modal label
      expect(screen.getAllByText('inventory.cost_price').length).toBeGreaterThanOrEqual(2)
      // common.save button only appears in the modal form
      expect(screen.getByText('common.save')).toBeInTheDocument()
    })
  })

  it('opens edit modal with pre-filled data', async () => {
    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('SKU-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const editButtons = screen.getAllByTitle('inventory.edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('SKU-001')).toBeInTheDocument()
      expect(screen.getByDisplayValue('テスト商品A')).toBeInTheDocument()
    })
  })

  it('shows empty state', async () => {
    const { inventoryApi } = await import('@/api/endpoints/inventory')
    vi.mocked(inventoryApi.list).mockResolvedValueOnce({ products: [] })

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('inventory.empty')).toBeInTheDocument()
    })
  })
})
