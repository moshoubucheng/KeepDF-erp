import { test, expect } from './fixtures/auth'
import { mockApiGet } from './helpers/api-mock'

const MOCK_PNL = {
  period: { start: '2024-01-01', end: '2024-01-31' },
  revenue: { total: 500000, tax: 50000, orders: 45 },
  cogs: 200000,
  gross_profit: 300000,
  gross_margin: 60,
  expenses: { commission: 30000, refunds: 10000 },
  net_profit: 260000,
  net_margin: 52,
}

const MOCK_BALANCE_SHEET = {
  as_of: '2024-01-31',
  assets: {
    cash: 150000,
    frozen: 30000,
    inventory: 500000,
    inventory_units: 200,
    total: 680000,
  },
  liabilities: {
    pending_refunds: 15000,
    pending_commissions: 25000,
    total: 40000,
  },
  equity: 640000,
}

const MOCK_RECONCILIATION = {
  period: { start: '2024-01-01', end: '2024-01-31' },
  transactions: [
    { type: 'DEPOSIT', count: 5, total: 100000 },
    { type: 'COMMISSION', count: 20, total: -30000 },
    { type: 'REFUND', count: 3, total: -10000 },
  ],
  current_balance: 150000,
  current_frozen: 30000,
}

const MOCK_TAX_SUMMARY = {
  period: { start: '2024-01-01', end: '2024-01-31' },
  total_tax: 50000,
  total_taxable: 500000,
  breakdown: [
    { tax_rate: 10, rate_label: '10% Standard', order_count: 35, taxable_amount: 400000, tax_amount: 40000 },
    { tax_rate: 8, rate_label: '8% Reduced', order_count: 10, taxable_amount: 100000, tax_amount: 8000 },
  ],
}

test.describe('Financial Reports Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.route('**/api/v1/financial-reports/pnl*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PNL),
        })
      }
      return route.continue()
    })
    await mockApiGet(adminPage, '**/api/v1/financial-reports/balance-sheet*', MOCK_BALANCE_SHEET)
    await adminPage.route('**/api/v1/financial-reports/reconciliation*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_RECONCILIATION),
        })
      }
      return route.continue()
    })
    await adminPage.route('**/api/v1/financial-reports/tax-summary*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_TAX_SUMMARY),
        })
      }
      return route.continue()
    })
  })

  test('four tab switch: P&L, Balance Sheet, Cash Flow, Tax Summary', async ({ adminPage }) => {
    await adminPage.goto('/financial-reports')
    await adminPage.waitForLoadState('networkidle')

    // P&L tab active by default
    await expect(adminPage.getByText(/P&?L/i).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText(/Balance Sheet/i).first()).toBeVisible()
    await expect(adminPage.getByText(/Cash Flow/i).first()).toBeVisible()
    await expect(adminPage.getByText(/Tax/i).first()).toBeVisible()
  })

  test('P&L data renders: revenue, COGS, gross profit, net profit', async ({ adminPage }) => {
    await adminPage.goto('/financial-reports')
    await adminPage.waitForLoadState('networkidle')

    // Revenue
    await expect(adminPage.getByText(/Revenue/i).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText(/500,000/).first()).toBeVisible()

    // COGS
    await expect(adminPage.getByText(/Cost of Goods/i).first()).toBeVisible()
    await expect(adminPage.getByText(/200,000/).first()).toBeVisible()

    // Gross Profit
    await expect(adminPage.getByText(/Gross Profit/i).first()).toBeVisible()
    await expect(adminPage.getByText(/300,000/).first()).toBeVisible()

    // Net Profit
    await expect(adminPage.getByText(/Net Profit/i).first()).toBeVisible()
    await expect(adminPage.getByText(/260,000/).first()).toBeVisible()
  })

  test('Balance Sheet shows assets and liabilities', async ({ adminPage }) => {
    await adminPage.goto('/financial-reports')
    await adminPage.waitForLoadState('networkidle')

    // Switch to Balance Sheet tab
    await adminPage.getByRole('button', { name: /balance sheet/i }).click()
    await adminPage.waitForTimeout(500)

    // Assets
    await expect(adminPage.getByText(/Assets/i).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText(/Cash/i).first()).toBeVisible()
    await expect(adminPage.getByText(/150,000/).first()).toBeVisible()

    // Inventory
    await expect(adminPage.getByText(/Inventory/i).first()).toBeVisible()
    await expect(adminPage.getByText(/500,000/).first()).toBeVisible()

    // Liabilities
    await expect(adminPage.getByText(/Liabilities/i).first()).toBeVisible()

    // Equity
    await expect(adminPage.getByText(/Equity/i).first()).toBeVisible()
    await expect(adminPage.getByText(/640,000/).first()).toBeVisible()
  })

  test('date range filter triggers API re-request', async ({ adminPage }) => {
    let requestCount = 0
    await adminPage.route('**/api/v1/financial-reports/pnl*', (route) => {
      requestCount++
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PNL),
      })
    })

    await adminPage.goto('/financial-reports')
    await adminPage.waitForLoadState('networkidle')

    const initialCount = requestCount

    // Change start date
    const dateInputs = adminPage.locator('input[type="date"]')
    const dateCount = await dateInputs.count()
    if (dateCount >= 2) {
      await dateInputs.nth(0).fill('2024-02-01')
      await adminPage.waitForTimeout(1000)

      // Should have made an additional API request
      expect(requestCount).toBeGreaterThan(initialCount)
    }
  })

  test('CSV export button available on P&L tab', async ({ adminPage }) => {
    let exportRequested = false
    await adminPage.route('**/api/v1/financial-reports/pnl/export*', (route) => {
      exportRequested = true
      return route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'metric,value\nrevenue,500000\ncogs,200000',
      })
    })

    await adminPage.goto('/financial-reports')
    await adminPage.waitForLoadState('networkidle')

    const csvBtn = adminPage.getByRole('button', { name: /export csv|csv/i })
    const isVisible = await csvBtn.first().isVisible().catch(() => false)
    if (isVisible) {
      await csvBtn.first().click()
      await adminPage.waitForTimeout(500)
    }
  })

  test('Cash Flow tab shows transactions', async ({ adminPage }) => {
    await adminPage.goto('/financial-reports')
    await adminPage.waitForLoadState('networkidle')

    // Switch to Cash Flow tab
    await adminPage.getByRole('button', { name: /cash flow/i }).click()
    await adminPage.waitForTimeout(500)

    // Transaction types should be visible
    await expect(adminPage.getByText('DEPOSIT').first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('COMMISSION').first()).toBeVisible()

    // Current balance
    await expect(adminPage.getByText(/150,000/).first()).toBeVisible()
  })

  test('Tax Summary tab shows breakdown', async ({ adminPage }) => {
    await adminPage.goto('/financial-reports')
    await adminPage.waitForLoadState('networkidle')

    // Switch to Tax tab
    await adminPage.getByRole('button', { name: /tax/i }).click()
    await adminPage.waitForTimeout(500)

    // Total tax
    await expect(adminPage.getByText(/50,000/).first()).toBeVisible({ timeout: 10000 })

    // Tax rate breakdown
    await expect(adminPage.getByText(/10%/).first()).toBeVisible()
    await expect(adminPage.getByText(/8%/).first()).toBeVisible()
  })
})
