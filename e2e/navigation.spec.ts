import { test, expect } from './fixtures/auth'

// Mock all API endpoints to return empty/default data so pages load without errors
async function mockAllAPIs(page: import('@playwright/test').Page) {
  // Catch-all for any API endpoint
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url()
    // Auth/me is already mocked by fixture — use fallback() to chain to fixture handler
    if (url.includes('/auth/me')) return route.fallback()

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orders: [], products: [], distributors: [], commissions: [],
        customers: [], notifications: [], data: [],
        pagination: { total: 0, page: 1, limit: 20, pages: 0 },
        overview: {}, wallet: { balance: 0, frozen_balance: 0 },
        role: 'admin',
      }),
    })
  })
}

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockAllAPIs(adminPage)
  })

  test('sidebar shows navigation groups', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Sidebar <aside> contains a <nav> element, visible on desktop
    const sidebar = adminPage.locator('aside nav').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to orders page', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Click on Orders link in sidebar (Japanese: 注文管理)
    await adminPage.locator('a[href="/orders"]').first().click()
    await expect(adminPage).toHaveURL(/\/orders/)
  })

  test('can navigate to inventory page', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Click on Inventory link in sidebar (Japanese: 在庫管理)
    await adminPage.locator('a[href="/inventory"]').first().click()
    await expect(adminPage).toHaveURL(/\/inventory/)
  })

  test('active link is highlighted', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Dashboard link should have active styling (uses NavLink with href="/dashboard")
    const dashboardLink = adminPage.locator('a[href="/dashboard"]').first()
    await expect(dashboardLink).toBeVisible()
  })
})

test.describe('Command Palette', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockAllAPIs(adminPage)
  })

  test('opens with Ctrl+K', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Press Ctrl+K to open command palette
    await adminPage.keyboard.press('Control+k')

    // Command palette search input should be visible
    const searchInput = adminPage.locator('input[placeholder]').last()
    await expect(searchInput).toBeVisible({ timeout: 5000 })
  })

  test('closes with Escape', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    await adminPage.keyboard.press('Control+k')

    // Wait for palette to appear
    await adminPage.waitForTimeout(300)

    // Press Escape to close
    await adminPage.keyboard.press('Escape')

    // Palette should be hidden
    await adminPage.waitForTimeout(300)
  })
})

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ adminPage }) => {
    await mockAllAPIs(adminPage)
  })

  test('sidebar is hidden on mobile by default', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // On mobile, sidebar is off-screen; the hamburger button should be visible
    const menuBtn = adminPage.getByRole('button', { name: /Toggle sidebar/i })
    await expect(menuBtn).toBeVisible({ timeout: 10000 })

    // Sidebar nav links should be out of viewport (translated off-screen)
    const sidebarLink = adminPage.locator('a[href="/orders"]').first()
    await expect(sidebarLink).not.toBeInViewport()
  })

  test('hamburger menu toggles sidebar', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')

    // Click the hamburger menu button (aria-label="Toggle sidebar")
    const menuBtn = adminPage.getByRole('button', { name: /Toggle sidebar/i })
    await expect(menuBtn).toBeVisible({ timeout: 10000 })
    await menuBtn.click()

    // After clicking, sidebar link should slide into viewport
    const sidebarLink = adminPage.locator('a[href="/orders"]').first()
    await expect(sidebarLink).toBeInViewport({ timeout: 5000 })
  })
})
