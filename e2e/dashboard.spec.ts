import { test, expect } from './fixtures/auth'

// Mock dashboard API endpoints
async function mockDashboardAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/dashboard/stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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
    }),
  )

  await page.route('**/api/v1/dashboard/recent-orders*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orders: [
          { id: 1, platform: 'TIKTOK', platform_order_id: 'TT-001', status: 'PROCESSING', total_amount: 5000, tax_total: 500, distributor_id: 1, created_at: '2024-01-15T10:00:00Z' },
          { id: 2, platform: 'TEMU', platform_order_id: 'TM-002', status: 'SHIPPED', total_amount: 3000, tax_total: 300, distributor_id: 1, created_at: '2024-01-14T09:00:00Z' },
        ],
        pagination: { total: 2, page: 1, limit: 5, pages: 1 },
      }),
    }),
  )

  await page.route('**/api/v1/dashboard/revenue-trend*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        period: '30d',
        groupBy: 'day',
        data: [
          { date: '2024-01-01', orderCount: 5, revenue: 10000 },
          { date: '2024-01-02', orderCount: 8, revenue: 15000 },
        ],
      }),
    }),
  )

  await page.route('**/api/v1/dashboard/orders-by-platform*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        period: '30d',
        platforms: [
          { platform: 'TIKTOK', orderCount: 50, revenue: 200000, percentage: 40 },
          { platform: 'TEMU', orderCount: 40, revenue: 150000, percentage: 30 },
        ],
        total: { orders: 120, revenue: 500000 },
      }),
    }),
  )

  await page.route('**/api/v1/dashboard/sales-heatmap*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )

  await page.route('**/api/v1/dashboard/inventory-turnover*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockDashboardAPIs(adminPage)
  })

  test('renders stat cards with data', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Check that stat values appear (formatted numbers)
    await expect(adminPage.getByText('120')).toBeVisible({ timeout: 10000 })
  })

  test('renders chart containers', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // ECharts renders into canvas elements
    const canvases = adminPage.locator('canvas')
    await expect(canvases.first()).toBeVisible({ timeout: 10000 })
  })

  test('shows period selector buttons', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Period buttons: 7d, 30d, 90d
    await expect(adminPage.getByRole('button', { name: '7' })).toBeVisible({ timeout: 10000 })
  })

  test('shows quick action buttons', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Quick actions section should be visible
    const quickActionsSection = adminPage.locator('text=/quick/i').first()
    await expect(quickActionsSection).toBeVisible({ timeout: 10000 })
  })

  test('shows recent orders table', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('TT-001')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('TM-002')).toBeVisible({ timeout: 10000 })
  })
})
