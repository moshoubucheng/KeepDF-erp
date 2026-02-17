import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'

const MOCK_CONFIG = { config: { low_stock_threshold: '10', default_carrier: 'YAMATO' } }
const MOCK_SYSTEM_INFO = { counts: { orders: 150, products: 45, distributors: 5 } }
const MOCK_USERS = {
  distributors: [
    { id: 1, name: 'Admin', username: 'admin', role: 'admin', totp_enabled: 0, created_at: '2024-01-01' },
    { id: 2, name: 'Dist1', username: 'dist1', role: 'distributor', totp_enabled: 1, created_at: '2024-01-02' },
  ],
}

async function setupSettingsMocks(page: import('@playwright/test').Page) {
  await mockApiGet(page, '**/api/v1/settings/config', MOCK_CONFIG)
  await mockApiGet(page, '**/api/v1/settings/system-info', MOCK_SYSTEM_INFO)
  await mockApiGet(page, '**/api/v1/distributors*', MOCK_USERS)
}

test.describe('Settings Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await setupSettingsMocks(adminPage)
  })

  test('Profile tab default with company form', async ({ adminPage }) => {
    await adminPage.goto('/settings')
    await adminPage.waitForLoadState('networkidle')

    // Profile tab should be active by default
    await expect(adminPage.getByText('Company Profile')).toBeVisible({ timeout: 10000 })

    // Form fields visible
    await expect(adminPage.getByText('Company Name')).toBeVisible()
    await expect(adminPage.getByText('Contact Person')).toBeVisible()
    await expect(adminPage.getByText('Email')).toBeVisible()
    await expect(adminPage.getByText('Phone')).toBeVisible()
    await expect(adminPage.getByText('Address')).toBeVisible()
    await expect(adminPage.getByText('Tax Registration Number')).toBeVisible()

    // Save button
    await expect(adminPage.getByRole('button', { name: /save/i })).toBeVisible()
  })

  test('Security tab shows password form', async ({ adminPage }) => {
    await adminPage.goto('/settings')
    await adminPage.waitForLoadState('networkidle')

    // Click Security tab
    await adminPage.getByRole('button', { name: /security/i }).first().click()

    // Password form fields
    await expect(adminPage.getByText('Current Password')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('New Password', { exact: true })).toBeVisible()
    await expect(adminPage.getByText('Confirm New Password')).toBeVisible()
    await expect(adminPage.getByRole('button', { name: /update password/i })).toBeVisible()
  })

  test('Security tab shows 2FA inactive', async ({ adminPage }) => {
    await adminPage.goto('/settings')
    await adminPage.waitForLoadState('networkidle')

    // Click Security tab
    await adminPage.getByRole('button', { name: /security/i }).first().click()

    // 2FA inactive banner (amber)
    await expect(adminPage.getByText('2FA is not enabled')).toBeVisible({ timeout: 10000 })

    // Enable 2FA button
    await expect(adminPage.getByRole('button', { name: /enable 2fa/i })).toBeVisible()
  })

  test('Enable 2FA shows secret and code input', async ({ adminPage }) => {
    // Mock the 2FA setup endpoint
    await mockApiMutation(adminPage, '**/api/v1/auth/totp/setup', 'POST', {
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/KeepDF:admin?secret=JBSWY3DPEHPK3PXP&issuer=KeepDF',
    })

    await adminPage.goto('/settings')
    await adminPage.waitForLoadState('networkidle')

    // Go to Security tab
    await adminPage.getByRole('button', { name: /security/i }).first().click()
    await expect(adminPage.getByText('2FA is not enabled')).toBeVisible({ timeout: 10000 })

    // Click Enable 2FA
    await adminPage.getByRole('button', { name: /enable 2fa/i }).click()

    // Secret key should be displayed (first match — skip otpauth URI)
    await expect(adminPage.getByText('JBSWY3DPEHPK3PXP').first()).toBeVisible({ timeout: 10000 })

    // Verification Code input should be visible
    await expect(adminPage.getByText('Verification Code')).toBeVisible()
  })

  test('System tab visible for admin only', async ({ adminPage, distributorPage }) => {
    // Admin should see 3 tabs
    await adminPage.goto('/settings')
    await adminPage.waitForLoadState('networkidle')

    // Scope to main content area to avoid sidebar nav buttons
    const adminMain = adminPage.getByRole('main')
    await expect(adminMain.getByRole('button', { name: /profile/i })).toBeVisible({ timeout: 10000 })
    await expect(adminMain.getByRole('button', { name: /security/i })).toBeVisible()
    await expect(adminMain.getByRole('button', { name: /system/i })).toBeVisible()

    // Distributor should see only 2 tabs
    await setupSettingsMocks(distributorPage)
    await distributorPage.goto('/settings')
    await distributorPage.waitForLoadState('networkidle')

    const distMain = distributorPage.getByRole('main')
    await expect(distMain.getByRole('button', { name: /profile/i })).toBeVisible({ timeout: 10000 })
    await expect(distMain.getByRole('button', { name: /security/i })).toBeVisible()
    await expect(distMain.getByRole('button', { name: /system/i })).not.toBeVisible()
  })

  test('Profile form submits PUT /auth/profile', async ({ adminPage }) => {
    const profileMock = await mockApiMutation(adminPage, '**/api/v1/auth/profile', 'PUT')

    await adminPage.goto('/settings')
    await adminPage.waitForLoadState('networkidle')

    // Company Profile form should be visible
    await expect(adminPage.getByText('Company Profile')).toBeVisible({ timeout: 10000 })

    // Fill in the Company Name field (first input in the form)
    const nameInput = adminPage.locator('input').first()
    await nameInput.clear()
    await nameInput.fill('New Company')

    // Click Save
    await adminPage.getByRole('button', { name: /save/i }).click()

    await adminPage.waitForTimeout(500)
    const req = profileMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('PUT')
    expect(req!.body).toMatchObject({ name: 'New Company' })
  })
})
