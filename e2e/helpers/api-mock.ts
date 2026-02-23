import type { Page, Dialog } from '@playwright/test'

/**
 * Mock a GET API endpoint to return a JSON response.
 */
export async function mockApiGet(page: Page, urlPattern: string, body: unknown) {
  await page.route(urlPattern, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    }
    return route.fallback()
  })
}

/**
 * Mock an API mutation (POST/PUT/PATCH/DELETE) and capture the request.
 * Returns an object with getLastRequest() to inspect the captured request.
 */
export async function mockApiMutation(
  page: Page,
  urlPattern: string,
  method: string,
  responseBody?: unknown,
) {
  let lastRequest: { method: string; url: string; body: unknown } | null = null

  await page.route(urlPattern, (route) => {
    const reqMethod = route.request().method()
    if (reqMethod === method) {
      let body: unknown = null
      try {
        body = route.request().postDataJSON()
      } catch {
        body = route.request().postData()
      }
      lastRequest = {
        method: reqMethod,
        url: route.request().url(),
        body,
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseBody ?? { success: true }),
      })
    }
    return route.fallback()
  })

  return {
    getLastRequest: () => lastRequest,
  }
}

/**
 * Set up a dialog handler for window.confirm() / window.alert().
 * Returns a cleanup function and a flag to check if dialog was triggered.
 */
export function setupDialogHandler(page: Page, accept: boolean) {
  let dialogTriggered = false

  const handler = (dialog: Dialog) => {
    dialogTriggered = true
    if (accept) {
      dialog.accept()
    } else {
      dialog.dismiss()
    }
  }

  page.on('dialog', handler)

  return {
    wasTriggered: () => dialogTriggered,
    cleanup: () => page.off('dialog', handler),
  }
}
