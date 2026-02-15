import type { Return, ReturnItem, Order } from '../db/types'
import { WalletService } from './wallet.service'
import { CommunicationService } from './communication.service'

const VALID_STATUSES = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED'] as const

export class ReturnService {
    private walletService: WalletService
    private communicationService: CommunicationService

    constructor(private db: D1Database) {
        this.walletService = new WalletService(db)
        this.communicationService = new CommunicationService(db)
    }

    async list(distributorId: number, role: string, filters?: {
        status?: string
        limit?: number
        offset?: number
    }): Promise<{ returns: any[]; total: number }> {
        const limit = Math.min(filters?.limit || 50, 200)
        const offset = filters?.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (role !== 'admin') {
            where += ' AND r.distributor_id = ?'
            params.push(distributorId)
        }
        if (filters?.status) {
            where += ' AND r.status = ?'
            params.push(filters.status.toUpperCase())
        }

        const countParams = [...params]

        const sql = `SELECT r.*, o.platform, o.platform_order_id, o.total_amount as order_amount
                     FROM returns r
                     LEFT JOIN orders o ON o.id = r.order_id
                     ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM returns r ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { returns: results, total: countResult?.total || 0 }
    }

    async getById(id: number, distributorId: number, role: string): Promise<{ returnOrder: Return; items: ReturnItem[] } | null> {
        let sql = 'SELECT * FROM returns WHERE id = ?'
        const params: (string | number)[] = [id]

        if (role !== 'admin') {
            sql += ' AND distributor_id = ?'
            params.push(distributorId)
        }

        const returnOrder = await this.db.prepare(sql).bind(...params).first<Return>()
        if (!returnOrder) return null

        const { results: items } = await this.db.prepare(
            'SELECT * FROM return_items WHERE return_id = ?'
        ).bind(id).all<ReturnItem>()

        return { returnOrder, items }
    }

    async create(data: {
        orderId: number
        reason?: string
        notes?: string
        refundType?: string
        items: { sku: string; qty: number; unit_price: number; reason?: string }[]
        distributorId: number
        role: string
    }): Promise<Return> {
        if (!data.items || data.items.length === 0) {
            throw new Error('At least one return item is required')
        }

        // Verify order exists and is DELIVERED
        let orderSql = 'SELECT * FROM orders WHERE id = ?'
        const orderParams: (string | number)[] = [data.orderId]
        if (data.role !== 'admin') {
            orderSql += ' AND distributor_id = ?'
            orderParams.push(data.distributorId)
        }

        const order = await this.db.prepare(orderSql).bind(...orderParams).first<Order>()
        if (!order) throw new Error('Order not found')
        if (order.status !== 'DELIVERED') throw new Error('Only DELIVERED orders can be returned')

        // Check for existing active return
        const existingReturn = await this.db.prepare(
            "SELECT id FROM returns WHERE order_id = ? AND status NOT IN ('REJECTED','REFUNDED')"
        ).bind(data.orderId).first()
        if (existingReturn) throw new Error('An active return already exists for this order')

        const refundAmount = data.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)

        // Find shipment
        const shipment = await this.db.prepare(
            'SELECT id FROM shipments WHERE order_id = ? ORDER BY id DESC LIMIT 1'
        ).bind(data.orderId).first<{ id: number }>()

        const { meta } = await this.db.prepare(
            `INSERT INTO returns (order_id, shipment_id, distributor_id, reason, notes, refund_type, refund_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            data.orderId,
            shipment?.id || null,
            order.distributor_id,
            data.reason || null,
            data.notes || null,
            data.refundType || 'FULL',
            refundAmount
        ).run()

        const returnId = meta.last_row_id

        // Insert return items
        const itemStmts = data.items.map(item =>
            this.db.prepare(
                'INSERT INTO return_items (return_id, sku, qty, unit_price, reason) VALUES (?, ?, ?, ?, ?)'
            ).bind(returnId, item.sku, item.qty, item.unit_price, item.reason || null)
        )

        if (itemStmts.length > 0) {
            await this.db.batch(itemStmts)
        }

        return this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(returnId).first<Return>() as Promise<Return>
    }

