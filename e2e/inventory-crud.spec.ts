import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'
import { mockProduct } from './helpers/mock-data'

const MOCK_PRODUCTS = {
  products: [
    mockProduct({ id: 1, sku: 'SKU-001', name_jp: 'ウィジェットA', name_cn: 'Widget A', cost_price: 2500, tax_category: 'standard', total_stock: 100 }),
    mockProduct({ id: 2, sku: 'SKU-002', name_jp: 'ウィジェットB', name_cn: 'Widget B', cost_price: 1800, tax_category: 'standard', total_stock: 5 }),
    mockProduct({ id: 3, sku: 'SKU-003', name_jp: 'ガジェットC', name_cn: 'Gadget C', cost_price: 5000, tax_category: 'reduced', total_stock: 0 }),
  ],
}

test.describe('Inventory CRUD', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/inventory*', MOCK_PRODUCTS)
  })

  test('Add Product opens modal', async ({ adminPage }) => {
    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')

    // Wait for data to load
    await expect(adminPage.getByText('SKU-001')).toBeVisible({ timeout: 10000 })

    // Click "Add Product" button (the primary button with Plus icon)
    const addButton = adminPage.getByRole('button', { name: /add product/i })
    await addButton.click()

    // Modal should open
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Form fields: SKU, Name JP, Name CN, Cost Price, Tax Category
    await expect(dialog.getByText('SKU')).toBeVisible()
    await expect(dialog.locator('select')).toBeVisible() // Tax Category select
  })

  test('Add submits POST /inventory/products', async ({ adminPage }) => {
    const createMock = await mockApiMutation(adminPage, '**/api/v1/inventory/products', 'POST', {
      status: 'ok',
      sku: 'SKU-NEW',
    })

    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')
    await expect(adminPage.getByText('SKU-001')).toBeVisible({ timeout: 10000 })

    // Open add modal
    await adminPage.getByRole('button', { name: /add product/i }).click()
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Fill form fields
    const inputs = dialog.locator('input')
    await inputs.first().fill('SKU-NEW') // SKU
    await inputs.nth(1).fill('新商品') // Name JP
    await inputs.nth(2).fill('New Product') // Name CN
    await inputs.nth(3).fill('3000') // Cost Price
    // Tax category defaults to 'standard'

    // Submit
    await dialog.getByRole('button', { name: /save/i }).click()

    await adminPage.waitForTimeout(500)
    const req = createMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
    expect(req!.body).toMatchObject({
      sku: 'SKU-NEW',
      name_jp: '新商品',
      cost_price: 3000,
      tax_category: 'standard',
    })
  })

  test('Edit opens pre-filled modal', async ({ adminPage }) => {
    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')
    await expect(adminPage.getByText('SKU-001')).toBeVisible({ timeout: 10000 })

    // Click Pencil (edit) icon on first product row
    const firstRow = adminPage.locator('tr', { hasText: 'SKU-001' })
    await firstRow.locator('button').first().click()

    // Modal should open with pre-filled data
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // SKU field should have existing value
    const skuInput = dialog.locator('input').first()
    await expect(skuInput).toHaveValue('SKU-001')
  })

  test('Delete opens confirm dialog', async ({ adminPage }) => {
    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')
    await expect(adminPage.getByText('SKU-001')).toBeVisible({ timeout: 10000 })

    // Click Trash2 (delete) icon on first product row — second button in actions
    const firstRow = adminPage.locator('tr', { hasText: 'SKU-001' })
    await firstRow.locator('button').nth(1).click()

    // Confirm delete modal should open
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Should show delete confirmation with SKU name
    await expect(dialog.getByText(/SKU-001/)).toBeVisible()

    // Cancel and Delete buttons
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /delete/i })).toBeVisible()
  })

  test('Inbound Stock opens modal', async ({ adminPage }) => {
    await adminPage.goto('/inventory')
    await adminPage.waitForLoadState('networkidle')
    await expect(adminPage.getByText('SKU-001')).toBeVisible({ timeout: 10000 })

    // Click Inbound button (secondary variant with PackagePlus icon)
    const inboundButton = adminPage.getByRole('button', { name: /inbound/i })
    await inboundButton.click()

    // Modal should open
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Form fields: SKU, Location Code, Expected Qty, Actual Qty
    await expect(dialog.getByText('SKU')).toBeVisible()
    await expect(dialog.getByText('Location Code')).toBeVisible()
    await expect(dialog.getByText(/expected qty/i)).toBeVisible()
    await expect(dialog.getByText(/actual qty/i)).toBeVisible()
  })
})
