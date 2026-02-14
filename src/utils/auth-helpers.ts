import type { Order } from '../db/types'

/**
 * 查询订单并验证归属权
 * 消除 controllers 中重复的 order 查询 + 权限检查模式
 */
export async function getAuthorizedOrder(
    db: D1Database,
    orderId: number,
    distributorId: number,
): Promise<{ order: Order } | { error: string; status: 404 | 403 }> {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?')
        .bind(orderId).first<Order>()

    if (!order) {
        return { error: 'Order not found', status: 404 }
    }

    if (order.distributor_id !== distributorId) {
        return { error: 'Forbidden: order does not belong to you', status: 403 }
    }

    return { order }
}
