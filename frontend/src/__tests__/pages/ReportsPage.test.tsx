import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import ReportsPage from '@/pages/reports/ReportsPage'

vi.mock('@/api/endpoints/reports', () => ({
  reportsApi: {
    summary: vi.fn().mockResolvedValue({
      totalOrders: 150,
      totalRevenue: 1500000,
      avgOrderValue: 10000,
      profitMargin: 25.5,
    }),
    profitAnalysis: vi.fn().mockResolvedValue({
      data: [
        { name: 'Product A', revenue: 500000, cost: 300000, profit: 200000, margin: 40 },
        { name: 'Product B', revenue: 300000, cost: 200000, profit: 100000, margin: 33 },
      ],
    }),
    platformComparison: vi.fn().mockResolvedValue({
      platforms: [
        { platform: 'TikTok', orders: 80, revenue: 800000, avgOrder: 10000 },
        { platform: 'Temu', orders: 50, revenue: 500000, avgOrder: 10000 },
      ],
    }),
    trendComparison: vi.fn().mockResolvedValue({
      current: [
        { date: '2024-01-15', orders: 10, revenue: 100000 },
        { date: '2024-01-16', orders: 15, revenue: 150000 },
      ],
      previous: [],
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReportsPage', () => {
  it('renders stat cards', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('reports.totalOrders')).toBeInTheDocument()
      expect(screen.getByText('reports.totalRevenue')).toBeInTheDocument()
      expect(screen.getByText('reports.avgOrderValue')).toBeInTheDocument()
      expect(screen.getByText('reports.profitMargin')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<ReportsPage />)
    expect(screen.getByText('reports.title')).toBeInTheDocument()
  })

  it('shows period selector', () => {
    render(<ReportsPage />)

    expect(screen.getByText('7D')).toBeInTheDocument()
    expect(screen.getByText('30D')).toBeInTheDocument()
    expect(screen.getByText('90D')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
  })

  it('shows profit analysis section', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('reports.profitAnalysis')).toBeInTheDocument()
    })
  })

  it('shows platform comparison section', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('reports.platformComparison')).toBeInTheDocument()
    })
  })
})
