import type { OrderItem } from '../db/types'

/**
 * TaxService - 日本消费税计算引擎
 * 标准税率 10%，轻减税率 8%
 */
export class TaxService {
    static readonly STANDARD_RATE = 0.10
    static readonly REDUCED_RATE = 0.08

    /** 根据商品税类计算含税价格 */
    static calculateTax(
        priceExcludingTax: number,
        taxCategory: 'standard' | 'reduced'
    ): { taxAmount: number; totalWithTax: number; rate: number } {
        const rate = taxCategory === 'reduced' ? this.REDUCED_RATE : this.STANDARD_RATE
        const taxAmount = Math.floor(priceExcludingTax * rate) // 日元无小数
        return {
            taxAmount,
            totalWithTax: priceExcludingTax + taxAmount,
            rate,
        }
    }

    /** 计算订单总税额 */
    static calculateOrderTax(
        items: { price: number; qty: number; taxCategory: 'standard' | 'reduced' }[]
    ): { totalTax: number; totalWithTax: number; breakdown: any[] } {
        let totalTax = 0
        let totalWithTax = 0
        const breakdown: any[] = []

        for (const item of items) {
            const subtotal = item.price * item.qty
            const { taxAmount, totalWithTax: itemTotal, rate } = this.calculateTax(subtotal, item.taxCategory)
            totalTax += taxAmount
            totalWithTax += itemTotal
            breakdown.push({
                subtotal,
                taxRate: rate,
                taxAmount,
                total: itemTotal,
            })
        }

        return { totalTax, totalWithTax, breakdown }
    }

    /** 生成适格请求书 (Invoice) 数据 */
    static generateInvoiceData(params: {
        sellerName: string
        sellerTaxRegNumber: string
        buyerName: string
        items: { name: string; qty: number; unitPrice: number; taxCategory: 'standard' | 'reduced' }[]
        date: string
    }) {
        const { totalTax, totalWithTax, breakdown } = this.calculateOrderTax(
            params.items.map((i) => ({ price: i.unitPrice, qty: i.qty, taxCategory: i.taxCategory }))
        )

        return {
            invoiceType: '適格請求書',
            seller: {
                name: params.sellerName,
                registrationNumber: params.sellerTaxRegNumber, // T + 13 digits
            },
            buyer: params.buyerName,
            date: params.date,
            items: params.items.map((item, idx) => ({
                ...item,
                ...breakdown[idx],
            })),
            summary: {
                subtotal10: breakdown.filter((b) => b.taxRate === 0.10).reduce((s, b) => s + b.subtotal, 0),
                tax10: breakdown.filter((b) => b.taxRate === 0.10).reduce((s, b) => s + b.taxAmount, 0),
                subtotal8: breakdown.filter((b) => b.taxRate === 0.08).reduce((s, b) => s + b.subtotal, 0),
                tax8: breakdown.filter((b) => b.taxRate === 0.08).reduce((s, b) => s + b.taxAmount, 0),
                totalTax,
                grandTotal: totalWithTax,
            },
        }
    }
}
