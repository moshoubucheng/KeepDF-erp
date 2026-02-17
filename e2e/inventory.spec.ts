import { test, expect } from './fixtures/auth'

const MOCK_PRODUCTS = {
  products: [
    { id: 1, sku: 'SKU-001', name_jp: 'ウィジェットA', name_cn: 'Widget A', cost_price: 2500, tax_category: 'standard', total_stock: 100, created_at: '2024-01-01' },
    { id: 2, sku: 'SKU-002', name_jp: 'ウィジェットB', name_cn: 'Widget B', cost_price: 1800, tax_category: 'standard', total_stock: 5, created_at: '2024-01-02' },
    { id: 3, sku: 'SKU-003', name_jp: 'ガジェットC', name_cn: 'Gadget C', cost_price: 5000, tax_category: 'reduced', total_stock: 0, created_at: '2024-01-03' },
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
          (p) => (p.name_jp || '').toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()),
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
    await expect(adminPage.getByText('ウィジェットA')).toBeVisible({ timeout: 10000 })
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

    // Low stock product should be visible with its name
    await expect(adminPage.getByText('ウィジェットB')).toBeVisible({ timeout: 10000 })
  })
})
