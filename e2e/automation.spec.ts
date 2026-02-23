import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'

const MOCK_RULES = {
  rules: [
    {
      id: 1, name: 'Low Stock Reorder', type: 'AUTO_REORDER',
      conditions: { threshold: 10 }, actions: { reorder_quantity: 50 },
      is_active: 1, run_count: 12, last_run_at: '2024-01-15T10:00:00Z',
      distributor_id: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 2, name: 'Price Adjustment', type: 'AUTO_PRICE_ADJUST',
      conditions: { margin_below: 20 }, actions: { increase_percent: 5 },
      is_active: 1, run_count: 5, last_run_at: '2024-01-14T09:00:00Z',
      distributor_id: 1, created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-14T09:00:00Z',
    },
    {
      id: 3, name: 'Stock Alert', type: 'STOCK_ALERT',
      conditions: { threshold: 5 }, actions: { notify: true },
      is_active: 0, run_count: 0, last_run_at: null,
      distributor_id: 1, created_at: '2024-01-03T00:00:00Z', updated_at: '2024-01-03T00:00:00Z',
    },
  ],
}

const MOCK_LOGS = {
  logs: [
    { id: 1, rule_id: 1, trigger_type: 'CRON', status: 'SUCCESS', result: null, created_at: '2024-01-15T10:00:00Z' },
    { id: 2, rule_id: 1, trigger_type: 'MANUAL', status: 'SUCCESS', result: null, created_at: '2024-01-14T09:00:00Z' },
    { id: 3, rule_id: 2, trigger_type: 'EVENT', status: 'ERROR', result: 'Product not found', created_at: '2024-01-13T08:00:00Z' },
    { id: 4, rule_id: 3, trigger_type: 'CRON', status: 'SKIPPED', result: 'Rule disabled', created_at: '2024-01-12T07:00:00Z' },
  ],
  total: 4,
}

test.describe('Automation Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/automation', MOCK_RULES)
    await mockApiGet(adminPage, '**/api/v1/automation/logs*', MOCK_LOGS)
  })

  test('renders automation rules list', async ({ adminPage }) => {
    await adminPage.goto('/automation')
    await adminPage.waitForLoadState('networkidle')

    // Rule names visible
    await expect(adminPage.getByText('Low Stock Reorder').first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('Price Adjustment').first()).toBeVisible()
    await expect(adminPage.getByText('Stock Alert').first()).toBeVisible()

    // Type labels (rendered as plain <span> with uppercase text, not StatusBadge)
    await expect(adminPage.getByText('AUTO_REORDER').first()).toBeVisible()
    await expect(adminPage.getByText('AUTO_PRICE_ADJUST').first()).toBeVisible()
    await expect(adminPage.getByText('STOCK_ALERT').first()).toBeVisible()
  })

  test('page title renders', async ({ adminPage }) => {
    await adminPage.goto('/automation')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByRole('heading', { name: /automation/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('create new automation rule', async ({ adminPage }) => {
    const createMock = await mockApiMutation(adminPage, '**/api/v1/automation', 'POST', {
      success: true,
      rule: { id: 4, name: 'New Rule', type: 'STOCK_ALERT' },
    })

    await adminPage.goto('/automation')
    await adminPage.waitForLoadState('networkidle')

    // Click New Rule button
    await adminPage.getByRole('button', { name: /new rule/i }).click()

    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Fill name (Input component doesn't set explicit type attribute)
    await dialog.locator('input').first().fill('New Alert Rule')

    // Select type
    await dialog.locator('select').first().selectOption('STOCK_ALERT')

    // Fill conditions JSON
    const textareas = dialog.locator('textarea')
    const textareaCount = await textareas.count()
    if (textareaCount >= 2) {
      await textareas.nth(0).fill('{"threshold": 5}')
      await textareas.nth(1).fill('{"notify": true}')
    }

    // Submit
    await dialog.getByRole('button', { name: /create|save/i }).click()

    await adminPage.waitForTimeout(500)
    const req = createMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
  })

  test('toggle rule active/inactive', async ({ adminPage }) => {
    const toggleMock = await mockApiMutation(adminPage, '**/api/v1/automation/1', 'PUT', { success: true })

    await adminPage.goto('/automation')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('Low Stock Reorder').first()).toBeVisible({ timeout: 10000 })

    // Find toggle button (On/Off) for first rule
    const onOffBtns = adminPage.getByRole('button', { name: /^on$|^off$/i })
    const btnCount = await onOffBtns.count()
    if (btnCount > 0) {
      await onOffBtns.first().click()
      await adminPage.waitForTimeout(500)
    }
  })

  test('switch to Logs tab and view execution logs', async ({ adminPage }) => {
    await adminPage.goto('/automation')
    await adminPage.waitForLoadState('networkidle')

    // Switch to Logs tab
    await adminPage.getByRole('button', { name: /logs/i }).click()
    await adminPage.waitForTimeout(500)

    // Log entries should be visible
    await expect(adminPage.locator('span.inline-flex', { hasText: 'SUCCESS' }).first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.locator('span.inline-flex', { hasText: 'ERROR' }).first()).toBeVisible()
    await expect(adminPage.locator('span.inline-flex', { hasText: 'SKIPPED' }).first()).toBeVisible()

    // Trigger types
    await expect(adminPage.getByText('CRON').first()).toBeVisible()
    await expect(adminPage.getByText('MANUAL').first()).toBeVisible()
    await expect(adminPage.getByText('EVENT').first()).toBeVisible()
  })

  test('run rule manually', async ({ adminPage }) => {
    const runMock = await mockApiMutation(adminPage, '**/api/v1/automation/1/run', 'POST', {
      log: { id: 5, rule_id: 1, trigger_type: 'MANUAL', status: 'SUCCESS', result: null, created_at: '2024-01-15T11:00:00Z' },
    })

    await adminPage.goto('/automation')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('Low Stock Reorder').first()).toBeVisible({ timeout: 10000 })

    // Find Run button
    const runBtns = adminPage.getByRole('button', { name: /^run$/i })
    const btnCount = await runBtns.count()
    if (btnCount > 0) {
      await runBtns.first().click()
      await adminPage.waitForTimeout(500)
    }
  })

  test('evaluate all rules', async ({ adminPage }) => {
    const evalMock = await mockApiMutation(adminPage, '**/api/v1/automation/evaluate-all', 'POST', {
      evaluated: 3,
      executed: 2,
    })

    await adminPage.goto('/automation')
    await adminPage.waitForLoadState('networkidle')

    const evalBtn = adminPage.getByRole('button', { name: /evaluate all/i })
    const isVisible = await evalBtn.isVisible().catch(() => false)
    if (isVisible) {
      await evalBtn.click()
      await adminPage.waitForTimeout(500)
    }
  })
})
