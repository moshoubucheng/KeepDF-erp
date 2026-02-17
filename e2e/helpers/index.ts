import type { Page } from '@playwright/test'

/** Wait for the main app shell to finish loading (sidebar visible). */
export async function waitForAppReady(page: Page) {
  await page.waitForSelector('[data-testid="sidebar"], nav', { timeout: 10000 })
}

/** Navigate via the sidebar link. */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

/** Get text content of an element, trimmed. */
export async function getText(page: Page, selector: string) {
  const el = page.locator(selector).first()
  return (await el.textContent())?.trim() ?? ''
}
