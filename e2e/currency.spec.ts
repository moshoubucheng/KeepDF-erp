import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'
import { mockExchangeRate } from './helpers/mock-data'

const MOCK_RATES = {
  rates: [
    mockExchangeRate({ id: 1, from_currency: 'USD', to_currency: 'JPY', rate: 155.43 }),
    mockExchangeRate({ id: 2, from_currency: 'CNY', to_currency: 'JPY', rate: 21.5, created_at: '2024-01-14T09:00:00Z' }),
    mockExchangeRate({ id: 3, from_currency: 'EUR', to_currency: 'JPY', rate: 168.2, created_at: '2024-01-13T08:00:00Z' }),
  ],
}

test.describe('Currency Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/currency/rates*', MOCK_RATES)
    await mockApiGet(adminPage, '**/api/v1/currency/rates', MOCK_RATES)
  })

  test('renders exchange rates list', async ({ adminPage }) => {
    await adminPage.goto('/currency')
    await adminPage.waitForLoadState('networkidle')

    // Currency pairs visible (scope to table to avoid matching hidden <option> elements in converter)
    const table = adminPage.locator('table')
    await expect(table.getByText('USD').first()).toBeVisible({ timeout: 10000 })
    await expect(table.getByText('CNY').first()).toBeVisible()
    await expect(table.getByText('EUR').first()).toBeVisible()
    await expect(table.getByText('JPY').first()).toBeVisible()

    // Rates visible
    await expect(adminPage.getByText('155.43').first()).toBeVisible()
    await expect(adminPage.getByText('21.5').first()).toBeVisible()
  })

  test('page title and stat cards render', async ({ adminPage }) => {
    await adminPage.goto('/currency')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByRole('heading', { name: /currency/i }).first()).toBeVisible({ timeout: 10000 })

    // Rate count stat
    await expect(adminPage.getByText('Exchange Rates').first()).toBeVisible()
  })

  test('set new exchange rate', async ({ adminPage }) => {
    const updateMock = await mockApiMutation(adminPage, '**/api/v1/currency/rates*', 'POST', { success: true })

    await adminPage.goto('/currency')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.locator('table').getByText('USD').first()).toBeVisible({ timeout: 10000 })

    // Click Edit button on first rate
    const editBtns = adminPage.getByRole('button', { name: /edit/i })
    const editCount = await editBtns.count()
    if (editCount > 0) {
      await editBtns.first().click()

      const dialog = adminPage.locator('[role="dialog"]')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      // Fill new rate
      const rateInput = dialog.locator('input[type="number"]')
      await rateInput.first().clear()
      await rateInput.first().fill('156.50')

      // Submit
      await dialog.getByRole('button', { name: /update|save/i }).click()

      await adminPage.waitForTimeout(500)
    }
  })

  test('currency converter: input amount and get result', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/currency/convert*', (route) => {
      const url = new URL(route.request().url())
      const amount = Number(url.searchParams.get('amount') || '100')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          from: 'USD',
          to: 'JPY',
          amount,
          converted: Math.floor(amount * 155.43),
          rate: 155.43,
        }),
      })
    })

    await adminPage.goto('/currency')
    await adminPage.waitForLoadState('networkidle')

    // Find converter section
    const converterHeading = adminPage.getByText(/converter/i).first()
    await expect(converterHeading).toBeVisible({ timeout: 10000 })

    // Fill amount
    const amountInput = adminPage.locator('input[type="number"]').first()
    await amountInput.fill('100')

    // Select currencies if needed
    const selects = adminPage.locator('select')
    const selectCount = await selects.count()
    if (selectCount >= 2) {
      await selects.nth(0).selectOption('USD')
      await selects.nth(1).selectOption('JPY')
    }

    // Click Convert button
    const convertBtn = adminPage.getByRole('button', { name: /convert/i })
    await convertBtn.click()

    await adminPage.waitForTimeout(500)

    // Result should show converted amount (100 * 155.43 = 15543)
    await expect(adminPage.getByText(/15,543/).first()).toBeVisible({ timeout: 5000 })
  })

  test('JPY amounts display without decimal places', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/currency/convert*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          from: 'USD',
          to: 'JPY',
          amount: 50,
          converted: 7771,
          rate: 155.43,
        }),
      })
    })

    await adminPage.goto('/currency')
    await adminPage.waitForLoadState('networkidle')

    const amountInput = adminPage.locator('input[type="number"]').first()
    await amountInput.fill('50')

    const convertBtn = adminPage.getByRole('button', { name: /convert/i })
    await convertBtn.click()

    await adminPage.waitForTimeout(500)

    // Should show 7,771 without decimal
    await expect(adminPage.getByText(/7,771/).first()).toBeVisible({ timeout: 5000 })
    // Should NOT show decimal places for JPY
    const resultText = await adminPage.locator('text=/7,771/').first().textContent()
    if (resultText) {
      expect(resultText).not.toMatch(/7,771\.\d+/)
    }
  })
})
