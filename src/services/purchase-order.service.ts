import type { PurchaseOrder, PurchaseOrderItem } from '../db/types'

const VALID_STATUSES = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'CLOSED'] as const
const STATUS_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['CONFIRMED', 'DRAFT'],
    CONFIRMED: ['SHIPPED'],
    SHIPPED: ['RECEIVED'],
    RECEIVED: ['CLOSED'],
}

export class PurchaseOrderService {
    constructor(private db: D1Database) {}

    async list(filters?: {
        status?: string
        supplierId?: number
        limit?: number
        offset?: number
    }): Promise<{ orders: any[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters?.status) {
            where += ' AND po.status = ?'
            params.push(filters.status.toUpperCase())
        }
        if (filters?.supplierId) {
            where += ' AND po.supplier_id = ?'
            params.push(filters.supplierId)
        }

        const countParams = [...params]

        const sql = `SELECT po.*, s.name as supplier_name
                     FROM purchase_orders po
                     LEFT JOIN suppliers s ON s.id = po.supplier_id
                     ${where} ORDER BY po.created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM purchase_orders po ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { orders: results, total: countResult?.total || 0 }
    }

    async getById(id: number): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] } | null> {
        const order = await this.db.prepare(
            `SELECT po.*, s.name as supplier_name
             FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
             WHERE po.id = ?`
        ).bind(id).first<PurchaseOrder>()

        if (!order) return null

        const { results: items } = await this.db.prepare(
            'SELECT * FROM purchase_order_items WHERE po_id = ?'
        ).bind(id).all<PurchaseOrderItem>()

        return { order, items }
    }

    async create(data: {
        supplierId: number
        items: { sku: string; qty: number; unit_cost: number }[]
        notes?: string
        expectedDelivery?: string
        createdBy: number
    }): Promise<PurchaseOrder> {
        if (!data.items || data.items.length === 0) {
            throw new Error('At least one item is required')
        }

        // Validate supplier exists
        const supplier = await this.db.prepare('SELECT id FROM suppliers WHERE id = ? AND is_active = 1')
            .bind(data.supplierId).first()
        if (!supplier) throw new Error('Supplier not found or inactive')

        // Generate PO number
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const count = await this.db.prepare(
            "SELECT COUNT(*) as cnt FROM purchase_orders WHERE po_number LIKE ?"
        ).bind(`PO-${dateStr}-%`).first<{ cnt: number }>()
        const seq = String((count?.cnt || 0) + 1).padStart(3, '0')
        const poNumber = `PO-${dateStr}-${seq}`

        const totalAmount = data.items.reduce((sum, item) => sum + item.qty * item.unit_cost, 0)

        const stmts: D1PreparedStatement[] = []

        stmts.push(
            this.db.prepare(
                `INSERT INTO purchase_orders (po_number, supplier_id, total_amount, notes, expected_delivery, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(poNumber, data.supplierId, totalAmount, data.notes || null, data.expectedDelivery || null, data.createdBy)
        )

        await this.db.batch(stmts)

        const po = await this.db.prepare(
            'SELECT * FROM purchase_orders WHERE po_number = ?'
        ).bind(poNumber).first<PurchaseOrder>()

        if (!po) throw new Error('Failed to create purchase order')

        // Insert items
        const itemStmts = data.items.map(item =>
            this.db.prepare(
                'INSERT INTO purchase_order_items (po_id, sku, qty, unit_cost) VALUES (?, ?, ?, ?)'
            ).bind(po.id, item.sku, item.qty, item.unit_cost)
        )

        if (itemStmts.length > 0) {
            await this.db.batch(itemStmts)
        }

        return po
    }

