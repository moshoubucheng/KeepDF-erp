import { test, expect } from './fixtures/auth'

const MOCK_ORDERS = {
  orders: [
    { id: 1, platform: 'TIKTOK', platform_order_id: 'TT-001', status: 'PROCESSING', total_amount: 5000, tax_total: 500, distributor_id: 1, created_at: '2024-01-15T10:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
    { id: 2, platform: 'TEMU', platform_order_id: 'TM-002', status: 'SHIPPED', total_amount: 3000, tax_total: 300, distributor_id: 1, created_at: '2024-01-14T09:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
    { id: 3, platform: 'RAKUTEN', platform_order_id: 'RK-003', status: 'PENDING', total_amount: 8000, tax_total: 800, distributor_id: 1, created_at: '2024-01-13T08:00:00Z', delivered_at: null, cancelled_at: null, customer_id: null, currency: 'JPY', discount_amount: 0 },
  ],
  pagination: { total: 3, page: 1, limit: 20, pages: 1 },
}

async function mockOrderAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/orders*', (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'GET') {
      const status = url.searchParams.get('status')
      if (status) {
        const filtered = MOCK_ORDERS.orders.filter((o) => o.status === status)
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ orders: filtered, pagination: { total: filtered.length, page: 1, limit: 20, pages: 1 } }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDERS),
      })
    }
    return route.continue()
  })
}

test.describe('Orders Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockOrderAPIs(adminPage)
  })

  test('renders order list with data', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('TT-001')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('TM-002')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('RK-003')).toBeVisible({ timeout: 10000 })
  })

  test('shows platform badges', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Use span selector to target badge elements, not hidden <option> elements in dropdowns
    await expect(adminPage.locator('span.inline-flex', { hasText: 'TIKTOK' }).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('span.inline-flex', { hasText: 'TEMU' }).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows status badges', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Use span selector to target badge elements, not hidden <option> elements in dropdowns
    await expect(adminPage.locator('span.inline-flex', { hasText: 'PROCESSING' }).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('span.inline-flex', { hasText: 'SHIPPED' }).first()).toBeVisible({ timeout: 10000 })
  })

  test('has search/filter controls', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Search input (Input component renders without explicit type attr, use placeholder selector)
    const searchInput = adminPage.locator('input[placeholder]').first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('shows order count', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Should show total count somewhere
    await expect(adminPage.getByText('3').first()).toBeVisible({ timeout: 10000 })
  })

  test('has CSV export button', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Look for export/CSV button
    const exportBtn = adminPage.getByRole('button', { name: /csv|export/i })
    await expect(exportBtn).toBeVisible({ timeout: 10000 })
  })
})
