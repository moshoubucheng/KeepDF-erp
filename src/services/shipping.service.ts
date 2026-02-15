/**
 * ShippingService - Shipment creation, stock deduction, batch shipping
 */
import { NotificationCenterService } from './notification-center.service'
import { ShipmentTrackingService } from './shipment-tracking.service'

const VALID_CARRIERS = ['YAMATO', 'SAGAWA', 'JAPAN_POST', 'FEDEX', 'DHL', 'OTHER'] as const
const VALID_STATUSES = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const

export class ShippingService {
    private notificationCenter: NotificationCenterService
    private trackingService: ShipmentTrackingService

    constructor(private db: D1Database) {
        this.notificationCenter = new NotificationCenterService(db)
        this.trackingService = new ShipmentTrackingService(db)
    }

    /** List shipments with filters */
    async list(params: {
        distributorId: number
        role: string
        status?: string
        carrier?: string
        limit?: number
        offset?: number
    }): Promise<{ shipments: any[]; total: number }> {
        const limit = Math.min(Math.max(1, params.limit || 50), 200)
        const offset = Math.max(0, params.offset || 0)

        let where = '1=1'
        const binds: (string | number)[] = []

        if (params.role !== 'admin') {
            where += ' AND s.distributor_id = ?'
            binds.push(params.distributorId)
        }

        if (params.status) {
            where += ' AND s.status = ?'
            binds.push(params.status.toUpperCase())
        }
        if (params.carrier) {
            where += ' AND s.carrier = ?'
            binds.push(params.carrier.toUpperCase())
        }

        const countBinds = [...binds]

        const sql = `SELECT s.*, o.platform, o.platform_order_id, o.total_amount
                     FROM shipments s
                     LEFT JOIN orders o ON o.id = s.order_id
                     WHERE ${where}
                     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
        binds.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM shipments s WHERE ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...binds).all(),
            this.db.prepare(countSql).bind(...countBinds).first<{ total: number }>(),
        ])

        return { shipments: results, total: countResult?.total || 0 }
    }

    /** Get shipment detail with order + items */
    async getDetail(id: number, distributorId: number, role: string): Promise<any | null> {
        let sql = `SELECT s.*, o.platform, o.platform_order_id, o.total_amount, o.status as order_status
                   FROM shipments s LEFT JOIN orders o ON o.id = s.order_id
                   WHERE s.id = ?`
        const binds: (string | number)[] = [id]

        if (role !== 'admin') {
            sql += ' AND s.distributor_id = ?'
            binds.push(distributorId)
        }

        const shipment = await this.db.prepare(sql).bind(...binds).first()
        if (!shipment) return null

        const { results: items } = await this.db.prepare(
            'SELECT * FROM order_items WHERE order_id = ?'
        ).bind(shipment.order_id as number).all()

        return { ...shipment, items }
    }

    /** Create shipment: validate order → deduct stock → insert shipment → update order status → notify */
    async create(params: {
        orderId: number
        trackingNumber: string
        carrier: string
        estimatedDelivery?: string
        distributorId: number
        role: string
    }): Promise<any> {
        const { orderId, trackingNumber, carrier, estimatedDelivery, distributorId, role } = params

        // Validate carrier
        if (!VALID_CARRIERS.includes(carrier as typeof VALID_CARRIERS[number])) {
            throw new Error(`Invalid carrier. Must be one of: ${VALID_CARRIERS.join(', ')}`)
        }

        // Get order
        let orderSql = 'SELECT * FROM orders WHERE id = ?'
        const orderBinds: (string | number)[] = [orderId]
        if (role !== 'admin') {
            orderSql += ' AND distributor_id = ?'
            orderBinds.push(distributorId)
        }

        const order = await this.db.prepare(orderSql).bind(...orderBinds).first<any>()
        if (!order) throw new Error('Order not found')
        if (order.status !== 'PROCESSING') throw new Error('Only PROCESSING orders can be shipped')

        // Get order items for stock deduction
        const { results: items } = await this.db.prepare(
            'SELECT * FROM order_items WHERE order_id = ?'
        ).bind(orderId).all<{ sku: string; qty: number }>()

        // Build batch: deduct stock + insert shipment + update order + outbound record
        const stmts: D1PreparedStatement[] = []

        for (const item of items) {
            stmts.push(
                this.db.prepare(
                    'UPDATE warehouse_locations SET qty = MAX(0, qty - ?) WHERE sku = ?'
                ).bind(item.qty, item.sku)
            )
        }

        stmts.push(
            this.db.prepare(
                `INSERT INTO shipments (order_id, tracking_number, carrier, estimated_delivery, distributor_id)
                 VALUES (?, ?, ?, ?, ?)`
            ).bind(orderId, trackingNumber, carrier, estimatedDelivery || null, order.distributor_id)
        )

        stmts.push(
            this.db.prepare("UPDATE orders SET status = 'SHIPPED' WHERE id = ?").bind(orderId)
        )

        stmts.push(
            this.db.prepare(
                'INSERT INTO outbound_records (order_id, sku, tracking_number) VALUES (?, ?, ?)'
            ).bind(orderId, 'BATCH', trackingNumber)
        )

        await this.db.batch(stmts)

        // Notify (best effort)
        try {
            await this.notificationCenter.notifyOrderShipped(order.distributor_id, orderId, trackingNumber)
        } catch (e) {
            console.error('[SHIPPING] Notification failed:', e)
        }

        // Return created shipment
        const created = await this.db.prepare(
            'SELECT * FROM shipments WHERE order_id = ? AND tracking_number = ? ORDER BY id DESC LIMIT 1'
        ).bind(orderId, trackingNumber).first()

        // Add initial SHIPPED event (best effort)
        if (created) {
            try {
                await this.trackingService.addEvent(created.id as number, 'SHIPPED', undefined, 'Shipment created')
            } catch (e) {
                console.error('[SHIPPING] Event tracking failed:', e)
            }
        }

        return created
    }

    /** Batch create shipments */
    async batchCreate(items: { order_id: number; tracking_number: string; carrier: string }[], distributorId: number, role: string): Promise<{ success: number; errors: { order_id: number; error: string }[] }> {
        let success = 0
        const errors: { order_id: number; error: string }[] = []

        for (const item of items) {
            try {
                await this.create({
                    orderId: item.order_id,
                    trackingNumber: item.tracking_number,
                    carrier: item.carrier,
                    distributorId,
                    role,
                })
                success++
            } catch (e: any) {
                errors.push({ order_id: item.order_id, error: e.message })
            }
        }

        return { success, errors }
    }

    /** Update shipment status (admin only) */
    async updateStatus(id: number, status: string): Promise<any | null> {
        if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
            throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
        }

        const shipment = await this.db.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first()
        if (!shipment) return null

        await this.db.prepare('UPDATE shipments SET status = ? WHERE id = ?').bind(status, id).run()

        // Add tracking event (best effort)
        try {
            await this.trackingService.addEvent(id, status, undefined, `Status updated to ${status}`)
        } catch (e) {
            console.error('[SHIPPING] Event tracking failed:', e)
        }

        return this.db.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first()
    }
}
