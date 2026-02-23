import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation, setupDialogHandler } from './helpers/api-mock'
import { mockCoupon } from './helpers/mock-data'

const MOCK_COUPONS = {
  coupons: [
    mockCoupon({ id: 1, code: 'KDF-SUMMER10', name: 'Summer Sale', type: 'PERCENTAGE', value: 10, usage_count: 5, usage_limit: 100 }),
    mockCoupon({ id: 2, code: 'KDF-FLAT500', name: 'Flat 500 Off', type: 'FIXED_AMOUNT', value: 500, usage_count: 20, usage_limit: 50, platform: 'TIKTOK' }),
    mockCoupon({ id: 3, code: 'KDF-FREESHIP', name: 'Free Shipping', type: 'FREE_SHIPPING', value: 0, usage_count: 12, usage_limit: 0, is_active: 0 }),
  ],
  total: 3,
  count: 3,
}

test.describe('Coupons Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/coupons*', MOCK_COUPONS)
  })

  test('renders coupon list with code, type, and usage', async ({ adminPage }) => {
    await adminPage.goto('/coupons')
    await adminPage.waitForLoadState('networkidle')

    // Coupon codes visible
    await expect(adminPage.getByText('KDF-SUMMER10').first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('KDF-FLAT500').first()).toBeVisible()
    await expect(adminPage.getByText('KDF-FREESHIP').first()).toBeVisible()

    // Type badges
    await expect(adminPage.locator('span.inline-flex', { hasText: 'PERCENTAGE' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'FIXED_AMOUNT' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'FREE_SHIPPING' }).first()).toBeVisible()

    // Usage counts (rendered without spaces: usage_count/usage_limit)
    await expect(adminPage.getByText('5/100').first()).toBeVisible()
    await expect(adminPage.getByText('20/50').first()).toBeVisible()
  })

  test('page title renders', async ({ adminPage }) => {
    await adminPage.goto('/coupons')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByRole('heading', { name: /coupon/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('create PERCENTAGE coupon via modal', async ({ adminPage }) => {
    const createMock = await mockApiMutation(adminPage, '**/api/v1/coupons', 'POST', { success: true, coupon: mockCoupon({ id: 4 }) })

    await adminPage.goto('/coupons')
    await adminPage.waitForLoadState('networkidle')

    // Click Create button
    await adminPage.getByRole('button', { name: /create coupon/i }).click()

    // Modal should open
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Fill form
    await dialog.locator('input[name="name"], input[placeholder*="e.g."]').first().fill('New Coupon')
    await dialog.locator('select').first().selectOption('PERCENTAGE')
    await dialog.locator('input[type="number"]').first().fill('15')

    // Fill dates
    const dateInputs = dialog.locator('input[type="date"]')
    await dateInputs.nth(0).fill('2024-06-01')
    await dateInputs.nth(1).fill('2024-12-31')

    // Submit
    await dialog.getByRole('button', { name: /save|create/i }).click()

    await adminPage.waitForTimeout(500)
    const req = createMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
  })

  test('create FREE_SHIPPING coupon (value=0)', async ({ adminPage }) => {
    const createMock = await mockApiMutation(adminPage, '**/api/v1/coupons', 'POST', { success: true, coupon: mockCoupon({ id: 5, type: 'FREE_SHIPPING', value: 0 }) })

    await adminPage.goto('/coupons')
    await adminPage.waitForLoadState('networkidle')

    await adminPage.getByRole('button', { name: /create coupon/i }).click()

    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.locator('input[name="name"], input[placeholder*="e.g."]').first().fill('Free Ship')
    await dialog.locator('select').first().selectOption('FREE_SHIPPING')

    // Fill dates
    const dateInputs = dialog.locator('input[type="date"]')
    await dateInputs.nth(0).fill('2024-06-01')
    await dateInputs.nth(1).fill('2024-12-31')

    await dialog.getByRole('button', { name: /save|create/i }).click()

    await adminPage.waitForTimeout(500)
    const req = createMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
  })

  test('deactivate coupon', async ({ adminPage }) => {
    const deactivateMock = await mockApiMutation(adminPage, '**/api/v1/coupons/1', 'DELETE', { success: true })

    await adminPage.goto('/coupons')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('KDF-SUMMER10').first()).toBeVisible({ timeout: 10000 })

    // Find and click deactivate/delete button for first coupon row
    const { cleanup } = setupDialogHandler(adminPage, true)
    // Check if there's a deactivate or delete button
    const actionBtns = adminPage.locator('table tbody tr').first().getByRole('button')
    const btnCount = await actionBtns.count()
    if (btnCount > 1) {
      await actionBtns.last().click()
    }

    await adminPage.waitForTimeout(500)
    cleanup()
  })

  test('date validation error when dates missing', async ({ adminPage }) => {
    await adminPage.goto('/coupons')
    await adminPage.waitForLoadState('networkidle')

    await adminPage.getByRole('button', { name: /create coupon/i }).click()

    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Fill name but not dates
    await dialog.locator('input[name="name"], input[placeholder*="e.g."]').first().fill('No Dates')
    await dialog.locator('select').first().selectOption('PERCENTAGE')
    await dialog.locator('input[type="number"]').first().fill('10')

    // Submit without dates
    await dialog.getByRole('button', { name: /save|create/i }).click()

    await adminPage.waitForTimeout(500)

    // Should show validation toast about dates being required
    // The toast uses i18n key coupons.validDatesRequired → "Valid from and valid to dates are required"
    const toastVisible = await adminPage.getByText(/dates.*required|有効.*必須|必填/i).isVisible().catch(() => false)
    // If the form doesn't submit (prevented by validation), the modal should remain open
    const modalStillOpen = await dialog.isVisible()
    expect(toastVisible || modalStillOpen).toBeTruthy()
  })
})
