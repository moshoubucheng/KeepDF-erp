import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { CurrencyService } from '../services/currency.service'

const currency = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /currency/rates - List exchange rates */
currency.get('/rates', async (c) => {
    const service = new CurrencyService(c.env.DB)
    const rates = await service.getRates()
    return c.json({ rates })
})

/** GET /currency/convert - Convert currency */
currency.get('/convert', async (c) => {
    const amount = Number(c.req.query('amount'))
    const from = c.req.query('from')
    const to = c.req.query('to')

    if (isNaN(amount) || amount < 0 || !from || !to) {
        return c.json({ error: 'amount, from, and to are required' }, 400)
    }

    const service = new CurrencyService(c.env.DB)
    try {
        const result = await service.convert(amount, from, to)
        return c.json(result)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /currency/rates - Set exchange rate (admin only) */
currency.post('/rates', async (c) => {
    const role = c.get('role')
    if (role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403)
    }

    const body = await c.req.json<{ from: string; to: string; rate: number }>()
    if (!body.from || !body.to || !body.rate) {
        return c.json({ error: 'from, to, and rate are required' }, 400)
    }

    const service = new CurrencyService(c.env.DB)
    try {
        const rate = await service.setRate(body.from, body.to, body.rate, c.get('distributorId'))
        return c.json({ success: true, rate })
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

export { currency }
