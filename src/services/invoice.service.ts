import type { Invoice, Order, Distributor } from '../db/types'
import { TaxService } from './tax.service'

export class InvoiceService {
    constructor(private db: D1Database) {}

    /** 为订单生成适格请求书 */
    async generateInvoice(
        orderId: number,
        distributorId: number,
        buyerName: string,
        invoiceDate?: string,
    ): Promise<Invoice> {
        // 1. 验证订单
        const order = await this.db.prepare('SELECT * FROM orders WHERE id = ?')
            .bind(orderId).first<Order>()
        if (!order) throw new Error('Order not found')
        if (order.distributor_id !== distributorId) throw new Error('Order does not belong to you')

        // 2. 检查重复
        const existing = await this.db.prepare('SELECT id FROM invoices WHERE order_id = ?')
            .bind(orderId).first()
        if (existing) throw new Error('Invoice already exists for this order')

        // 3. 查询订单商品 + 税类
        const { results: items } = await this.db.prepare(`
            SELECT oi.sku, oi.qty, oi.unit_price, p.name_jp, p.tax_category
            FROM order_items oi
            JOIN products p ON p.sku = oi.sku
            WHERE oi.order_id = ?
        `).bind(orderId).all()

        // 4. 查询分销商
        const distributor = await this.db.prepare(
            'SELECT name, tax_reg_number FROM distributors WHERE id = ?'
        ).bind(distributorId).first<Distributor>()

        // 5. 生成 Invoice 数据
        const date = invoiceDate || new Date().toISOString().split('T')[0]
        const taxDetails = TaxService.generateInvoiceData({
            sellerName: distributor?.name || 'KeepDF',
            sellerTaxRegNumber: distributor?.tax_reg_number || 'T0000000000000',
            buyerName,
            items: items.map((item: any) => ({
                name: item.name_jp || item.sku,
                qty: item.qty,
                unitPrice: item.unit_price,
                taxCategory: item.tax_category || 'standard',
            })),
            date,
        })

        // 6. 生成 invoice_number
        const dateStr = date.replace(/-/g, '')
        const invoiceNumber = `INV-${dateStr}-${orderId}`

        // 7. 插入数据库
        const { meta } = await this.db.prepare(
            'INSERT INTO invoices (order_id, invoice_number, tax_details) VALUES (?, ?, ?)'
        ).bind(orderId, invoiceNumber, JSON.stringify(taxDetails)).run()

        return {
            id: meta.last_row_id as number,
            order_id: orderId,
            invoice_number: invoiceNumber,
            pdf_url: null,
            tax_details: JSON.stringify(taxDetails),
            created_at: new Date().toISOString(),
        }
    }

    /** 获取 Invoice 详情 */
    async getInvoice(invoiceId: number, distributorId: number): Promise<{ invoice: any; order: any } | null> {
        const result = await this.db.prepare(`
            SELECT i.*, o.platform, o.platform_order_id, o.total_amount, o.status, o.distributor_id
            FROM invoices i
            JOIN orders o ON o.id = i.order_id
            WHERE i.id = ?
        `).bind(invoiceId).first<any>()

        if (!result) return null
        if (result.distributor_id !== distributorId) throw new Error('Forbidden')

        return {
            invoice: {
                id: result.id,
                order_id: result.order_id,
                invoice_number: result.invoice_number,
                pdf_url: result.pdf_url,
                tax_details: JSON.parse(result.tax_details || '{}'),
                created_at: result.created_at,
            },
            order: {
                id: result.order_id,
                platform: result.platform,
                platform_order_id: result.platform_order_id,
                total_amount: result.total_amount,
                status: result.status,
            },
        }
    }

    /** Invoice 列表 */
    async listInvoices(distributorId: number, filters?: {
        orderId?: number
        limit?: number
        offset?: number
    }): Promise<{ invoices: any[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let sql = `
            SELECT i.id, i.order_id, i.invoice_number, i.pdf_url, i.created_at,
                   o.platform, o.platform_order_id, o.total_amount, o.status
            FROM invoices i
            JOIN orders o ON o.id = i.order_id
            WHERE o.distributor_id = ?`
        let countSql = `
            SELECT COUNT(*) as total
            FROM invoices i
            JOIN orders o ON o.id = i.order_id
            WHERE o.distributor_id = ?`
        const params: any[] = [distributorId]
        const countParams: any[] = [distributorId]

        if (filters?.orderId) {
            sql += ' AND i.order_id = ?'
            countSql += ' AND i.order_id = ?'
            params.push(filters.orderId)
            countParams.push(filters.orderId)
        }

        sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?'
        params.push(limit, offset)

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        const invoices = results.map((r: any) => ({
            id: r.id,
            order_id: r.order_id,
            invoice_number: r.invoice_number,
            pdf_url: r.pdf_url,
            created_at: r.created_at,
            order: {
                platform: r.platform,
                platform_order_id: r.platform_order_id,
                total_amount: r.total_amount,
                status: r.status,
            },
        }))

        return { invoices, total: countResult?.total || 0 }
    }
}
