import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import DashboardPage from '@/pages/dashboard'

// Mock echarts-for-react/lib/core — jsdom has no canvas
vi.mock('echarts-for-react/lib/core', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echart-mock" style={props.style as React.CSSProperties} />
  ),
}))

vi.mock('@/lib/echarts', () => ({ default: {} }))

vi.mock('@/api/endpoints/dashboard', () => ({
  dashboardApi: {
    stats: vi.fn().mockResolvedValue({
      role: 'admin',
      overview: {
        totalOrders: 120,
        pendingOrders: 10,
        processingOrders: 15,
        totalRevenue: 500000,
        totalProducts: 45,
        lowStockCount: 3,
        totalDistributors: 5,
        totalCommission: 75000,
      },
      wallet: { balance: 200000, frozen_balance: 30000 },
    }),
    recentOrders: vi.fn().mockResolvedValue({
      orders: [
        { id: 1, platform: 'TIKTOK', platform_order_id: 'TT-001', status: 'PROCESSING', total_amount: 5000, tax_total: 500, distributor_id: 1, created_at: '2024-01-15T10:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
        { id: 2, platform: 'TEMU', platform_order_id: 'TM-002', status: 'SHIPPED', total_amount: 3000, tax_total: 300, distributor_id: 1, created_at: '2024-01-14T09:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
      ],
      pagination: { total: 2, page: 1, limit: 5, pages: 1 },
    }),
    revenueTrend: vi.fn().mockResolvedValue({
      period: '30d',
      groupBy: 'day',
      data: [
        { date: '2024-01-01', orderCount: 5, revenue: 10000 },
        { date: '2024-01-02', orderCount: 8, revenue: 15000 },
      ],
    }),
    ordersByPlatform: vi.fn().mockResolvedValue({
      period: '30d',
      platforms: [
        { platform: 'TIKTOK', orderCount: 50, revenue: 200000, percentage: 40 },
        { platform: 'TEMU', orderCount: 40, revenue: 150000, percentage: 30 },
      ],
      total: { orders: 120, revenue: 500000 },
    }),
    salesHeatmap: vi.fn().mockResolvedValue({
      data: [
        { date: '2024-01-01', orderCount: 5, revenue: 10000 },
      ],
    }),
    inventoryTurnover: vi.fn().mockResolvedValue({
      data: [
        { sku: 'SKU-001', name: 'Widget A', soldQty: 100, currentStock: 50, turnoverRate: 2.0 },
        { sku: 'SKU-002', name: 'Widget B', soldQty: 50, currentStock: 30, turnoverRate: 1.67 },
      ],
    }),
  },
}))

let mockIsAdmin = true

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAdmin: mockIsAdmin, user: { id: 1, name: 'Admin', role: mockIsAdmin ? 'admin' : 'distributor' }, token: 'test' }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockIsAdmin = true
})

describe('DashboardPage', () => {
  it('renders admin stat cards', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('dashboard.total_revenue')).toBeInTheDocument()
      expect(screen.getByText('dashboard.total_orders')).toBeInTheDocument()
      expect(screen.getByText('dashboard.active_orders')).toBeInTheDocument()
      expect(screen.getByText('dashboard.products')).toBeInTheDocument()
    })
  })

  it('renders distributor stat cards when not admin', async () => {
    mockIsAdmin = false

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('dashboard.my_revenue')).toBeInTheDocument()
      expect(screen.getByText('dashboard.my_orders')).toBeInTheDocument()
      expect(screen.getByText('dashboard.my_commission')).toBeInTheDocument()
      expect(screen.getByText('dashboard.my_balance')).toBeInTheDocument()
    })
  })

  it('renders period selector buttons', () => {
    render(<DashboardPage />)

    expect(screen.getByText('dashboard.7d')).toBeInTheDocument()
    expect(screen.getByText('dashboard.30d')).toBeInTheDocument()
    expect(screen.getByText('dashboard.90d')).toBeInTheDocument()
  })

  it('renders charts (mocked echarts)', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      const charts = screen.getAllByTestId('echart-mock')
      expect(charts.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders recent orders table', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('TT-001')).toBeInTheDocument()
      expect(screen.getByText('TM-002')).toBeInTheDocument()
    })

    expect(screen.getByText('dashboard.view_all')).toBeInTheDocument()
  })

  it('shows quick action buttons', () => {
    render(<DashboardPage />)

    expect(screen.getByText('dashboard.quick_actions')).toBeInTheDocument()
    expect(screen.getByText('dashboard.quick_new_order')).toBeInTheDocument()
    expect(screen.getByText('dashboard.quick_add_product')).toBeInTheDocument()
    expect(screen.getByText('dashboard.quick_sync_platforms')).toBeInTheDocument()
    expect(screen.getByText('dashboard.quick_view_reports')).toBeInTheDocument()
  })
})
