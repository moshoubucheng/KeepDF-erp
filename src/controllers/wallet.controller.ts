import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { WalletService } from '../services/wallet.service'
import { NotificationService } from '../services/notification.service'
import { AuditService } from '../services/audit.service'

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

    if (!body.distributor_id || !body.amount || body.amount <= 0 || body.amount > 10000000) {
        return c.json({ error: 'Invalid request: distributor_id and positive amount required (max 10,000,000)' }, 400)
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
        const knownErrors = ['Distributor not found', 'Insufficient balance']
        return c.json({ error: knownErrors.includes(e.message) ? e.message : 'Deposit failed' }, 400)
    }

    // 充値通知（不影响充值结果）
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

    const audit = new AuditService(c.env.DB)
    audit.log({
        distributorId: body.distributor_id,
        action: 'DEPOSIT',
        resourceType: 'wallet',
        resourceId: String(body.distributor_id),
        details: `amount: ${body.amount}`,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
    })

    return c.json({ status: 'success', transaction: tx })
})

/** POST /wallet/freeze - 冻结（订单创建时） */
wallet.post('/freeze', async (c) => {
    const body = await c.req.json<{ distributor_id: number; amount: number; order_id: string }>()

    if (!body.distributor_id || !body.amount || body.amount <= 0 || !body.order_id) {
        return c.json({ error: 'Invalid request: distributor_id, positive amount, and order_id required' }, 400)
    }

    const distributorId = c.get('distributorId')
    if (body.distributor_id !== distributorId) {
        return c.json({ error: 'Forbidden: cannot operate on other distributor wallet' }, 403)
    }

    const service = new WalletService(c.env.DB)

    try {
        await service.freeze(body.distributor_id, body.amount, body.order_id)
        const audit = new AuditService(c.env.DB)
        audit.log({
            distributorId: body.distributor_id,
            action: 'FREEZE',
            resourceType: 'wallet',
            resourceId: String(body.distributor_id),
            details: `amount: ${body.amount}, order: ${body.order_id}`,
            ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        })

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
