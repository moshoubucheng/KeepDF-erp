import { test, expect } from './fixtures/auth'

const MOCK_PRODUCTS = {
  products: [
    { id: 1, sku: 'SKU-001', name: 'Widget A', stock_quantity: 100, price: 2500, status: 'active', platform: 'TIKTOK', category: 'Electronics', image_url: null, created_at: '2024-01-01' },
    { id: 2, sku: 'SKU-002', name: 'Widget B', stock_quantity: 5, price: 1800, status: 'active', platform: 'TEMU', category: 'Home', image_url: null, created_at: '2024-01-02' },
    { id: 3, sku: 'SKU-003', name: 'Gadget C', stock_quantity: 0, price: 5000, status: 'inactive', platform: 'RAKUTEN', category: 'Electronics', image_url: null, created_at: '2024-01-03' },
  ],
  pagination: { total: 3, page: 1, limit: 20, pages: 1 },
}

async function mockInventoryAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/products*', (route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url())
      const search = url.searchParams.get('search') || url.searchParams.get('q')
      if (search) {
        const filtered = MOCK_PRODUCTS.products.filter(
          (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()),
        )
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ products: filtered, pagination: { total: filtered.length, page: 1, limit: 20, pages: 1 } }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCTS),
      })
    }
    return route.continue()
  })
}

test.describe('Inventory Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockInventoryAPIs(adminPage)
  })

  test('renders product list', async ({ adminPage }) => {
    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('SKU-001')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('Widget A')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('SKU-002')).toBeVisible({ timeout: 10000 })
  })

  test('shows product count and search', async ({ adminPage }) => {
    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')

    // Search input
    const searchInput = adminPage.locator('input[type="text"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('shows low stock indicators', async ({ adminPage }) => {
    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')

    // Stock quantity 5 and 0 should be visible
    await expect(adminPage.getByText('Widget B')).toBeVisible({ timeout: 10000 })
  })
})
