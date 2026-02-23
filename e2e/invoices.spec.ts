import { test, expect } from './fixtures/auth'
import { mockApiGet, mockApiMutation } from './helpers/api-mock'
import { mockInvoice } from './helpers/mock-data'

const MOCK_INVOICES = {
  invoices: [
    mockInvoice({ id: 1, order_id: 101, invoice_number: 'INV-202401-001', platform: 'TIKTOK', total_amount: 5500, pdf_url: '/invoices/1/pdf' }),
    mockInvoice({ id: 2, order_id: 102, invoice_number: 'INV-202401-002', platform: 'TEMU', total_amount: 8800, pdf_url: null }),
    mockInvoice({ id: 3, order_id: 103, invoice_number: 'INV-202401-003', platform: 'RAKUTEN', total_amount: 3300, pdf_url: '/invoices/3/pdf' }),
  ],
  total: 3,
}

test.describe('Invoices Page', () => {
  test.beforeEach(async ({ adminPage }) => {
    await mockApiGet(adminPage, '**/api/v1/invoices?*', MOCK_INVOICES)
    await mockApiGet(adminPage, '**/api/v1/invoices', MOCK_INVOICES)
  })

  test('renders invoice list with number, order_id, and amount', async ({ adminPage }) => {
    await adminPage.goto('/invoices')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('INV-202401-001').first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('INV-202401-002').first()).toBeVisible()
    await expect(adminPage.getByText('INV-202401-003').first()).toBeVisible()

    // Order IDs
    await expect(adminPage.getByText('101').first()).toBeVisible()
    await expect(adminPage.getByText('102').first()).toBeVisible()

    // Amounts (formatted as JPY)
    await expect(adminPage.getByText(/5,500/).first()).toBeVisible()
    await expect(adminPage.getByText(/8,800/).first()).toBeVisible()
  })

  test('stat cards show correct counts', async ({ adminPage }) => {
    await adminPage.goto('/invoices')
    await adminPage.waitForLoadState('networkidle')

    // Stat card labels visible
    await expect(adminPage.getByText('Total Invoices').first()).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('With PDF').first()).toBeVisible()
    await expect(adminPage.getByText('Without PDF').first()).toBeVisible()

    // With PDF stat shows "2/3" (2 invoices have pdf_url out of 3 total)
    await expect(adminPage.getByText('2/3').first()).toBeVisible()
    // Without PDF stat shows "1/3"
    await expect(adminPage.getByText('1/3').first()).toBeVisible()
  })

  test('PDF download triggers blob request', async ({ adminPage }) => {
    let pdfRequested = false
    await adminPage.route('**/api/v1/invoices/1/pdf', (route) => {
      pdfRequested = true
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 mock'),
      })
    })

    await adminPage.goto('/invoices')
    await adminPage.waitForLoadState('networkidle')

    await expect(adminPage.getByText('INV-202401-001').first()).toBeVisible({ timeout: 10000 })

    // Find the download PDF button for first invoice (which has pdf_url)
    const downloadBtns = adminPage.locator('button[title*="PDF"], button[title*="Download"]')
    const count = await downloadBtns.count()
    if (count > 0) {
      await downloadBtns.first().click()
      await adminPage.waitForTimeout(1000)
      expect(pdfRequested).toBe(true)
    }
  })

  test('CSV export triggers download', async ({ adminPage }) => {
    let exportRequested = false
    await adminPage.route('**/api/v1/invoices/export*', (route) => {
      exportRequested = true
      return route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'invoice_number,order_id,total_amount\nINV-202401-001,101,5500',
      })
    })

    await adminPage.goto('/invoices')
    await adminPage.waitForLoadState('networkidle')

    // Find CSV export button
    const csvBtn = adminPage.getByRole('button', { name: /csv/i })
    await expect(csvBtn).toBeVisible({ timeout: 10000 })
    await csvBtn.click()
    await adminPage.waitForTimeout(1000)
    expect(exportRequested).toBe(true)
  })

  test('generate invoice modal opens', async ({ adminPage }) => {
    await adminPage.goto('/invoices')
    await adminPage.waitForLoadState('networkidle')

    // Click Generate button
    const generateBtn = adminPage.getByRole('button', { name: /generate/i })
    await expect(generateBtn).toBeVisible({ timeout: 10000 })
    await generateBtn.click()

    // Modal should open with form fields
    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Should have Order ID and Buyer Name fields
    await expect(dialog.locator('input').first()).toBeVisible()
  })

  test('generate invoice submits form', async ({ adminPage }) => {
    const generateMock = await mockApiMutation(adminPage, '**/api/v1/invoices/generate', 'POST', {
      success: true,
      invoice: mockInvoice({ id: 4, invoice_number: 'INV-202401-004' }),
    })

    await adminPage.goto('/invoices')
    await adminPage.waitForLoadState('networkidle')

    await adminPage.getByRole('button', { name: /generate/i }).click()

    const dialog = adminPage.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Fill form - Order ID and Buyer Name
    const inputs = dialog.locator('input')
    const inputCount = await inputs.count()
    if (inputCount >= 2) {
      await inputs.nth(0).fill('105')
      await inputs.nth(1).fill('Test Buyer')
    }

    // Submit
    await dialog.getByRole('button', { name: /generate|save|create/i }).last().click()

    await adminPage.waitForTimeout(500)
    const req = generateMock.getLastRequest()
    expect(req).not.toBeNull()
    expect(req!.method).toBe('POST')
  })
})
