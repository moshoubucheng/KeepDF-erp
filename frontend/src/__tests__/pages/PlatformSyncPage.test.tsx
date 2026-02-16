import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import PlatformSyncPage from '@/pages/platform-sync/PlatformSyncPage'

vi.mock('@/api/endpoints/platform-sync', () => ({
  platformSyncApi: {
    sync: vi.fn().mockResolvedValue({ success: true, platform: 'TIKTOK', ordersFetched: 10, ordersQueued: 5 }),
    logs: vi.fn().mockResolvedValue({
      logs: [
        { id: 1, platform: 'TIKTOK', trigger: 'manual', status: 'completed', orders_fetched: 10, orders_created: 5, errors: null, started_at: '2024-01-15T10:00:00Z', completed_at: '2024-01-15T10:01:00Z' },
        { id: 2, platform: 'TEMU', trigger: 'cron', status: 'failed', orders_fetched: 0, orders_created: 0, errors: 'API timeout', started_at: '2024-01-14T09:00:00Z', completed_at: null },
      ],
      count: 2,
    }),
  },
}))

const mockAuthStore = vi.fn()
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (...args: unknown[]) => mockAuthStore(...args),
}))

vi.mock('@/stores/ui.store', () => ({
  useUIStore: vi.fn((selector) => {
    const state = { addToast: vi.fn() }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthStore.mockImplementation((selector) => {
    const state = { isAdmin: true, user: { id: 1, name: 'Admin', role: 'admin' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  })
})

describe('PlatformSyncPage', () => {
  it('renders page title', () => {
    render(<PlatformSyncPage />)
    expect(screen.getByText('platformSync.title')).toBeInTheDocument()
  })

  it('shows access denied for non-admin', () => {
    mockAuthStore.mockImplementation((selector) => {
      const state = { isAdmin: false, user: { id: 2, name: 'User', role: 'distributor' }, token: 'test' }
      return typeof selector === 'function' ? selector(state) : state
    })
    render(<PlatformSyncPage />)
    expect(screen.getByText('common.accessDenied')).toBeInTheDocument()
  })

  it('renders three platform cards', () => {
    render(<PlatformSyncPage />)
    // Each platform appears in card + filter dropdown (+ possibly in log table)
    expect(screen.getAllByText('TIKTOK').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('TEMU').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('RAKUTEN').length).toBeGreaterThanOrEqual(1)
  })

  it('shows sync buttons for each platform', () => {
    render(<PlatformSyncPage />)
    const syncBtns = screen.getAllByText('platformSync.syncNow')
    expect(syncBtns.length).toBe(3)
  })

  it('shows sync history table', async () => {
    render(<PlatformSyncPage />)
    await waitFor(() => {
      expect(screen.getByText('manual')).toBeInTheDocument()
      expect(screen.getByText('cron')).toBeInTheDocument()
    })
  })

  it('shows empty state when no logs', async () => {
    const { platformSyncApi } = await import('@/api/endpoints/platform-sync')
    vi.mocked(platformSyncApi.logs).mockResolvedValueOnce({ logs: [], count: 0 })

    render(<PlatformSyncPage />)
    await waitFor(() => {
      expect(screen.getByText('platformSync.emptyLogs')).toBeInTheDocument()
    })
  })

  it('shows platform filter dropdown', () => {
    render(<PlatformSyncPage />)
    expect(screen.getByText('common.all')).toBeInTheDocument()
  })
})
