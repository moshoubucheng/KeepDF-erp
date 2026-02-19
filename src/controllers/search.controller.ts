import { Hono } from 'hono'
import type { Bindings, Variables } from '../db/types'
import { SearchService } from '../services/search.service'

const search = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** GET /search?q=&type=&limit= */
search.get('/', async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    const typeParam = c.req.query('type') // 'order', 'product', 'customer' or comma-separated
    const limitParam = c.req.query('limit')

    if (q.length < 2) {
        return c.json({ error: 'Query must be at least 2 characters' }, 400)
    }
    if (q.length > 100) {
        return c.json({ error: 'Query must be at most 100 characters' }, 400)
    }

    const validTypes = ['order', 'product', 'customer'] as const
    let types: ('order' | 'product' | 'customer')[] | undefined
    if (typeParam) {
        types = typeParam.split(',').filter((t): t is typeof validTypes[number] =>
            (validTypes as readonly string[]).includes(t),
        )
        if (types.length === 0) {
            return c.json({ error: 'Invalid type parameter' }, 400)
        }
    }

    const limit = Math.min(Math.max(parseInt(limitParam ?? '5', 10) || 5, 1), 20)

    const distributorId = c.get('distributorId')
    const role = c.get('role')

    const service = new SearchService(c.env.DB)
    const result = await service.search({ query: q, types, distributorId, role, limit })

    return c.json({ success: true, ...result })
})

export { search }
