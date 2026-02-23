import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'
import { mockWalletTransaction } from './helpers/mock-data'

const MOCK_BALANCE = { distributorId: 1, balance: 150000, frozen_balance: 30000 }

const MOCK_TRANSACTIONS = {
  distributorId: 1,
  transactions: [
    mockWalletTransaction({ id: 1, type: 'DEPOSIT', amount: 50000, balance_snapshot: 150000 }),
    mockWalletTransaction({ id: 2, type: 'FREEZE', amount: 10000, related_order_id: '101', balance_snapshot: 140000, created_at: '2024-01-14T09:00:00Z' }),
    mockWalletTransaction({ id: 3, type: 'DEDUCT', amount: 5000, related_order_id: '102', balance_snapshot: 135000, created_at: '2024-01-13T08:00:00Z' }),
    mockWalletTransaction({ id: 4, type: 'REFUND', amount: 3000, related_order_id: '103', balance_snapshot: 138000, created_at: '2024-01-12T07:00:00Z' }),
  ],
}

async function setupWalletMocks(page: import('@playwright/test').Page, userId: number = 1) {
  await mockApiGet(page, `**/api/v1/wallet/balance/${userId}`, MOCK_BALANCE)
  await mockApiGet(page, `**/api/v1/wallet/transactions/${userId}`, MOCK_TRANSACTIONS)
}

test.describe('Wallet Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await setupWalletMocks(adminPage, 1)
  })

  test('three StatCards with formatted balances', async ({ adminPage }) => {
    await adminPage.goto('/wallet')
    await adminPage.waitForLoadState('networkidle')

    // Available Balance
    await expect(adminPage.getByText('Available Balance')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText(/150,000/).first()).toBeVisible()

    // Frozen
    await expect(adminPage.getByText('Frozen')).toBeVisible()
    await expect(adminPage.getByText(/30,000/).first()).toBeVisible()

    // Total Assets (150000 + 30000 = 180000)
    await expect(adminPage.getByText('Total Assets')).toBeVisible()
    await expect(adminPage.getByText(/180,000/).first()).toBeVisible()
  })

  test('transaction history table renders', async ({ adminPage }) => {
    await adminPage.goto('/wallet')
    await adminPage.waitForLoadState('networkidle')

    // 4 transaction type badges
    await expect(adminPage.locator('span.inline-flex', { hasText: 'Deposit' }).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('span.inline-flex', { hasText: 'Freeze' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'Deduct' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'Refund' }).first()).toBeVisible()
  })

  test('admin sees Deposit button, distributor does not', async ({ adminPage, distributorPage }) => {
    // Admin should see Deposit button
    await adminPage.goto('/wallet')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByRole('button', { name: /deposit/i })).toBeVisible({ timeout: 10000 })

    // Distributor should NOT see Deposit button
    await setupWalletMocks(distributorPage, 2)
    await distributorPage.goto('/wallet')
    await distributorPage.waitForLoadState('networkidle')

    // Wait for page to load
    await expect(distributorPage.getByRole('heading', { name: 'Wallet' }).first()).toBeVisible({ timeout: 10000 })
    await expect(distributorPage.getByRole('button', { name: /deposit/i })).not.toBeVisible()
  })

  test('Deposit modal opens with amount field', async ({ adminPage }) => {
    await adminPage.goto('/wallet')
    await adminPage.waitForLoadState('networkidle')

    // Click Deposit button
    await adminPage.getByRole('button', { name: /deposit/i }).click()

    // Modal should open
    await expect(adminPage.getByText('Deposit Funds')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('Amount (JPY)')).toBeVisible()
  })

  test('Deposit submit calls POST /wallet/deposit', async ({ adminPage }) => {
    const depositMock = await mockApiMutation(adminPage, '**/api/v1/wallet/deposit', 'POST')

    await adminPage.goto('/wallet')
    await adminPage.waitForLoadState('networkidle')

    // Open deposit modal
    await adminPage.getByRole('button', { name: /deposit/i }).click()
    await expect(adminPage.getByText('Deposit Funds')).toBeVisible({ timeout: 10000 })

    // Fill amount
    const dialog = adminPage.locator('[role="dialog"]')
    await dialog.locator('input[type="number"]').fill('10000')

    // Submit
    await dialog.getByRole('button', { name: /confirm deposit/i }).click()

    await adminPage.waitForTimeout(500)
    const req = depositMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
    expect(req!.body).toMatchObject({ distributor_id: 1, amount: 10000 })
  })
})
