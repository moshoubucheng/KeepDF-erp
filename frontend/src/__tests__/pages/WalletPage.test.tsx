import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import WalletPage from '@/pages/wallet/WalletPage'

vi.mock('@/api/endpoints/wallet', () => ({
  walletApi: {
    balance: vi.fn().mockResolvedValue({ distributorId: 1, balance: 50000, frozen_balance: 10000 }),
    transactions: vi.fn().mockResolvedValue({
      distributorId: 1,
      transactions: [
        { id: 1, distributor_id: 1, type: 'DEPOSIT', amount: 30000, related_order_id: null, balance_snapshot: 30000, created_at: '2024-01-15T10:00:00Z' },
        { id: 2, distributor_id: 1, type: 'DEDUCT', amount: 5000, related_order_id: '101', balance_snapshot: 25000, created_at: '2024-01-14T09:00:00Z' },
        { id: 3, distributor_id: 1, type: 'REFUND', amount: 2000, related_order_id: '102', balance_snapshot: 27000, created_at: '2024-01-13T08:00:00Z' },
      ],
    }),
    deposit: vi.fn().mockResolvedValue({ status: 'ok', transaction: {} }),
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

describe('WalletPage', () => {
  it('renders balance stat cards', async () => {
    render(<WalletPage />)

    await waitFor(() => {
      expect(screen.getByText('wallet.availableBalance')).toBeInTheDocument()
      expect(screen.getByText('wallet.frozenBalance')).toBeInTheDocument()
      expect(screen.getByText('wallet.totalAssets')).toBeInTheDocument()
    })
  })

  it('renders transaction history', async () => {
    render(<WalletPage />)

    await waitFor(() => {
      expect(screen.getByText('wallet.type_deposit')).toBeInTheDocument()
      expect(screen.getByText('wallet.type_deduct')).toBeInTheDocument()
      expect(screen.getByText('wallet.type_refund')).toBeInTheDocument()
    })
  })

  it('opens deposit modal', async () => {
    render(<WalletPage />)

    const user = userEvent.setup()
    const depositBtn = screen.getByText('wallet.deposit')
    await user.click(depositBtn)

    await waitFor(() => {
      expect(screen.getByText('wallet.depositTitle')).toBeInTheDocument()
      expect(screen.getByText('wallet.depositAmount')).toBeInTheDocument()
    })
  })

  it('shows empty transaction state', async () => {
    const { walletApi } = await import('@/api/endpoints/wallet')
    vi.mocked(walletApi.transactions).mockResolvedValueOnce({ distributorId: 1, transactions: [] })

    render(<WalletPage />)

    await waitFor(() => {
      expect(screen.getByText('wallet.noTransactions')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<WalletPage />)
    expect(screen.getByText('wallet.title')).toBeInTheDocument()
  })
})