    async approve(id: number): Promise<Return> {
        const ret = await this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>()
        if (!ret) throw new Error('Return not found')
        if (ret.status !== 'REQUESTED') throw new Error('Only REQUESTED returns can be approved')

        await this.db.prepare(
            "UPDATE returns SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(id).run()

        // Trigger communication
        try {
            await this.communicationService.triggerOnEvent('RETURN_APPROVED', ret.order_id, ret.distributor_id)
        } catch (e) {
            console.error('[RETURN] Communication trigger failed:', e)
        }

        return this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>() as Promise<Return>
    }

    async reject(id: number, reason?: string): Promise<Return> {
        const ret = await this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>()
        if (!ret) throw new Error('Return not found')
        if (ret.status !== 'REQUESTED') throw new Error('Only REQUESTED returns can be rejected')

        await this.db.prepare(
            "UPDATE returns SET status = 'REJECTED', notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(reason || null, id).run()

        // Trigger communication
        try {
            await this.communicationService.triggerOnEvent('RETURN_REJECTED', ret.order_id, ret.distributor_id)
        } catch (e) {
            console.error('[RETURN] Communication trigger failed:', e)
        }

        return this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>() as Promise<Return>
    }

    async receive(id: number): Promise<Return> {
        const ret = await this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>()
        if (!ret) throw new Error('Return not found')
        if (ret.status !== 'APPROVED') throw new Error('Only APPROVED returns can be received')

        // Get return items
        const { results: items } = await this.db.prepare(
            'SELECT * FROM return_items WHERE return_id = ?'
        ).bind(id).all<ReturnItem>()

        const stmts: D1PreparedStatement[] = []

        // Restock warehouse
        for (const item of items) {
            stmts.push(
                this.db.prepare(
                    'UPDATE warehouse_locations SET qty = qty + ? WHERE sku = ?'
                ).bind(item.qty, item.sku)
            )
        }

        // Update return status
        stmts.push(
            this.db.prepare(
                "UPDATE returns SET status = 'RECEIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(id)
        )

        await this.db.batch(stmts)

        return this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>() as Promise<Return>
    }

    async refund(id: number): Promise<Return> {
        const ret = await this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>()
        if (!ret) throw new Error('Return not found')
        if (ret.status !== 'RECEIVED') throw new Error('Only RECEIVED returns can be refunded')

        const refundAmount = ret.refund_amount || 0
        if (refundAmount <= 0) throw new Error('Invalid refund amount')

        // 1. Process wallet refund
        await this.walletService.refund(ret.distributor_id, refundAmount, String(ret.order_id))

        // 2. Get the wallet tx id
        const walletTx = await this.db.prepare(
            "SELECT id FROM wallet_transactions WHERE distributor_id = ? AND type = 'REFUND' AND related_order_id = ? ORDER BY id DESC LIMIT 1"
        ).bind(ret.distributor_id, String(ret.order_id)).first<{ id: number }>()

        // 3. Reverse commission (insert negative settlement)
        const { results: settlements } = await this.db.prepare(
            "SELECT * FROM commission_settlements WHERE order_id = ? AND status = 'SETTLED'"
        ).bind(ret.order_id).all<any>()

        const stmts: D1PreparedStatement[] = []

        for (const s of settlements) {
            stmts.push(
                this.db.prepare(
                    `INSERT INTO commission_settlements
                     (distributor_id, order_id, sku, platform, qty, unit_price, commission_rate, commission_amount, status, settled_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED', datetime('now'))`
                ).bind(
                    s.distributor_id, s.order_id, s.sku, s.platform,
                    -(s.qty as number), s.unit_price, s.commission_rate,
                    -(s.commission_amount as number)
                )
            )
        }

        // 4. Update return status
        stmts.push(
            this.db.prepare(
                "UPDATE returns SET status = 'REFUNDED', wallet_tx_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(walletTx?.id || null, id)
        )

        if (stmts.length > 0) {
            await this.db.batch(stmts)
        }

        return this.db.prepare('SELECT * FROM returns WHERE id = ?')
            .bind(id).first<Return>() as Promise<Return>
    }
}
