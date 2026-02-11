import { Hono } from 'hono'
import type { Bindings } from '../db/types'
import { WalletService } from '../services/wallet.service'

const wallet = new Hono<{ Bindings: Bindings }>()

/** GET /wallet/balance/:id - 查询余额 */
wallet.get('/balance/:id', async (c) => {
    const id = Number(c.req.param('id'))
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

    const service = new WalletService(c.env.DB)
    try {
        const tx = await service.deposit(body.distributor_id, body.amount)
        return c.json({ status: 'success', transaction: tx })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /wallet/freeze - 冻结（订单创建时） */
wallet.post('/freeze', async (c) => {
    const body = await c.req.json<{ distributor_id: number; amount: number; order_id: string }>()
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
    const service = new WalletService(c.env.DB)
    const transactions = await service.getTransactions(id)
    return c.json({ distributorId: id, transactions })
})

export { wallet }
