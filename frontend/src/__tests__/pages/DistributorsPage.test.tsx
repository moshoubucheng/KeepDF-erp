import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import DistributorsPage from '@/pages/distributors/DistributorsPage'

vi.mock('@/api/endpoints/distributors', () => ({
  distributorsApi: {
    list: vi.fn().mockResolvedValue({
      distributors: [
        { id: 1, name: 'Alice Store', username: 'alice', role: 'admin', balance: 50000, frozen_balance: 0, tax_reg_number: 'T1234567890123', totp_enabled: 1, created_at: '2024-01-10T10:00:00Z' },
        { id: 2, name: 'Bob Shop', username: 'bob', role: 'distributor', balance: 30000, frozen_balance: 5000, tax_reg_number: null, totp_enabled: 0, created_at: '2024-01-12T10:00:00Z' },
      ],
      total: 2,
      count: 2,
      hasMore: false,
    }),
    create: vi.fn().mockResolvedValue({ success: true, distributor: {} }),
    update: vi.fn().mockResolvedValue({ success: true, distributor: {} }),
    resetToken: vi.fn().mockResolvedValue({ success: true, token: 'new-token-abc' }),
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

describe('DistributorsPage', () => {
  it('renders distributors list', async () => {
    render(<DistributorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Alice Store')).toBeInTheDocument()
      expect(screen.getByText('Bob Shop')).toBeInTheDocument()
    })
  })

  it('opens create modal', async () => {
    render(<DistributorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Alice Store')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    // Button and modal title share 'distributors.add' text - click the button
    const addButtons = screen.getAllByText('distributors.add')
    await user.click(addButtons[0])

    await waitFor(() => {
      // Password field is unique to create modal (not shown in edit)
      expect(screen.getByText('distributors.password')).toBeInTheDocument()
    })
  })

  it('opens edit modal', async () => {
    render(<DistributorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Alice Store')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const editButtons = screen.getAllByTitle('common.edit')
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('distributors.edit')).toBeInTheDocument()
    })
  })

  it('opens reset token modal', async () => {
    render(<DistributorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Alice Store')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const resetButtons = screen.getAllByTitle('distributors.resetToken')
    await user.click(resetButtons[0])

    await waitFor(() => {
      expect(screen.getByText('distributors.resetTokenConfirm', { exact: false })).toBeInTheDocument()
    })
  })

  it('shows empty state', async () => {
    const { distributorsApi } = await import('@/api/endpoints/distributors')
    vi.mocked(distributorsApi.list).mockResolvedValueOnce({
      distributors: [],
      total: 0,
      count: 0,
      hasMore: false,
    })

    render(<DistributorsPage />)

    await waitFor(() => {
      expect(screen.getByText('distributors.empty')).toBeInTheDocument()
    })
  })
})
