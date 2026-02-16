import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import CustomersPage from '@/pages/customers/CustomersPage'

vi.mock('@/api/endpoints/customers', () => ({
  customersApi: {
    list: vi.fn().mockResolvedValue({
      customers: [
        { id: 1, name: 'Tanaka Taro', email: 'tanaka@example.com', phone: '090-1234-5678', address_line1: '1-2-3 Shibuya', city: 'Tokyo', prefecture: 'Tokyo', postal_code: '150-0001', country: 'JP', platform: 'TIKTOK', tags: 'VIP,wholesale', notes: null, distributor_id: 1, created_at: '2024-01-15T10:00:00Z' },
        { id: 2, name: 'Suzuki Hanako', email: 'suzuki@example.com', phone: '080-9876-5432', address_line1: null, city: null, prefecture: null, postal_code: null, country: 'JP', platform: 'TEMU', tags: '', notes: null, distributor_id: 1, created_at: '2024-01-14T09:00:00Z' },
        { id: 3, name: 'Yamada Jiro', email: null, phone: null, address_line1: null, city: null, prefecture: null, postal_code: null, country: 'JP', platform: null, tags: '', notes: null, distributor_id: 1, created_at: '2024-01-13T08:00:00Z' },
      ],
      total: 3,
      count: 3,
    }),
    create: vi.fn().mockResolvedValue({ success: true, customer: {} }),
    update: vi.fn().mockResolvedValue({ customer: {} }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CustomersPage', () => {
  it('renders customer list', async () => {
    render(<CustomersPage />)

    await waitFor(() => {
      expect(screen.getByText('Tanaka Taro')).toBeInTheDocument()
      expect(screen.getByText('Suzuki Hanako')).toBeInTheDocument()
      expect(screen.getByText('Yamada Jiro')).toBeInTheDocument()
    })
  })

  it('has search input', () => {
    render(<CustomersPage />)
    expect(screen.getByPlaceholderText('common.search')).toBeInTheDocument()
  })

  it('opens add customer modal', async () => {
    render(<CustomersPage />)

    const user = userEvent.setup()
    const addBtn = screen.getByText('customers.add')
    await user.click(addBtn)

    await waitFor(() => {
      // Modal should show name and email fields
      const nameInputs = screen.getAllByRole('textbox')
      expect(nameInputs.length).toBeGreaterThan(0)
    })
  })

  it('opens edit modal with pre-filled data', async () => {
    render(<CustomersPage />)

    await waitFor(() => {
      expect(screen.getByText('Tanaka Taro')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const editButtons = screen.getAllByTitle('customers.edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      // Should find input with the customer's name pre-filled
      const nameInput = screen.getByDisplayValue('Tanaka Taro')
      expect(nameInput).toBeInTheDocument()
    })
  })

  it('shows empty state', async () => {
    const { customersApi } = await import('@/api/endpoints/customers')
    vi.mocked(customersApi.list).mockResolvedValueOnce({ customers: [], total: 0, count: 0 })

    render(<CustomersPage />)

    await waitFor(() => {
      expect(screen.getByText('customers.empty')).toBeInTheDocument()
    })
  })
})
