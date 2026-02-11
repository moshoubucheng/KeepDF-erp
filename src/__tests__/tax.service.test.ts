import { describe, it, expect } from 'vitest'
import { TaxService } from '../services/tax.service'

describe('TaxService', () => {
  describe('calculateTax', () => {
    it('標準税率 10%', () => {
      const result = TaxService.calculateTax(1000, 'standard')
      expect(result.rate).toBe(0.10)
      expect(result.taxAmount).toBe(100)
      expect(result.totalWithTax).toBe(1100)
    })

    it('軽減税率 8%', () => {
      const result = TaxService.calculateTax(1000, 'reduced')
      expect(result.rate).toBe(0.08)
      expect(result.taxAmount).toBe(80)
      expect(result.totalWithTax).toBe(1080)
    })

    it('日元向下取整（無小数）', () => {
      const result = TaxService.calculateTax(999, 'standard')
      // 999 * 0.10 = 99.9 → floor → 99
      expect(result.taxAmount).toBe(99)
      expect(result.totalWithTax).toBe(1098)
    })
  })

  describe('calculateOrderTax', () => {
    it('混合税率订单', () => {
      const result = TaxService.calculateOrderTax([
        { price: 1200, qty: 2, taxCategory: 'reduced' },   // 2400 * 8% = 192
        { price: 3800, qty: 1, taxCategory: 'standard' },  // 3800 * 10% = 380
      ])
      expect(result.totalTax).toBe(192 + 380)
      expect(result.totalWithTax).toBe(2400 + 192 + 3800 + 380)
      expect(result.breakdown).toHaveLength(2)
    })
  })

  describe('generateInvoiceData', () => {
    it('生成適格請求書', () => {
      const invoice = TaxService.generateInvoiceData({
        sellerName: '東京物産株式会社',
        sellerTaxRegNumber: 'T1234567890123',
        buyerName: '大阪商事',
        date: '2026-02-11',
        items: [
          { name: 'にんじんジュース', qty: 2, unitPrice: 1200, taxCategory: 'reduced' },
          { name: 'フェイスマスク', qty: 1, unitPrice: 3800, taxCategory: 'standard' },
        ],
      })
      expect(invoice.invoiceType).toBe('適格請求書')
      expect(invoice.seller.registrationNumber).toBe('T1234567890123')
      expect(invoice.summary.tax8).toBe(192)
      expect(invoice.summary.tax10).toBe(380)
      expect(invoice.summary.grandTotal).toBe(2400 + 192 + 3800 + 380)
    })
  })
})
