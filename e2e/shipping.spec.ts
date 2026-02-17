import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'
import { mockShipment, mockShipmentEvent } from './helpers/mock-data'

const MOCK_SHIPMENTS = {
  shipments: [
    mockShipment({ id: 1, order_id: 101, tracking_number: 'TRK-001', carrier: 'YAMATO', status: 'SHIPPED' }),
    mockShipment({ id: 2, order_id: 102, tracking_number: 'TRK-002', carrier: 'SAGAWA', status: 'IN_TRANSIT', shipped_at: '2024-01-14T09:00:00Z', estimated_delivery: '2024-01-19' }),
    mockShipment({ id: 3, order_id: 103, tracking_number: 'TRK-003', carrier: 'JAPAN_POST', status: 'DELIVERED', shipped_at: '2024-01-13T08:00:00Z', estimated_delivery: '2024-01-18' }),
  ],
  total: 3,
  count: 3,
}

const MOCK_TIMELINE_EVENTS = {
  events: [
    mockShipmentEvent({ id: 1, shipment_id: 1, status: 'SHIPPED', location: 'Tokyo', description: 'Package shipped from warehouse', event_time: '2024-01-15T10:00:00Z' }),
    mockShipmentEvent({ id: 2, shipment_id: 1, status: 'IN_TRANSIT', location: 'Osaka', description: 'In transit', event_time: '2024-01-16T14:00:00Z' }),
    mockShipmentEvent({ id: 3, shipment_id: 1, status: 'DELIVERED', location: 'Kyoto', description: 'Delivered to recipient', event_time: '2024-01-17T11:00:00Z' }),
  ],
}

test.describe('Shipping Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/shipping/1/events', MOCK_TIMELINE_EVENTS)
    await adminPage.route('**/api/v1/shipping*', (route) => {
      const url = route.request().url()
      // Don't intercept the timeline events route
      if (url.includes('/events')) return route.continue()
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SHIPMENTS),
        })
      }
      return route.continue()
    })
  })

  test('renders shipment list with tracking numbers', async ({ adminPage }) => {
    await adminPage.goto('/shipping')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('TRK-001')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('TRK-002')).toBeVisible()
    await expect(adminPage.getByText('TRK-003')).toBeVisible()
    await expect(adminPage.getByText('YAMATO').first()).toBeVisible()
    await expect(adminPage.getByText('SAGAWA').first()).toBeVisible()
  })

  test('Create Shipment modal opens', async ({ adminPage }) => {
    await adminPage.goto('/shipping')
    await adminPage.waitForLoadState('networkidle')

    // Click Create Shipment button (en.json: "New Shipment")
    await adminPage.getByRole('button', { name: /new shipment|create shipment/i }).click()

    // Modal should appear with form fields (modal title uses t() default: "Create Shipment")
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog.getByText('Create Shipment')).toBeVisible({ timeout: 10000 })
    await expect(dialog.getByText('Order ID', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Tracking Number', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Carrier', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Estimated Delivery', { exact: true })).toBeVisible()
  })

  test('Create submit calls POST /shipping', async ({ adminPage }) => {
    const createMock = await mockApiMutation(adminPage, '**/api/v1/shipping', 'POST', { success: true, shipment: MOCK_SHIPMENTS.shipments[0] })

    await adminPage.goto('/shipping')
    await adminPage.waitForLoadState('networkidle')

    // Open create modal
    await adminPage.getByRole('button', { name: /new shipment|create shipment/i }).click()
    await expect(adminPage.getByText('Create Shipment')).toBeVisible({ timeout: 10000 })

    // Fill form
    const dialog = adminPage.locator('[role="dialog"]')
    await dialog.locator('input[type="number"]').fill('1')
    await dialog.locator('input').nth(1).fill('TRK-TEST')
    await dialog.locator('select').selectOption('YAMATO')

    // Submit — button text is "New Shipment" (same i18n key as header)
    await dialog.getByRole('button', { name: /new shipment/i }).click()

    await adminPage.waitForTimeout(500)
    const req = createMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
    expect(req!.body).toMatchObject({
      order_id: 1,
      tracking_number: 'TRK-TEST',
      carrier: 'YAMATO',
    })
  })

  test('Row click opens timeline modal', async ({ adminPage }) => {
    await adminPage.goto('/shipping')
    await adminPage.waitForLoadState('networkidle')

    // Click the first shipment row
    await adminPage.getByText('TRK-001').click()

    // Timeline modal should appear with tracking number
    await expect(adminPage.getByText(/TRK-001/).last()).toBeVisible({ timeout: 10000 })
    // Carrier and status should be shown
    await expect(adminPage.locator('[role="dialog"]').getByText('YAMATO')).toBeVisible()
  })

  test('Timeline shows events chronologically', async ({ adminPage }) => {
    await adminPage.goto('/shipping')
    await adminPage.waitForLoadState('networkidle')

    // Open timeline modal
    await adminPage.getByText('TRK-001').click()
    await expect(adminPage.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 })

    // Wait for events to load
    const timeline = adminPage.locator('.border-l-2')
    await expect(timeline).toBeVisible({ timeout: 10000 })

    // Verify events with locations
    await expect(adminPage.locator('[role="dialog"]').getByText('Tokyo')).toBeVisible()
    await expect(adminPage.locator('[role="dialog"]').getByText('Osaka')).toBeVisible()
    await expect(adminPage.locator('[role="dialog"]').getByText('Kyoto')).toBeVisible()
  })

  test('Search filters by tracking number', async ({ adminPage }) => {
    await adminPage.goto('/shipping')
    await adminPage.waitForLoadState('networkidle')

    // Verify all rows visible initially
    await expect(adminPage.getByText('TRK-001')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('TRK-002')).toBeVisible()

    // Type in search input
    const searchInput = adminPage.locator('input[placeholder*="tracking"]')
    await searchInput.fill('TRK-001')

    // Only TRK-001 should be visible (client-side filter)
    await expect(adminPage.getByText('TRK-001')).toBeVisible()
    await expect(adminPage.getByText('TRK-002')).not.toBeVisible()
    await expect(adminPage.getByText('TRK-003')).not.toBeVisible()
  })
})