    async update(id: number, data: {
        notes?: string
        expectedDelivery?: string
    }): Promise<PurchaseOrder | null> {
        const po = await this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?')
            .bind(id).first<PurchaseOrder>()
        if (!po) return null
        if (po.status !== 'DRAFT') throw new Error('Only DRAFT POs can be edited')

        const fields: string[] = []
        const values: (string | number | null)[] = []

        if (data.notes !== undefined) {
            fields.push('notes = ?')
            values.push(data.notes)
        }
        if (data.expectedDelivery !== undefined) {
            fields.push('expected_delivery = ?')
            values.push(data.expectedDelivery)
        }

        if (fields.length === 0) return po

        fields.push('updated_at = CURRENT_TIMESTAMP')
        values.push(id)

        await this.db.prepare(
            `UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        return this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?')
            .bind(id).first<PurchaseOrder>()
    }

    async updateStatus(id: number, newStatus: string): Promise<PurchaseOrder> {
        const upper = newStatus.toUpperCase()
        if (!VALID_STATUSES.includes(upper as typeof VALID_STATUSES[number])) {
            throw new Error(`Invalid status: ${newStatus}`)
        }

        const po = await this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?')
            .bind(id).first<PurchaseOrder>()
        if (!po) throw new Error('Purchase order not found')

        const allowed = STATUS_TRANSITIONS[po.status]
        if (!allowed || !allowed.includes(upper)) {
            throw new Error(`Cannot transition from ${po.status} to ${upper}`)
        }

        await this.db.prepare(
            'UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(upper, id).run()

        return this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?')
            .bind(id).first<PurchaseOrder>() as Promise<PurchaseOrder>
    }

    async receive(id: number, receivedItems?: { sku: string; received_qty: number }[]): Promise<PurchaseOrder> {
        const po = await this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?')
            .bind(id).first<PurchaseOrder>()
        if (!po) throw new Error('Purchase order not found')
        if (po.status !== 'SHIPPED') throw new Error('Only SHIPPED POs can be received')

        const { results: poItems } = await this.db.prepare(
            'SELECT * FROM purchase_order_items WHERE po_id = ?'
        ).bind(id).all<PurchaseOrderItem>()

        // Batch pre-fetch: which SKUs already have warehouse locations
        const skuList = poItems.map(i => i.sku)
        const skuPlaceholders = skuList.map(() => '?').join(',')
        const { results: whRows } = await this.db.prepare(
            `SELECT sku FROM warehouse_locations WHERE sku IN (${skuPlaceholders})`
        ).bind(...skuList).all<{ sku: string }>()
        const existingSkuSet = new Set(whRows.map(r => r.sku))

        const stmts: D1PreparedStatement[] = []

        for (const item of poItems) {
            const received = receivedItems?.find(r => r.sku === item.sku)
            const receivedQty = received?.received_qty ?? item.qty

            // Update PO item received qty
            stmts.push(
                this.db.prepare(
                    'UPDATE purchase_order_items SET received_qty = ? WHERE id = ?'
                ).bind(receivedQty, item.id)
            )

            // Update warehouse stock
            if (existingSkuSet.has(item.sku)) {
                stmts.push(
                    this.db.prepare(
                        'UPDATE warehouse_locations SET qty = qty + ? WHERE sku = ?'
                    ).bind(receivedQty, item.sku)
                )
            } else {
                stmts.push(
                    this.db.prepare(
                        "INSERT INTO warehouse_locations (code, sku, qty) VALUES (?, ?, ?)"
                    ).bind(`AUTO-${item.sku}`, item.sku, receivedQty)
                )
                existingSkuSet.add(item.sku) // mark as existing for subsequent items with same SKU
            }

            // Insert inbound record
            stmts.push(
                this.db.prepare(
                    'INSERT INTO inbound_records (sku, expected_qty, actual_qty) VALUES (?, ?, ?)'
                ).bind(item.sku, item.qty, receivedQty)
            )
        }

        // Update PO status
        stmts.push(
            this.db.prepare(
                "UPDATE purchase_orders SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(id)
        )

        await this.db.batch(stmts)

        return this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?')
            .bind(id).first<PurchaseOrder>() as Promise<PurchaseOrder>
    }
}
