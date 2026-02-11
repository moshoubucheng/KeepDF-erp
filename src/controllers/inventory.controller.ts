import { Hono } from 'hono'
import type { Bindings, Product } from '../db/types'

const inventory = new Hono<{ Bindings: Bindings }>()

/** GET /inventory - 商品库存列表 */
inventory.get('/', async (c) => {
    const { results } = await c.env.DB.prepare(
        `SELECT p.id, p.sku, p.name_jp, p.name_cn, p.cost_price, p.tax_category,
            COALESCE(SUM(wl.qty), 0) as total_stock
     FROM products p
     LEFT JOIN warehouse_locations wl ON wl.sku = p.sku
     GROUP BY p.id
     ORDER BY p.sku`
    ).all()

    return c.json({ products: results })
})

/** GET /inventory/:sku - 单个SKU库存及库位 */
inventory.get('/:sku', async (c) => {
    const sku = c.req.param('sku')

    const product = await c.env.DB.prepare('SELECT * FROM products WHERE sku = ?')
        .bind(sku).first<Product>()

    if (!product) return c.json({ error: 'SKU not found' }, 404)

    const { results: locations } = await c.env.DB.prepare(
        'SELECT code, qty FROM warehouse_locations WHERE sku = ?'
    ).bind(sku).all()

    const { results: mappings } = await c.env.DB.prepare(
        'SELECT platform, platform_sku FROM platform_mappings WHERE local_sku = ?'
    ).bind(sku).all()

    return c.json({ product, locations, platformMappings: mappings })
})

/** POST /inventory/products - 新增商品 */
inventory.post('/products', async (c) => {
    const body = await c.req.json<{
        sku: string; name_cn?: string; name_jp?: string;
        cost_price: number; tax_category?: string
    }>()

    try {
        await c.env.DB.prepare(
            'INSERT INTO products (sku, name_cn, name_jp, cost_price, tax_category) VALUES (?, ?, ?, ?, ?)'
        ).bind(body.sku, body.name_cn || null, body.name_jp || null, body.cost_price, body.tax_category || 'standard').run()

        return c.json({ status: 'created', sku: body.sku }, 201)
    } catch (e: any) {
        return c.json({ error: e.message }, 400)
    }
})

/** POST /inventory/inbound - 入库记录 */
inventory.post('/inbound', async (c) => {
    const body = await c.req.json<{
        sku: string; location_code: string;
        expected_qty: number; actual_qty: number
    }>()

    const batch = [
        c.env.DB.prepare(
            'INSERT INTO inbound_records (sku, expected_qty, actual_qty) VALUES (?, ?, ?)'
        ).bind(body.sku, body.expected_qty, body.actual_qty),
        c.env.DB.prepare(
            `INSERT INTO warehouse_locations (code, sku, qty) VALUES (?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET qty = qty + ?`
        ).bind(body.location_code, body.sku, body.actual_qty, body.actual_qty),
    ]

    await c.env.DB.batch(batch)

    // 入库数量异常告警
    if (body.actual_qty !== body.expected_qty) {
        console.warn(`Inbound mismatch: ${body.sku} expected ${body.expected_qty}, actual ${body.actual_qty}`)
    }

    return c.json({ status: 'inbound_recorded', sku: body.sku, actual: body.actual_qty })
})

export { inventory }
