import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { WalletService } from '../services/wallet.service'
import { NotificationService } from '../services/notification.service'

const wallet = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /wallet/balance/:id - 查询余额 */
wallet.get('/balance/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    if (id !== distributorId) {
        return c.json({ error: 'Forbidden: cannot access other distributor data' }, 403)
    }

    const service = new WalletService(c.env.DB)
    const balance = await service.getBalance(id)

    if (!balance) return c.json({ error: 'Distributor not found' }, 404)
    return c.json({ distributorId: id, ...balance })
})

/** POST /wallet/deposit - 充值 */
wallet.post('/deposit', async (c) => {
    const body = await c.req.json<{ distributor_id: number; amount: number }>()

    if (!body.distributor_id || !body.amount || body.amount <= 0) {
        return c.json({ error: 'Invalid request: distributor_id and positive amount required' }, 400)
    }

    const distributorId = c.get('distributorId')
    if (body.distributor_id !== distributorId) {
        return c.json({ error: 'Forbidden: cannot operate on other distributor wallet' }, 403)
    }

    const service = new WalletService(c.env.DB)
    let tx
    try {
        tx = await service.deposit(body.distributor_id, body.amount)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }

    // 充值通知（不影响充值结果）
    try {
        const notification = new NotificationService(c.env.DB)
        const distributor = await c.env.DB.prepare(
            'SELECT name FROM distributors WHERE id = ?'
        ).bind(body.distributor_id).first<{ name: string }>()
        await notification.alertRechargeRequest(
            distributor?.name || `ID:${body.distributor_id}`,
            body.amount,
        )
    } catch (e) {
        console.error('Notification failed:', e)
    }

    return c.json({ status: 'success', transaction: tx })
})

/** POST /wallet/freeze - 冻结（订单创建时） */
wallet.post('/freeze', async (c) => {
    const body = await c.req.json<{ distributor_id: number; amount: number; order_id: string }>()

    const distributorId = c.get('distributorId')
    if (body.distributor_id !== distributorId) {
        return c.json({ error: 'Forbidden: cannot operate on other distributor wallet' }, 403)
    }

    const service = new WalletService(c.env.DB)

    try {
        await service.freeze(body.distributor_id, body.amount, body.order_id)
        return c.json({ status: 'frozen', orderId: body.order_id })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** GET /wallet/transactions/:id - 交易流水 */
wallet.get('/transactions/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const distributorId = c.get('distributorId')

    if (id !== distributorId) {
        return c.json({ error: 'Forbidden: cannot access other distributor data' }, 403)
    }

    const service = new WalletService(c.env.DB)
    const transactions = await service.getTransactions(id)
    return c.json({ distributorId: id, transactions })
})

export { wallet }
