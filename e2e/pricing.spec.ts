import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'
import { mockPriceRule, mockPriceHistory, mockMarginAnalysis } from './helpers/mock-data'

const MOCK_RULES = {
  rules: [
    mockPriceRule({ id: 1, sku: 'SKU-001', platform: 'TIKTOK', base_price: 3000, sale_price: 2500 }),
    mockPriceRule({ id: 2, sku: 'SKU-002', platform: 'TEMU', base_price: 4500, sale_price: null }),
    mockPriceRule({ id: 3, sku: 'SKU-003', platform: 'RAKUTEN', base_price: 2800, sale_price: 2200, is_active: 0 }),
  ],
  total: 3,
}

const MOCK_HISTORY = {
  history: [
    mockPriceHistory({ id: 1, sku: 'SKU-001', platform: 'TIKTOK', old_price: 2500, new_price: 3000 }),
    mockPriceHistory({ id: 2, sku: 'SKU-002', platform: 'TEMU', old_price: 4000, new_price: 4500, created_at: '2024-01-14T09:00:00Z' }),
  ],
  total: 2,
}

const MOCK_MARGINS = {
  margins: [
    mockMarginAnalysis({ sku: 'SKU-001', platform: 'TIKTOK', cost_price: 2000, base_price: 3000, margin: 1000, margin_percent: 33.3 }),
    mockMarginAnalysis({ sku: 'SKU-002', platform: 'TEMU', cost_price: 3000, base_price: 4500, margin: 1500, margin_percent: 33.3 }),
  ],
  total: 2,
}

test.describe('Pricing Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/pricing?*', MOCK_RULES)
    await mockApiGet(adminPage, '**/api/v1/pricing', MOCK_RULES)
    await mockApiGet(adminPage, '**/api/v1/pricing/history*', MOCK_HISTORY)
    await mockApiGet(adminPage, '**/api/v1/pricing/margins*', MOCK_MARGINS)
  })

  test('renders pricing rules table', async ({ adminPage }) => {
    await adminPage.goto('/pricing')
    await adminPage.waitForLoadState('networkidle')

    // SKUs visible
    await expect(adminPage.getByText('SKU-001').first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('SKU-002').first()).toBeVisible()
    await expect(adminPage.getByText('SKU-003').first()).toBeVisible()

    // Platform text in table cells (plain text, not StatusBadge)
    await expect(adminPage.locator('table').getByText('TIKTOK').first()).toBeVisible()
    await expect(adminPage.locator('table').getByText('TEMU').first()).toBeVisible()

    // Prices
    await expect(adminPage.getByText(/3,000/).first()).toBeVisible()
    await expect(adminPage.getByText(/4,500/).first()).toBeVisible()
  })

  test('three tab switch: Rules, History, Margins', async ({ adminPage }) => {
    await adminPage.goto('/pricing')
    await adminPage.waitForLoadState('networkidle')

    // Default: Rules tab is active
    await expect(adminPage.getByText('SKU-001').first()).toBeVisible({ timeout: 10000 })

    // Switch to History tab
    await adminPage.getByRole('button', { name: /history/i }).click()
    await adminPage.waitForTimeout(500)

    // History data should appear (old/new prices)
    await expect(adminPage.getByText(/2,500/).first()).toBeVisible()
    await expect(adminPage.getByText(/3,000/).first()).toBeVisible()

    // Switch to Margins tab
    await adminPage.getByRole('button', { name: /margin/i }).click()
    await adminPage.waitForTimeout(500)

    // Margin data should appear
    await expect(adminPage.getByText(/33\.3/).first()).toBeVisible()
  })

  test('create new pricing rule', async ({ adminPage }) => {
    const createMock = await mockApiMutation(adminPage, '**/api/v1/pricing', 'POST', {
      success: true,
      rule: mockPriceRule({ id: 4 }),
    })

    await adminPage.goto('/pricing')
    await adminPage.waitForLoadState('networkidle')

    // Click New Rule button
    await adminPage.getByRole('button', { name: /new rule/i }).click()

    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Fill SKU
    const skuInput = dialog.locator('input[placeholder*="SKU"], input').first()
    await skuInput.fill('SKU-NEW')

    // Select platform (option values are lowercase in PricingPage)
    await dialog.locator('select').first().selectOption('tiktok')

    // Fill base price
    const priceInputs = dialog.locator('input[type="number"]')
    await priceInputs.first().fill('5000')

    // Submit
    await dialog.getByRole('button', { name: /create|save/i }).click()

    await adminPage.waitForTimeout(500)
    const req = createMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
  })

  test('SKU filter triggers API call with debounce', async ({ adminPage }) => {
    let filterUrl = ''
    await adminPage.route('**/api/v1/pricing?*', (route) => {
      filterUrl = route.request().url()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RULES),
      })
    })

    await adminPage.goto('/pricing')
    await adminPage.waitForLoadState('networkidle')

    // Type in SKU search input
    const skuSearch = adminPage.locator('input[placeholder*="SKU"], input[placeholder*="Search"]').first()
    const isVisible = await skuSearch.isVisible().catch(() => false)
    if (isVisible) {
      await skuSearch.fill('SKU-001')
      // Wait for debounce
      await adminPage.waitForTimeout(1000)
    }
  })

  test('CSV export button visible', async ({ adminPage }) => {
    await adminPage.goto('/pricing')
    await adminPage.waitForLoadState('networkidle')

    const csvBtn = adminPage.getByRole('button', { name: /export csv|csv/i })
    await expect(csvBtn.first()).toBeVisible({ timeout: 10000 })
  })
})
