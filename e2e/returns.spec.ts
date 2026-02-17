import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation, setupDialogHandler } from './helpers/api-mock'
import { mockReturn } from './helpers/mock-data'

const MOCK_RETURNS = {
  returns: [
    mockReturn({ id: 1, order_id: 101, status: 'REQUESTED', reason: 'Defective item', refund_amount: 5000 }),
    mockReturn({ id: 2, order_id: 102, status: 'APPROVED', reason: 'Wrong size', refund_amount: 3000 }),
    mockReturn({ id: 3, order_id: 103, status: 'RECEIVED', reason: 'Not as described', refund_amount: 8000 }),
    mockReturn({ id: 4, order_id: 104, status: 'REFUNDED', reason: 'Changed mind', refund_amount: 2000 }),
  ],
  total: 4,
}

test.describe('Returns Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/returns*', MOCK_RETURNS)
  })

  test('renders returns with status badges', async ({ adminPage }) => {
    await adminPage.goto('/returns')
    await adminPage.waitForLoadState('networkidle')

    // Verify all 4 statuses are displayed as badges
    await expect(adminPage.locator('span.inline-flex', { hasText: 'REQUESTED' }).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('span.inline-flex', { hasText: 'APPROVED' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'RECEIVED' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'REFUNDED' }).first()).toBeVisible()
  })

  test('Approve and Reject buttons only for REQUESTED', async ({ adminPage }) => {
    await adminPage.goto('/returns')
    await adminPage.waitForLoadState('networkidle')

    // REQUESTED row (#101) should have Approve + Reject buttons
    const requestedRow = adminPage.locator('tr', { hasText: '#101' })
    await expect(requestedRow.getByRole('button', { name: /approve/i })).toBeVisible({ timeout: 10000 })
    await expect(requestedRow.getByRole('button', { name: /reject/i })).toBeVisible()

    // APPROVED row (#102) should NOT have Approve/Reject
    const approvedRow = adminPage.locator('tr', { hasText: '#102' })
    await expect(approvedRow.getByRole('button', { name: /approve/i })).not.toBeVisible()
    await expect(approvedRow.getByRole('button', { name: /reject/i })).not.toBeVisible()

    // RECEIVED row (#103) should NOT have Approve/Reject
    const receivedRow = adminPage.locator('tr', { hasText: '#103' })
    await expect(receivedRow.getByRole('button', { name: /approve/i })).not.toBeVisible()
  })

  test('Approve triggers confirm dialog and calls PATCH', async ({ adminPage }) => {
    const dialog = setupDialogHandler(adminPage, true)
    const approveMock = await mockApiMutation(adminPage, '**/api/v1/returns/1/approve', 'PATCH')

    await adminPage.goto('/returns')
    await adminPage.waitForLoadState('networkidle')

    // Click Approve on REQUESTED row
    const requestedRow = adminPage.locator('tr', { hasText: '#101' })
    await requestedRow.getByRole('button', { name: /approve/i }).click()

    await adminPage.waitForTimeout(500)
    expect(dialog.wasTriggered()).toBe(true)
    expect(approveMock.getLastRequest()).not.toBeNull()
    expect(approveMock.getLastRequest()!.method).toBe('PATCH')

    dialog.cleanup()
  })

  test('Reject opens modal with reason input', async ({ adminPage }) => {
    await adminPage.goto('/returns')
    await adminPage.waitForLoadState('networkidle')

    // Click Reject on REQUESTED row
    const requestedRow = adminPage.locator('tr', { hasText: '#101' })
    await requestedRow.getByRole('button', { name: /reject/i }).click()

    // Modal should open
    await expect(adminPage.getByText('Reject Return')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('[role="dialog"]').getByText('Reason', { exact: true })).toBeVisible()

    // Confirm button should be disabled when empty
    const confirmBtn = adminPage.locator('[role="dialog"]').getByRole('button', { name: /reject/i }).last()
    await expect(confirmBtn).toBeDisabled()
  })

  test('Reject submits reason via PATCH', async ({ adminPage }) => {
    const rejectMock = await mockApiMutation(adminPage, '**/api/v1/returns/1/reject', 'PATCH')

    await adminPage.goto('/returns')
    await adminPage.waitForLoadState('networkidle')

    // Open reject modal
    const requestedRow = adminPage.locator('tr', { hasText: '#101' })
    await requestedRow.getByRole('button', { name: /reject/i }).click()
    await expect(adminPage.getByText('Reject Return')).toBeVisible({ timeout: 10000 })

    // Fill reason
    const reasonInput = adminPage.locator('[role="dialog"]').locator('input')
    await reasonInput.fill('Item not eligible')

    // Click confirm reject
    const confirmBtn = adminPage.locator('[role="dialog"]').getByRole('button', { name: /reject/i }).last()
    await confirmBtn.click()

    await adminPage.waitForTimeout(500)
    const req = rejectMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.body).toEqual({ reason: 'Item not eligible' })
  })

  test('Receive on APPROVED, Refund on RECEIVED', async ({ adminPage }) => {
    await adminPage.goto('/returns')
    await adminPage.waitForLoadState('networkidle')

    // APPROVED row (#102) should have Receive button
    const approvedRow = adminPage.locator('tr', { hasText: '#102' })
    await expect(approvedRow.getByRole('button', { name: /receive/i })).toBeVisible({ timeout: 10000 })

    // RECEIVED row (#103) should have Refund button
    const receivedRow = adminPage.locator('tr', { hasText: '#103' })
    await expect(receivedRow.getByRole('button', { name: /refund/i })).toBeVisible()

    // REFUNDED row (#104) should have no action buttons
    const refundedRow = adminPage.locator('tr', { hasText: '#104' })
    await expect(refundedRow.getByRole('button', { name: /receive/i })).not.toBeVisible()
    await expect(refundedRow.getByRole('button', { name: /refund/i })).not.toBeVisible()
  })
})
