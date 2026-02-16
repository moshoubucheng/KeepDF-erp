import { api } from '../client'

interface Invoice {
  id: number
  order_id: number
  invoice_number: string
  tax_details: string
  pdf_url?: string
  created_at: string
}

interface InvoiceListResponse {
  invoices: (Invoice & { platform?: string; total_amount?: number })[]
  total: number
  count: number
  hasMore: boolean
}

export const invoicesApi = {
  list: (offset = 0, limit = 50) =>
    api.get<InvoiceListResponse>(`/invoices?offset=${offset}&limit=${limit}`),

  detail: (id: number) =>
    api.get<Invoice & { order?: unknown }>(`/invoices/${id}`),

  generate: (orderId: number, buyerName: string, invoiceDate?: string) =>
    api.post<{ success: boolean; invoice: Invoice }>(`/invoices/generate/${orderId}`, {
      buyerName,
      invoiceDate,
    }),

  generatePdf: (id: number) =>
    api.post<{ success: boolean; pdf_url: string }>(`/invoices/${id}/pdf`),

  downloadPdfUrl: (id: number) => `/api/v1/invoices/${id}/pdf`,

  exportCsvUrl: () => '/api/v1/invoices/export',
}

export type { Invoice, InvoiceListResponse }
