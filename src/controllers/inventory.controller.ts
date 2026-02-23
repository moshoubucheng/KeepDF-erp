import { Hono } from 'hono'
import type { Bindings, Variables, Product, ProductVariant } from '../db/types'
import { NotificationService } from '../services/notification.service'
import { AuditService } from '../services/audit.service'
import { adminOnly } from '../middleware/admin'

const inventory = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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

/** GET /inventory/barcode-lookup/:code - バーコード/SKU検索 */
inventory.get('/barcode-lookup/:code', async (c) => {
    const code = c.req.param('code')

    if (!code || code.trim().length === 0) {
        return c.json({ error: 'Code is required' }, 400)
    }

    // 1. Try SKU lookup
    let product = await c.env.DB.prepare('SELECT * FROM products WHERE sku = ?')
        .bind(code).first<Product>()

    // 2. If not found, try barcode lookup
    if (!product) {
        product = await c.env.DB.prepare('SELECT * FROM products WHERE barcode = ?')
            .bind(code).first<Product>()
    }

    if (!product) {
        return c.json({ error: 'Product not found' }, 404)
    }

    const { results: locations } = await c.env.DB.prepare(
        'SELECT code, qty FROM warehouse_locations WHERE sku = ?'
    ).bind(product.sku).all()

    const totalStock = locations.reduce((sum, loc: any) => sum + (loc.qty || 0), 0)

    return c.json({ product, locations, totalStock })
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

/** POST /inventory/products - 新増商品 */
inventory.post('/products', async (c) => {
    const body = await c.req.json<{
        sku: string; name_cn?: string; name_jp?: string;
        cost_price: number; tax_category?: string
    }>()

    if (!body.sku || typeof body.sku !== 'string' || body.sku.trim().length === 0 || body.sku.length > 50) {
        return c.json({ error: 'sku is required (1-50 characters)' }, 400)
    }
    if (typeof body.cost_price !== 'number' || body.cost_price <= 0 || body.cost_price > 100000000) {
        return c.json({ error: 'cost_price must be positive (max 100,000,000)' }, 400)
    }

    try {
        await c.env.DB.prepare(
            'INSERT INTO products (sku, name_cn, name_jp, cost_price, tax_category) VALUES (?, ?, ?, ?, ?)'
        ).bind(body.sku, body.name_cn || null, body.name_jp || null, body.cost_price, body.tax_category || 'standard').run()

        return c.json({ status: 'created', sku: body.sku }, 201)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        if (message.includes('UNIQUE constraint')) {
            return c.json({ error: 'SKU already exists' }, 409)
        }
        return c.json({ error: 'Failed to create product' }, 400)
    }
})

/** POST /inventory/inbound - 入庫記録 */
inventory.post('/inbound', async (c) => {
    const body = await c.req.json<{
        sku: string; location_code: string;
        expected_qty: number; actual_qty: number
    }>()

    if (!body.sku || typeof body.sku !== 'string') {
        return c.json({ error: 'sku is required' }, 400)
    }
    if (!body.location_code || typeof body.location_code !== 'string') {
        return c.json({ error: 'location_code is required' }, 400)
    }
    if (typeof body.expected_qty !== 'number' || body.expected_qty < 0 || body.expected_qty > 1000000) {
        return c.json({ error: 'expected_qty must be 0-1,000,000' }, 400)
    }
    if (typeof body.actual_qty !== 'number' || body.actual_qty < 0 || body.actual_qty > 1000000) {
        return c.json({ error: 'actual_qty must be 0-1,000,000' }, 400)
    }

    // Validate product exists
    const product = await c.env.DB.prepare('SELECT id FROM products WHERE sku = ?').bind(body.sku).first()
    if (!product) {
        return c.json({ error: `Product not found: ${body.sku}` }, 404)
    }

    // Check if location already holds a different SKU
    const existingLocation = await c.env.DB.prepare(
        'SELECT sku FROM warehouse_locations WHERE code = ?'
    ).bind(body.location_code).first<{ sku: string }>()
    if (existingLocation && existingLocation.sku !== body.sku) {
        return c.json({ error: `Location ${body.location_code} already holds SKU ${existingLocation.sku}` }, 409)
    }

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

    // 入库数量异常告警（不影响入库结果）
    if (body.actual_qty !== body.expected_qty) {
        try {
            const notification = new NotificationService(c.env.DB)
            await notification.send({
                type: 'WARNING',
                channel: 'SLACK',
                message: `入庫数量不一致: ${body.sku} 予定 ${body.expected_qty} 件 / 実際 ${body.actual_qty} 件`,
            })
        } catch (e) {
            console.error('Notification failed:', e)
        }
    }

    return c.json({ status: 'inbound_recorded', sku: body.sku, actual: body.actual_qty })
})

/** PUT /products/:id - 更新商品 (admin only) */
inventory.put('/products/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()

    // Validate
    if (body.name_jp !== undefined && (typeof body.name_jp !== 'string' || body.name_jp.length === 0 || body.name_jp.length > 200)) {
        return c.json({ error: 'name_jp must be 1-200 characters' }, 400)
    }
    if (body.name_cn !== undefined && (typeof body.name_cn !== 'string' || body.name_cn.length === 0 || body.name_cn.length > 200)) {
        return c.json({ error: 'name_cn must be 1-200 characters' }, 400)
    }
    if (body.cost_price !== undefined && (typeof body.cost_price !== 'number' || body.cost_price <= 0)) {
        return c.json({ error: 'cost_price must be > 0' }, 400)
    }
    if (body.tax_category !== undefined && !['standard', 'reduced'].includes(body.tax_category)) {
        return c.json({ error: 'tax_category must be standard or reduced' }, 400)
    }

    // Check product exists
    const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Product>()
    if (!existing) return c.json({ error: 'Product not found' }, 404)

    // Build update
    const updates: string[] = []
    const params: any[] = []
    for (const [key, val] of Object.entries(body)) {
        if (['name_cn', 'name_jp', 'cost_price', 'tax_category', 'image_url', 'barcode'].includes(key)) {
            updates.push(`${key} = ?`)
            params.push(val)
        }
    }
    if (updates.length === 0) return c.json({ error: 'No valid fields to update' }, 400)

    params.push(id)
    await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()

    const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Product>()

    const audit = new AuditService(c.env.DB)
    audit.log({ distributorId: c.get('distributorId'), action: 'UPDATE_PRODUCT', resourceType: 'product', resourceId: String(id), ipAddress: c.req.header('cf-connecting-ip') || 'unknown' })

    return c.json({ product: updated })
})

/** DELETE /products/:id - 削除商品 (admin only) */
inventory.delete('/products/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))

    // Check product exists
    const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Product>()
    if (!existing) return c.json({ error: 'Product not found' }, 404)

    // Check for active orders referencing this product's SKU
    const activeOrders = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.sku = ? AND o.status IN ('PENDING', 'PROCESSING', 'SHIPPED')`
    ).bind(existing.sku).first<{ cnt: number }>()

    if (activeOrders && activeOrders.cnt > 0) {
        return c.json({ error: 'Cannot delete product with active orders' }, 409)
    }

    // Delete related records and the product
    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id),
        c.env.DB.prepare('DELETE FROM warehouse_locations WHERE sku = ?').bind(existing.sku),
        c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id),
    ])

    const audit = new AuditService(c.env.DB)
    audit.log({ distributorId: c.get('distributorId'), action: 'DELETE_PRODUCT', resourceType: 'product', resourceId: String(id), ipAddress: c.req.header('cf-connecting-ip') || 'unknown' })

    return c.json({ status: 'deleted', id })
})

/** POST /products/:id/image - 画像アップロード (admin only) */
inventory.post('/products/:id/image', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))

    // Check product exists
    const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<Product>()
    if (!existing) return c.json({ error: 'Product not found' }, 404)

    const body = await c.req.parseBody()
    const file = body['image'] || body['file']
    if (!file || typeof file === 'string') {
        return c.json({ error: 'No image file provided' }, 400)
    }

    // Check size <= 5MB
    const blob = file as unknown as File
    if (blob.size > 5 * 1024 * 1024) {
        return c.json({ error: 'File size must be <= 5MB' }, 400)
    }

    const ext = (blob.name?.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '')
    const r2Key = `products/${id}/${crypto.randomUUID()}.${ext}`

    await c.env.BUCKET.put(r2Key, await blob.arrayBuffer())
    await c.env.DB.prepare('UPDATE products SET image_url = ? WHERE id = ?').bind(r2Key, id).run()

    return c.json({ image_url: r2Key }, 201)
})

/** GET /products/:id/image - 画像取得 */
inventory.get('/products/:id/image', async (c) => {
    const id = Number(c.req.param('id'))

    const product = await c.env.DB.prepare('SELECT image_url FROM products WHERE id = ?').bind(id).first<{ image_url: string | null }>()
    if (!product || !product.image_url) return c.json({ error: 'No image found' }, 404)

    const object = await c.env.BUCKET.get(product.image_url)
    if (!object) return c.json({ error: 'Image not found in storage' }, 404)

    // Detect content type from extension
    const ext = product.image_url.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
    }
    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    return new Response(object.body as ReadableStream, {
        headers: { 'Content-Type': contentType },
    })
})

/** GET /products/:id/variants - バリアント一覧 */
inventory.get('/products/:id/variants', async (c) => {
    const productId = Number(c.req.param('id'))

    const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first()
    if (!product) return c.json({ error: 'Product not found' }, 404)

    const { results } = await c.env.DB.prepare(
        'SELECT * FROM product_variants WHERE product_id = ?'
    ).bind(productId).all()

    return c.json({ variants: results })
})

/** POST /products/:id/variants - バリアント追加 (admin only) */
inventory.post('/products/:id/variants', adminOnly, async (c) => {
    const productId = Number(c.req.param('id'))

    const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first()
    if (!product) return c.json({ error: 'Product not found' }, 404)

    const body = await c.req.json<{ sku?: string; color?: string; size?: string; stock_qty?: number }>()

    if (!body.sku || typeof body.sku !== 'string' || body.sku.length === 0) {
        return c.json({ error: 'sku is required' }, 400)
    }
    if (body.stock_qty !== undefined && (typeof body.stock_qty !== 'number' || body.stock_qty < 0)) {
        return c.json({ error: 'stock_qty must be >= 0' }, 400)
    }

    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO product_variants (product_id, sku, color, size, stock_qty) VALUES (?, ?, ?, ?, ?)'
        ).bind(productId, body.sku, body.color || null, body.size || null, body.stock_qty ?? 0).run()

        const variant = await c.env.DB.prepare('SELECT * FROM product_variants WHERE id = ?').bind(meta.last_row_id).first()
        return c.json({ variant }, 201)
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        if (message.includes('UNIQUE constraint')) {
            return c.json({ error: 'Variant SKU already exists' }, 409)
        }
        return c.json({ error: 'Failed to create variant' }, 400)
    }
})

/** PUT /variants/:id - バリアント更新 (admin only) */
inventory.put('/variants/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))

    const existing = await c.env.DB.prepare('SELECT * FROM product_variants WHERE id = ?').bind(id).first<ProductVariant>()
    if (!existing) return c.json({ error: 'Variant not found' }, 404)

    const body = await c.req.json()

    if (body.stock_qty !== undefined && (typeof body.stock_qty !== 'number' || body.stock_qty < 0)) {
        return c.json({ error: 'stock_qty must be >= 0' }, 400)
    }

    const updates: string[] = []
    const params: any[] = []
    for (const [key, val] of Object.entries(body)) {
        if (['color', 'size', 'sku', 'stock_qty'].includes(key)) {
            updates.push(`${key} = ?`)
            params.push(val)
        }
    }
    if (updates.length === 0) return c.json({ error: 'No valid fields to update' }, 400)

    params.push(id)
    await c.env.DB.prepare(`UPDATE product_variants SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()

    const updated = await c.env.DB.prepare('SELECT * FROM product_variants WHERE id = ?').bind(id).first()
    return c.json({ variant: updated })
})

/** DELETE /variants/:id - バリアント削除 (admin only) */
inventory.delete('/variants/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'))

    const existing = await c.env.DB.prepare('SELECT * FROM product_variants WHERE id = ?').bind(id).first()
    if (!existing) return c.json({ error: 'Variant not found' }, 404)

    await c.env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(id).run()

    return c.json({ status: 'deleted', id })
})

export { inventory }
