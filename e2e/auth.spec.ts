import { test, expect } from '@playwright/test'
import { test as authTest, expect as authExpect } from './fixtures/auth'

test.describe('Authentication', () => {
  test('shows login page with branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('KeepDF')
    await expect(page.locator('text=Keep Data Flow')).toBeVisible()
  })

  test('shows password login form by default', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible()
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible()
  })

  test('can switch to token login mode', async ({ page }) => {
    await page.goto('/login')
    // Click the token login link (text is Japanese: トークンでログイン)
    await page.getByRole('button', { name: /token|トークン/i }).click()
    await expect(page.locator('input[placeholder="tok_xxxxxxxx"]')).toBeVisible()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login')
    await expect(page).toHaveURL(/\/login/)
  })

  test('password toggle shows/hides password', async ({ page }) => {
    await page.goto('/login')
    const passwordInput = page.locator('input[autocomplete="current-password"]')
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Click the eye button to show password
    await page.getByRole('button', { name: /show password/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
  })
})

authTest.describe('Authenticated Session', () => {
  authTest('admin can access dashboard', async ({ adminPage }) => {
    await adminPage.goto('/dashboard')
    await adminPage.waitForLoadState('networkidle')
    // Should not redirect to login
    await authExpect(adminPage).not.toHaveURL(/\/login/)
  })
})
