export class BatchService {
    constructor(private db: D1Database) {}

    // Valid state transitions
    private static STATE_TRANSITIONS: Record<string, string[]> = {
        'PENDING': ['PROCESSING', 'CANCELLED'],
        'PROCESSING': ['SHIPPED', 'CANCELLED'],
        'SHIPPED': ['DELIVERED'],
    }

    async batchOrderStatus(
        orderIds: number[],
        targetStatus: string,
        distributorId: number,
        role: string,
    ): Promise<{ success: number; errors: { id: number; error: string }[] }> {
        const validStatuses = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
        if (!validStatuses.includes(targetStatus)) {
            throw new Error(`Invalid target status: ${targetStatus}. Must be one of: ${validStatuses.join(', ')}`)
        }

        let success = 0
        const errors: { id: number; error: string }[] = []

        for (const id of orderIds) {
            try {
                let sql = 'SELECT * FROM orders WHERE id = ?'
                const params: (string | number)[] = [id]

                if (role !== 'admin') {
                    sql += ' AND distributor_id = ?'
                    params.push(distributorId)
                }

                const order = await this.db.prepare(sql).bind(...params).first<{
                    id: number; status: string; distributor_id: number
                }>()

                if (!order) {
                    errors.push({ id, error: 'Order not found' })
                    continue
                }

                // Check state transition validity
                const allowedTransitions = BatchService.STATE_TRANSITIONS[order.status]
                if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
                    errors.push({ id, error: `Cannot transition from ${order.status} to ${targetStatus}` })
                    continue
                }

                // Build update (parameterized to prevent SQL injection)
                if (targetStatus === 'DELIVERED') {
                    await this.db.prepare(
                        "UPDATE orders SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP WHERE id = ?"
                    ).bind(id).run()
                } else if (targetStatus === 'CANCELLED') {
                    await this.db.prepare(
                        "UPDATE orders SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?"
                    ).bind(id).run()
                } else {
                    await this.db.prepare(
                        'UPDATE orders SET status = ? WHERE id = ?'
                    ).bind(targetStatus, id).run()
                }
                success++
            } catch (e: any) {
                errors.push({ id, error: e.message })
            }
        }

        return { success, errors }
    }

    async batchProductUpdate(
        updates: { id: number; cost_price?: number; name_jp?: string; name_cn?: string }[],
    ): Promise<{ success: number; errors: { id: number; error: string }[] }> {
        let success = 0
        const errors: { id: number; error: string }[] = []

        for (const update of updates) {
            try {
                const product = await this.db.prepare(
                    'SELECT id FROM products WHERE id = ?'
                ).bind(update.id).first()

                if (!product) {
                    errors.push({ id: update.id, error: 'Product not found' })
                    continue
                }

                if (update.cost_price !== undefined && update.cost_price <= 0) {
                    errors.push({ id: update.id, error: 'cost_price must be positive' })
                    continue
                }

                const fields: string[] = []
                const values: (string | number)[] = []

                if (update.cost_price !== undefined) {
                    fields.push('cost_price = ?')
                    values.push(update.cost_price)
                }
                if (update.name_jp !== undefined) {
                    fields.push('name_jp = ?')
                    values.push(update.name_jp)
                }
                if (update.name_cn !== undefined) {
                    fields.push('name_cn = ?')
                    values.push(update.name_cn)
                }

                if (fields.length === 0) {
                    errors.push({ id: update.id, error: 'No fields to update' })
                    continue
                }

                values.push(update.id)
                await this.db.prepare(
                    `UPDATE products SET ${fields.join(', ')} WHERE id = ?`
                ).bind(...values).run()

                success++
            } catch (e: any) {
                errors.push({ id: update.id, error: e.message })
            }
        }

        return { success, errors }
    }

    async batchStockAdjust(
        adjustments: { sku: string; qty: number; reason: string }[],
    ): Promise<{ success: number; errors: { sku: string; error: string }[] }> {
        let success = 0
        const errors: { sku: string; error: string }[] = []

        for (const adj of adjustments) {
            try {
                if (!adj.reason?.trim()) {
                    errors.push({ sku: adj.sku, error: 'Reason is required' })
                    continue
                }

                // Atomic stock adjustment: prevents race conditions
                const updateResult = await this.db.prepare(
                    'UPDATE warehouse_locations SET qty = qty + ? WHERE sku = ? AND (qty + ?) >= 0'
                ).bind(adj.qty, adj.sku, adj.qty).run()

                if (!updateResult.meta.changes) {
                    // Determine if SKU not found or insufficient stock
                    const location = await this.db.prepare(
                        'SELECT qty FROM warehouse_locations WHERE sku = ?'
                    ).bind(adj.sku).first<{ qty: number }>()
                    if (!location) {
                        errors.push({ sku: adj.sku, error: 'SKU not found in warehouse' })
                    } else {
                        errors.push({ sku: adj.sku, error: `Insufficient stock: current=${location.qty}, adjustment=${adj.qty}` })
                    }
                    continue
                }

                // Create inbound record for positive adjustments
                if (adj.qty > 0) {
                    await this.db.prepare(
                        'INSERT INTO inbound_records (sku, expected_qty, actual_qty) VALUES (?, ?, ?)'
                    ).bind(adj.sku, adj.qty, adj.qty).run()
                }

                success++
            } catch (e: any) {
                errors.push({ sku: adj.sku, error: e.message })
            }
        }

        return { success, errors }
    }
}
