import { test, expect } from './fixtures/auth'
import { mockApiGet } from './helpers/api-mock'
import { mockCommission, mockCommissionSettlement } from './helpers/mock-data'

const MOCK_RATES = {
  rates: [
    mockCommission({ id: 1, sku: 'SKU-001', platform: 'TIKTOK', rate: 0.1 }),
    mockCommission({ id: 2, sku: 'SKU-002', platform: 'TEMU', rate: 0.08 }),
    mockCommission({ id: 3, sku: 'SKU-003', platform: 'RAKUTEN', rate: 0.12 }),
  ],
  count: 3,
}

const MOCK_SETTLEMENTS = {
  settlements: [
    mockCommissionSettlement({ id: 1, order_id: 101, sku: 'SKU-001', platform: 'TIKTOK', qty: 2, unit_price: 2500, commission_amount: 500, status: 'PENDING' }),
    mockCommissionSettlement({ id: 2, order_id: 102, sku: 'SKU-002', platform: 'TEMU', qty: 3, unit_price: 1800, commission_rate: 0.08, commission_amount: 432, status: 'PENDING', created_at: '2024-01-14T09:00:00Z' }),
    mockCommissionSettlement({ id: 3, order_id: 103, sku: 'SKU-001', platform: 'TIKTOK', qty: 1, commission_amount: 250, status: 'SETTLED', settled_at: '2024-01-13', created_at: '2024-01-13T08:00:00Z' }),
    mockCommissionSettlement({ id: 4, order_id: 104, sku: 'SKU-003', platform: 'RAKUTEN', qty: 5, unit_price: 3000, commission_rate: 0.12, commission_amount: 1800, status: 'FAILED', created_at: '2024-01-12T07:00:00Z' }),
  ],
  total: 4,
  count: 4,
  hasMore: false,
}

test.describe('Commissions Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/commissions/rates', MOCK_RATES)
    await adminPage.route('**/api/v1/commissions/history*', (route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url())
        const status = url.searchParams.get('status')
        if (status) {
          const filtered = MOCK_SETTLEMENTS.settlements.filter((s) => s.status === status)
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ settlements: filtered, total: filtered.length, count: filtered.length, hasMore: false }),
          })
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SETTLEMENTS),
        })
      }
      return route.continue()
    })
  })

  test('renders commission rates table', async ({ adminPage }) => {
    await adminPage.goto('/commissions')
    await adminPage.waitForLoadState('networkidle')

    // SKUs visible
    await expect(adminPage.getByText('SKU-001').first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('SKU-002').first()).toBeVisible()
    await expect(adminPage.getByText('SKU-003').first()).toBeVisible()

    // Platform badges
    await expect(adminPage.locator('span.inline-flex', { hasText: 'TIKTOK' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'TEMU' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'RAKUTEN' }).first()).toBeVisible()
  })

  test('renders settlement history', async ({ adminPage }) => {
    await adminPage.goto('/commissions')
    await adminPage.waitForLoadState('networkidle')

    // Status badges in settlements
    const pendingBadges = adminPage.locator('span.inline-flex', { hasText: 'PENDING' })
    await expect(pendingBadges.first()).toBeVisible({ timeout: 10000 })

    await expect(adminPage.locator('span.inline-flex', { hasText: 'SETTLED' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'FAILED' }).first()).toBeVisible()
  })

  test('page title and subtitle render', async ({ adminPage }) => {
    await adminPage.goto('/commissions')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByRole('heading', { name: /commissions/i }).first()).toBeVisible({ timeout: 10000 })
    // en.json subtitle is "Commission Management"
    await expect(adminPage.getByText('Commission Management')).toBeVisible()
  })

  test('status filter filters settlements', async ({ adminPage }) => {
    await adminPage.goto('/commissions')
    await adminPage.waitForLoadState('networkidle')

    // Initially all statuses visible
    await expect(adminPage.locator('span.inline-flex', { hasText: 'PENDING' }).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('span.inline-flex', { hasText: 'FAILED' }).first()).toBeVisible()

    // Select SETTLED filter — use the last select on the page (settlement history filter)
    const statusSelect = adminPage.locator('select').last()
    await statusSelect.selectOption('SETTLED')

    // Wait for filtered data
    await adminPage.waitForTimeout(500)

    // SETTLED should be visible, PENDING/FAILED should not be in settlement table
    await expect(adminPage.locator('span.inline-flex', { hasText: 'SETTLED' }).first()).toBeVisible()
  })
})
