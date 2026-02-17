import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation, setupDialogHandler } from './helpers/api-mock'
import { mockOrder } from './helpers/mock-data'

const MOCK_ORDERS = {
  orders: [
    mockOrder({ id: 1, platform: 'TIKTOK', platform_order_id: 'TT-001', status: 'PROCESSING' }),
    mockOrder({ id: 2, platform: 'TEMU', platform_order_id: 'TM-002', status: 'SHIPPED' }),
    mockOrder({ id: 3, platform: 'RAKUTEN', platform_order_id: 'RK-003', status: 'PENDING' }),
  ],
  count: 3,
}

test.describe('Order Actions', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/orders*', MOCK_ORDERS)
  })

  test('Ship button only for PROCESSING orders', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // PROCESSING row (TT-001) should have Ship button
    const processingRow = adminPage.locator('tr', { hasText: 'TT-001' })
    await expect(processingRow.getByRole('button', { name: /ship/i })).toBeVisible({ timeout: 10000 })

    // SHIPPED row (TM-002) should NOT have Ship button
    const shippedRow = adminPage.locator('tr', { hasText: 'TM-002' })
    await expect(shippedRow.getByRole('button', { name: /ship/i })).not.toBeVisible()

    // PENDING row (RK-003) should NOT have Ship button
    const pendingRow = adminPage.locator('tr', { hasText: 'RK-003' })
    await expect(pendingRow.getByRole('button', { name: /ship/i })).not.toBeVisible()
  })

  test('Ship modal opens with tracking input', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Click Ship button on PROCESSING row
    const processingRow = adminPage.locator('tr', { hasText: 'TT-001' })
    await processingRow.getByRole('button', { name: /ship/i }).click()

    // Modal should open with title "Ship Order"
    await expect(adminPage.getByText('Ship Order')).toBeVisible({ timeout: 10000 })

    // Tracking Number input should be visible
    await expect(adminPage.locator('[role="dialog"]').getByText('Tracking Number', { exact: true })).toBeVisible()

    // Confirm button should be disabled when input is empty
    const confirmBtn = adminPage.locator('[role="dialog"]').getByRole('button', { name: /ship/i }).last()
    await expect(confirmBtn).toBeDisabled()
  })

  test('Ship submit calls PATCH /orders/1/ship', async ({ adminPage }) => {
    const shipMock = await mockApiMutation(adminPage, '**/api/v1/orders/1/ship', 'PATCH')

    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Open ship modal
    const processingRow = adminPage.locator('tr', { hasText: 'TT-001' })
    await processingRow.getByRole('button', { name: /ship/i }).click()
    await expect(adminPage.getByText('Ship Order')).toBeVisible({ timeout: 10000 })

    // Fill tracking number
    const trackingInput = adminPage.locator('[role="dialog"]').locator('input')
    await trackingInput.fill('TRK-12345')

    // Click confirm Ship button in modal
    const confirmBtn = adminPage.locator('[role="dialog"]').getByRole('button', { name: /ship/i }).last()
    await confirmBtn.click()

    // Verify PATCH was called with correct body
    await adminPage.waitForTimeout(500)
    const req = shipMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('PATCH')
    expect(req!.body).toEqual({ tracking_number: 'TRK-12345' })
  })

  test('Deliver triggers confirm dialog and calls PATCH', async ({ adminPage }) => {
    const dialog = setupDialogHandler(adminPage, true)
    const deliverMock = await mockApiMutation(adminPage, '**/api/v1/orders/2/deliver', 'PATCH')

    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Click Deliver button on SHIPPED row
    const shippedRow = adminPage.locator('tr', { hasText: 'TM-002' })
    await shippedRow.getByRole('button', { name: /deliver/i }).click()

    // Verify dialog was triggered and PATCH was called
    await adminPage.waitForTimeout(500)
    expect(dialog.wasTriggered()).toBe(true)
    expect(deliverMock.getLastRequest()).not.toBeNull()
    expect(deliverMock.getLastRequest()!.method).toBe('PATCH')

    dialog.cleanup()
  })

  test('Cancel button visible for PENDING and PROCESSING', async ({ adminPage }) => {
    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // PROCESSING row should have Cancel button
    const processingRow = adminPage.locator('tr', { hasText: 'TT-001' })
    await expect(processingRow.getByRole('button', { name: /cancel/i })).toBeVisible({ timeout: 10000 })

    // PENDING row should have Cancel button
    const pendingRow = adminPage.locator('tr', { hasText: 'RK-003' })
    await expect(pendingRow.getByRole('button', { name: /cancel/i })).toBeVisible()

    // SHIPPED row should NOT have Cancel button
    const shippedRow = adminPage.locator('tr', { hasText: 'TM-002' })
    await expect(shippedRow.getByRole('button', { name: /cancel/i })).not.toBeVisible()
  })

  test('Cancel declined does not call API', async ({ adminPage }) => {
    const dialog = setupDialogHandler(adminPage, false)
    const cancelMock = await mockApiMutation(adminPage, '**/api/v1/orders/3/cancel', 'PATCH')

    await adminPage.goto('/orders')
    await adminPage.waitForLoadState('networkidle')

    // Click Cancel on PENDING row
    const pendingRow = adminPage.locator('tr', { hasText: 'RK-003' })
    await pendingRow.getByRole('button', { name: /cancel/i }).click()

    // Dialog dismissed, no API call
    await adminPage.waitForTimeout(500)
    expect(dialog.wasTriggered()).toBe(true)
    expect(cancelMock.getLastRequest()).toBeNull()

    dialog.cleanup()
  })
})
