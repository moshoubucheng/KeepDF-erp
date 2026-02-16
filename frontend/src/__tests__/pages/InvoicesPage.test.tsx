import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, userEvent, waitFor } from '../helpers/render'
import InvoicesPage from '@/pages/invoices/InvoicesPage'

// vi.mock is hoisted — all data must be inline (no external references)
vi.mock('@/api/endpoints/invoices', () => {
  const invoices = [
    {
      id: 1,
      order_id: 101,
      invoice_number: 'INV-20240101-001',
      platform: 'TIKTOK',
      total_amount: 5000,
      pdf_url: null,
      created_at: '2024-01-15T10:00:00Z',
      tax_details: JSON.stringify({
        seller: { name: 'KeepDF Inc.' },
        buyer: { name: 'Test Buyer' },
        items: [{ sku: 'SKU-001', name: 'Widget', quantity: 2, unit_price: 2000, tax_rate: 10, tax_amount: 400, subtotal: 4400 }],
        subtotal: 4000,
        tax_total: 400,
        total: 4400,
      }),
    },
    {
      id: 2,
      order_id: 102,
      invoice_number: 'INV-20240101-002',
      platform: 'RAKUTEN',
      total_amount: 3000,
      pdf_url: '/files/inv-2.pdf',
      created_at: '2024-01-16T12:00:00Z',
      tax_details: '{}',
    },
  ]

  return {
    invoicesApi: {
      list: vi.fn().mockResolvedValue({
        invoices,
        total: 2,
        count: 2,
        hasMore: false,
      }),
      detail: vi.fn().mockResolvedValue({
        ...invoices[0],
        order: { status: 'DELIVERED', platform_order_id: 'TT-12345' },
      }),
      generate: vi.fn().mockResolvedValue({ success: true, invoice: invoices[0] }),
      generatePdf: vi.fn().mockResolvedValue({ success: true, pdf_url: '/files/inv-1.pdf' }),
      downloadPdfUrl: (id: number) => `/api/v1/invoices/${id}/pdf`,
      exportCsvUrl: () => '/api/v1/invoices/export',
    },
  }
})

// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', { value: mockOpen, writable: true })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InvoicesPage', () => {
  it('renders invoice list with data', async () => {
    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByText('INV-20240101-001')).toBeInTheDocument()
      expect(screen.getByText('INV-20240101-002')).toBeInTheDocument()
    })
  })

  it('shows page title', () => {
    render(<InvoicesPage />)
    expect(screen.getByText('invoices.title')).toBeInTheDocument()
  })

  it('renders stat cards', async () => {
    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByText('invoices.total_count')).toBeInTheDocument()
      expect(screen.getByText('invoices.with_pdf')).toBeInTheDocument()
      expect(screen.getByText('invoices.without_pdf')).toBeInTheDocument()
    })
  })

  it('opens detail modal when clicking eye button', async () => {
    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByText('INV-20240101-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const viewButtons = screen.getAllByTitle('invoices.detail')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('invoices.detail_title')).toBeInTheDocument()
    })
  })

  it('displays structured tax info in detail modal', async () => {
    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByText('INV-20240101-001')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const viewButtons = screen.getAllByTitle('invoices.detail')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('KeepDF Inc.')).toBeInTheDocument()
      expect(screen.getByText('Test Buyer')).toBeInTheDocument()
    })
  })

  it('opens generate invoice modal', async () => {
    render(<InvoicesPage />)

    const user = userEvent.setup()
    const generateBtn = screen.getByText('invoices.generate')
    await user.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByText('invoices.generate_title')).toBeInTheDocument()
      expect(screen.getByText('invoices.buyer_name')).toBeInTheDocument()
    })
  })

  it('has CSV export button', () => {
    render(<InvoicesPage />)
    expect(screen.getByText('CSV')).toBeInTheDocument()
  })

  it('shows download button for invoices with PDF', async () => {
    render(<InvoicesPage />)

    await waitFor(() => {
      expect(screen.getByText('INV-20240101-002')).toBeInTheDocument()
    })

    const downloadButtons = screen.getAllByTitle('invoices.download_pdf')
    expect(downloadButtons.length).toBeGreaterThanOrEqual(1)
  })
})
