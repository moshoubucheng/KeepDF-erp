import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'
import { mockCustomer } from './helpers/mock-data'

const MOCK_CUSTOMERS = {
  customers: [
    mockCustomer({ id: 1, name: 'Tanaka Taro', email: 'tanaka@example.com', phone: '03-1234-5678', platform: 'TIKTOK', tags: 'VIP,wholesale' }),
    mockCustomer({ id: 2, name: 'Suzuki Hanako', email: 'suzuki@example.com', phone: '06-9876-5432', platform: 'TEMU', tags: 'retail', created_at: '2024-01-14T09:00:00Z' }),
    mockCustomer({ id: 3, name: 'Yamada Ichiro', email: 'yamada@example.com', phone: null, platform: null, tags: '', created_at: '2024-01-13T08:00:00Z' }),
  ],
  total: 3,
  count: 3,
}

test.describe('Customers Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/customers*', MOCK_CUSTOMERS)
  })

  test('renders customer list', async ({ adminPage }) => {
    await adminPage.goto('/customers')
    await adminPage.waitForLoadState('networkidle')

    // Customer names visible
    await expect(adminPage.getByText('Tanaka Taro')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('Suzuki Hanako')).toBeVisible()
    await expect(adminPage.getByText('Yamada Ichiro')).toBeVisible()

    // Emails visible
    await expect(adminPage.getByText('tanaka@example.com')).toBeVisible()
    await expect(adminPage.getByText('suzuki@example.com')).toBeVisible()

    // Platform badges
    await expect(adminPage.locator('span.inline-flex', { hasText: 'TIKTOK' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'TEMU' }).first()).toBeVisible()
  })

  test('tag badges render', async ({ adminPage }) => {
    await adminPage.goto('/customers')
    await adminPage.waitForLoadState('networkidle')

    // Customer 1 has tags "VIP,wholesale" → 2 badges
    await expect(adminPage.locator('span', { hasText: 'VIP' }).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('span', { hasText: 'wholesale' }).first()).toBeVisible()
  })

  test('Add Customer opens empty modal', async ({ adminPage }) => {
    await adminPage.goto('/customers')
    await adminPage.waitForLoadState('networkidle')

    // Click Add button
    await adminPage.getByRole('button', { name: /add/i }).click()

    // Modal should open
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Form fields
    await expect(dialog.getByText(/name/i).first()).toBeVisible()
    await expect(dialog.getByText(/email/i).first()).toBeVisible()
    await expect(dialog.getByText(/phone/i).first()).toBeVisible()

    // Address section
    await expect(dialog.getByText(/address/i).first()).toBeVisible()
  })

  test('Edit opens pre-filled modal', async ({ adminPage }) => {
    await adminPage.goto('/customers')
    await adminPage.waitForLoadState('networkidle')

    // Wait for data to load
    await expect(adminPage.getByText('Tanaka Taro')).toBeVisible({ timeout: 10000 })

    // Click Pencil icon (edit) on first customer row
    const firstRow = adminPage.locator('tr', { hasText: 'Tanaka Taro' })
    await firstRow.locator('button').first().click()

    // Modal should open with pre-filled data
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // The name input should contain the customer's name
    const nameInput = dialog.locator('input').first()
    await expect(nameInput).toHaveValue('Tanaka Taro')
  })

  test('Add form submits POST /customers', async ({ adminPage }) => {
    const createMock = await mockApiMutation(adminPage, '**/api/v1/customers', 'POST', {
      success: true,
      customer: mockCustomer({ id: 4, name: 'New Customer', email: 'new@example.com' }),
    })

    await adminPage.goto('/customers')
    await adminPage.waitForLoadState('networkidle')

    // Open add modal
    await adminPage.getByRole('button', { name: /add/i }).click()
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Fill Name (first input, has autoFocus) and Email
    const inputs = dialog.locator('input')
    await inputs.first().fill('New Customer')
    await inputs.nth(1).fill('new@example.com')

    // Click Save
    await dialog.getByRole('button', { name: /save/i }).click()

    await adminPage.waitForTimeout(500)
    const req = createMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
    expect(req!.body).toMatchObject({ name: 'New Customer', email: 'new@example.com' })
  })
})
