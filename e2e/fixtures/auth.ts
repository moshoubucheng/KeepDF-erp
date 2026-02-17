import { test as base, type Page } from '@playwright/test'

const ADMIN_USER = {
  id: 1,
  username: 'admin',
  role: 'admin',
  name: 'E2E Admin',
  onboarding_completed: 1,
}

const DISTRIBUTOR_USER = {
  id: 2,
  username: 'dist1',
  role: 'distributor',
  name: 'E2E Distributor',
  onboarding_completed: 1,
}

/**
 * Injects auth token into localStorage and mocks /api/v1/auth/me
 * so the app treats the session as authenticated without a real backend.
 */
async function setupAuth(page: Page, role: 'admin' | 'distributor') {
  const user = role === 'admin' ? ADMIN_USER : DISTRIBUTOR_USER
  const token = `e2e-${role}-token`

  // Mock /api/v1/auth/me to return the test user
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ distributor: user }),
    }),
  )

  // Inject token into localStorage before page loads
  await page.addInitScript(
    ({ token }) => {
      window.localStorage.setItem('erp_token', token)
    },
    { token },
  )
}

type AuthFixtures = {
  adminPage: Page
  distributorPage: Page
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ page }, use) => {
    await setupAuth(page, 'admin')
    await use(page)
  },
  distributorPage: async ({ page }, use) => {
    await setupAuth(page, 'distributor')
    await use(page)
  },
})

export { expect } from '@playwright/test'
