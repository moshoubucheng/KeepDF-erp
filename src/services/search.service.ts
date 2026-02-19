import type { SearchResponse, SearchGroupResult, SearchResultItem } from '../db/types'

type SearchType = 'order' | 'product' | 'customer'

interface SearchParams {
    query: string
    types?: SearchType[]
    distributorId: number
    role: 'admin' | 'distributor'
    limit?: number
}

/** Escape LIKE wildcards so user input is treated literally. */
function escapeLike(s: string): string {
    return s.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

const EMPTY_GROUP: SearchGroupResult = { items: [], total: 0 }

export class SearchService {
    constructor(private db: D1Database) {}

    async search(params: SearchParams): Promise<SearchResponse> {
        const { query, distributorId, role, limit = 5 } = params
        const types = params.types ?? ['order', 'product', 'customer']
        const pattern = `%${escapeLike(query)}%`

        const [orders, products, customers] = await Promise.all([
            types.includes('order')
                ? this.searchOrders(pattern, distributorId, role, limit)
                : EMPTY_GROUP,
            types.includes('product')
                ? this.searchProducts(pattern, limit)
                : EMPTY_GROUP,
            types.includes('customer')
                ? this.searchCustomers(pattern, distributorId, role, limit)
                : EMPTY_GROUP,
        ])

        return { orders, products, customers }
    }

    private async searchOrders(
        pattern: string,
        distributorId: number,
        role: string,
        limit: number,
    ): Promise<SearchGroupResult> {
        const isAdmin = role === 'admin'

        // Admin: bind(pattern, pattern, limit) for data, bind(pattern, pattern) for count
        // Distributor: bind(distributorId, pattern, pattern, limit) for data, bind(distributorId, pattern, pattern) for count
        const likeClause = `(o.platform_order_id LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.sku LIKE ? ESCAPE '\\'))`
        const whereClause = isAdmin
            ? likeClause
            : `o.distributor_id = ? AND ${likeClause}`

        const dataSQL = `SELECT o.id, o.platform, o.platform_order_id, o.status, o.total_amount, o.created_at FROM orders o WHERE ${whereClause} ORDER BY o.created_at DESC LIMIT ?`
        const countSQL = `SELECT COUNT(*) as cnt FROM orders o WHERE ${whereClause}`

        const [dataResult, countResult] = await Promise.all([
            isAdmin
                ? this.db.prepare(dataSQL).bind(pattern, pattern, limit).all()
                : this.db.prepare(dataSQL).bind(distributorId, pattern, pattern, limit).all(),
            isAdmin
                ? this.db.prepare(countSQL).bind(pattern, pattern).first<{ cnt: number }>()
                : this.db.prepare(countSQL).bind(distributorId, pattern, pattern).first<{ cnt: number }>(),
        ])

        const items: SearchResultItem[] = (dataResult.results || []).map((row: any) => ({
            type: 'order' as const,
            id: row.id,
            title: row.platform_order_id,
            subtitle: `${row.platform} · ${row.status} · ¥${row.total_amount?.toLocaleString?.() ?? row.total_amount}`,
            meta: {
                platform: row.platform,
                status: row.status,
                total_amount: row.total_amount,
                created_at: row.created_at,
            },
        }))

        return { items, total: countResult?.cnt ?? 0 }
    }

    private async searchProducts(
        pattern: string,
        limit: number,
    ): Promise<SearchGroupResult> {
        const dataSQL = `SELECT id, sku, name_cn, name_jp, cost_price, image_url FROM products WHERE sku LIKE ? ESCAPE '\\' OR name_cn LIKE ? ESCAPE '\\' OR name_jp LIKE ? ESCAPE '\\' ORDER BY sku LIMIT ?`
        const countSQL = `SELECT COUNT(*) as cnt FROM products WHERE sku LIKE ? ESCAPE '\\' OR name_cn LIKE ? ESCAPE '\\' OR name_jp LIKE ? ESCAPE '\\'`

        const [dataResult, countResult] = await Promise.all([
            this.db.prepare(dataSQL).bind(pattern, pattern, pattern, limit).all(),
            this.db.prepare(countSQL).bind(pattern, pattern, pattern).first<{ cnt: number }>(),
        ])

        const items: SearchResultItem[] = (dataResult.results || []).map((row: any) => ({
            type: 'product' as const,
            id: row.id,
            title: row.sku,
            subtitle: row.name_jp || row.name_cn || '',
            meta: {
                name_cn: row.name_cn,
                name_jp: row.name_jp,
                cost_price: row.cost_price,
                image_url: row.image_url,
            },
        }))

        return { items, total: countResult?.cnt ?? 0 }
    }

    private async searchCustomers(
        pattern: string,
        distributorId: number,
        role: string,
        limit: number,
    ): Promise<SearchGroupResult> {
        const isAdmin = role === 'admin'

        const likeClause = `(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR platform_customer_id LIKE ? ESCAPE '\\')`
        const whereClause = isAdmin
            ? likeClause
            : `distributor_id = ? AND ${likeClause}`

        const dataSQL = `SELECT id, name, email, phone, platform, created_at FROM customers WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?`
        const countSQL = `SELECT COUNT(*) as cnt FROM customers WHERE ${whereClause}`

        const [dataResult, countResult] = await Promise.all([
            isAdmin
                ? this.db.prepare(dataSQL).bind(pattern, pattern, pattern, pattern, limit).all()
                : this.db.prepare(dataSQL).bind(distributorId, pattern, pattern, pattern, pattern, limit).all(),
            isAdmin
                ? this.db.prepare(countSQL).bind(pattern, pattern, pattern, pattern).first<{ cnt: number }>()
                : this.db.prepare(countSQL).bind(distributorId, pattern, pattern, pattern, pattern).first<{ cnt: number }>(),
        ])

        const items: SearchResultItem[] = (dataResult.results || []).map((row: any) => ({
            type: 'customer' as const,
            id: row.id,
            title: row.name,
            subtitle: [row.email, row.phone, row.platform].filter(Boolean).join(' · '),
            meta: {
                email: row.email,
                phone: row.phone,
                platform: row.platform,
                created_at: row.created_at,
            },
        }))

        return { items, total: countResult?.cnt ?? 0 }
    }
}
