export class FinancialReportsService {
    constructor(private db: D1Database) {}

    /** Profit & Loss Statement */
    async getPnL(params: {
        distributorId: number
        role: string
        startDate?: string
        endDate?: string
    }): Promise<any> {
        const start = params.startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const end = params.endDate || new Date().toISOString().slice(0, 10)

        let distFilter = ''
        const baseParams: (string | number)[] = [start, end + ' 23:59:59']

        if (params.role !== 'admin') {
            distFilter = ' AND o.distributor_id = ?'
            baseParams.push(params.distributorId)
        }

        // Revenue from DELIVERED orders
        const revenue = await this.db.prepare(
            `SELECT COALESCE(SUM(o.total_amount), 0) as total_revenue,
                    COALESCE(SUM(o.tax_total), 0) as total_tax,
                    COUNT(*) as order_count
             FROM orders o
             WHERE o.status = 'DELIVERED'
               AND o.delivered_at >= ? AND o.delivered_at <= ?${distFilter}`
        ).bind(...baseParams).first<any>()

        // COGS (cost of goods sold)
        const cogsParams: (string | number)[] = [start, end + ' 23:59:59']
        if (params.role !== 'admin') cogsParams.push(params.distributorId)

        const cogs = await this.db.prepare(
            `SELECT COALESCE(SUM(oi.qty * p.cost_price), 0) as total_cogs
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             LEFT JOIN products p ON p.sku = oi.sku
             WHERE o.status = 'DELIVERED'
               AND o.delivered_at >= ? AND o.delivered_at <= ?${distFilter}`
        ).bind(...cogsParams).first<any>()

        // Commission settled
        const commParams: (string | number)[] = [start, end + ' 23:59:59']
        let commDistFilter = ''
        if (params.role !== 'admin') {
            commDistFilter = ' AND distributor_id = ?'
            commParams.push(params.distributorId)
        }

        const commission = await this.db.prepare(
            `SELECT COALESCE(SUM(commission_amount), 0) as total_commission
             FROM commission_settlements
             WHERE status = 'SETTLED'
               AND settled_at >= ? AND settled_at <= ?${commDistFilter}`
        ).bind(...commParams).first<any>()

        // Refunds
        const refundParams: (string | number)[] = [start, end + ' 23:59:59']
        let refundDistFilter = ''
        if (params.role !== 'admin') {
            refundDistFilter = ' AND distributor_id = ?'
            refundParams.push(params.distributorId)
        }

        const refunds = await this.db.prepare(
            `SELECT COALESCE(SUM(refund_amount), 0) as total_refunds,
                    COUNT(*) as refund_count
             FROM returns
             WHERE status = 'REFUNDED'
               AND updated_at >= ? AND updated_at <= ?${refundDistFilter}`
        ).bind(...refundParams).first<any>()

        const totalRevenue = revenue?.total_revenue || 0
        const totalCOGS = cogs?.total_cogs || 0
        const totalCommission = commission?.total_commission || 0
        const totalRefunds = refunds?.total_refunds || 0
        const grossProfit = totalRevenue - totalCOGS
        const netProfit = grossProfit - totalCommission - totalRefunds

        return {
            period: { start, end },
            revenue: {
                total: totalRevenue,
                tax: revenue?.total_tax || 0,
                orders: revenue?.order_count || 0,
            },
            cogs: totalCOGS,
            gross_profit: grossProfit,
            gross_margin: totalRevenue > 0 ? Math.round(grossProfit * 1000 / totalRevenue) / 10 : 0,
            expenses: {
                commission: totalCommission,
                refunds: totalRefunds,
            },
            net_profit: netProfit,
            net_margin: totalRevenue > 0 ? Math.round(netProfit * 1000 / totalRevenue) / 10 : 0,
        }
    }

    /** Tax Summary */
    async getTaxSummary(params: {
        distributorId: number
        role: string
        startDate?: string
        endDate?: string
    }): Promise<any> {
        const start = params.startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const end = params.endDate || new Date().toISOString().slice(0, 10)

        let distFilter = ''
        const baseParams: (string | number)[] = [start, end + ' 23:59:59']

        if (params.role !== 'admin') {
            distFilter = ' AND o.distributor_id = ?'
            baseParams.push(params.distributorId)
        }

        const { results } = await this.db.prepare(
            `SELECT oi.tax_rate,
                    COUNT(DISTINCT o.id) as order_count,
                    SUM(oi.qty * oi.unit_price) as taxable_amount,
                    SUM(oi.qty * oi.unit_price * oi.tax_rate) as tax_amount
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE o.status = 'DELIVERED'
               AND o.delivered_at >= ? AND o.delivered_at <= ?${distFilter}
             GROUP BY oi.tax_rate
             ORDER BY oi.tax_rate`
        ).bind(...baseParams).all()

        const totalTax = results.reduce((sum: number, r: any) => sum + (r.tax_amount || 0), 0)
        const totalTaxable = results.reduce((sum: number, r: any) => sum + (r.taxable_amount || 0), 0)

        return {
            period: { start, end },
            breakdown: results.map((r: any) => ({
                tax_rate: r.tax_rate,
                rate_label: r.tax_rate === 0.08 ? 'Reduced (8%)' : r.tax_rate === 0.10 ? 'Standard (10%)' : `Custom (${(r.tax_rate * 100).toFixed(0)}%)`,
                order_count: r.order_count,
                taxable_amount: Math.round(r.taxable_amount),
                tax_amount: Math.round(r.tax_amount),
            })),
            total_taxable: Math.round(totalTaxable),
            total_tax: Math.round(totalTax),
        }
    }

    /** Wallet Reconciliation */
    async getReconciliation(params: {
        distributorId: number
        role: string
        startDate?: string
        endDate?: string
    }): Promise<any> {
        const start = params.startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const end = params.endDate || new Date().toISOString().slice(0, 10)

        let distFilter = ''
        const baseParams: (string | number)[] = [start, end + ' 23:59:59']

        if (params.role !== 'admin') {
            distFilter = ' AND wt.distributor_id = ?'
            baseParams.push(params.distributorId)
        }

        const { results } = await this.db.prepare(
            `SELECT wt.type,
                    COUNT(*) as tx_count,
                    SUM(wt.amount) as total_amount
             FROM wallet_transactions wt
             WHERE wt.created_at >= ? AND wt.created_at <= ?${distFilter}
             GROUP BY wt.type
             ORDER BY wt.type`
        ).bind(...baseParams).all()

        // Current balances
        let balSql = 'SELECT SUM(balance) as total_balance, SUM(frozen_balance) as total_frozen FROM distributors'
        const balParams: (string | number)[] = []

        if (params.role !== 'admin') {
            balSql += ' WHERE id = ?'
            balParams.push(params.distributorId)
        }

        const balances = await this.db.prepare(balSql).bind(...balParams).first<any>()

        return {
            period: { start, end },
            transactions: results.map((r: any) => ({
                type: r.type,
                count: r.tx_count,
                total: Math.round(r.total_amount),
            })),
            current_balance: Math.round(balances?.total_balance || 0),
            current_frozen: Math.round(balances?.total_frozen || 0),
        }
    }

    /** Balance Sheet */
    async getBalanceSheet(params: {
        distributorId: number
        role: string
    }): Promise<any> {
        let distFilter = ''
        const distParams: (string | number)[] = []

        if (params.role !== 'admin') {
            distFilter = ' WHERE id = ?'
            distParams.push(params.distributorId)
        }

        // Assets: cash balance + frozen balance + inventory value
        const balances = await this.db.prepare(
            `SELECT SUM(balance) as total_balance, SUM(frozen_balance) as total_frozen FROM distributors${distFilter}`
        ).bind(...distParams).first<any>()

        // Inventory is a platform-level asset (warehouse_locations has no distributor_id),
        // so only admin sees inventory values; non-admin gets 0.
        let inventory: { inventory_value: number; total_units: number } = { inventory_value: 0, total_units: 0 }
        if (params.role === 'admin') {
            const inv = await this.db.prepare(
                `SELECT SUM(w.qty * p.cost_price) as inventory_value, SUM(w.qty) as total_units
                 FROM warehouse_locations w
                 LEFT JOIN products p ON p.sku = w.sku`
            ).first<any>()
            inventory = { inventory_value: inv?.inventory_value || 0, total_units: inv?.total_units || 0 }
        }

        // Liabilities: pending refunds
        let refundFilter = ''
        const refundParams: (string | number)[] = []
        if (params.role !== 'admin') {
            refundFilter = " AND distributor_id = ?"
            refundParams.push(params.distributorId)
        }

        const pendingRefunds = await this.db.prepare(
            `SELECT COALESCE(SUM(refund_amount), 0) as total
             FROM returns
             WHERE status IN ('REQUESTED','APPROVED','RECEIVED')${refundFilter}`
        ).bind(...refundParams).first<any>()

        // Pending commissions
        let commFilter = ''
        const commParams: (string | number)[] = []
        if (params.role !== 'admin') {
            commFilter = " AND distributor_id = ?"
            commParams.push(params.distributorId)
        }

        const pendingComm = await this.db.prepare(
            `SELECT COALESCE(SUM(commission_amount), 0) as total
             FROM commission_settlements
             WHERE status = 'PENDING'${commFilter}`
        ).bind(...commParams).first<any>()

        const cashBalance = Math.round(balances?.total_balance || 0)
        const frozenBalance = Math.round(balances?.total_frozen || 0)
        const inventoryValue = Math.round(inventory?.inventory_value || 0)
        const totalAssets = cashBalance + frozenBalance + inventoryValue

        const pendingRefundTotal = Math.round(pendingRefunds?.total || 0)
        const pendingCommTotal = Math.round(pendingComm?.total || 0)
        const totalLiabilities = pendingRefundTotal + pendingCommTotal

        return {
            as_of: new Date().toISOString().slice(0, 10),
            assets: {
                cash: cashBalance,
                frozen: frozenBalance,
                inventory: inventoryValue,
                inventory_units: inventory?.total_units || 0,
                total: totalAssets,
            },
            liabilities: {
                pending_refunds: pendingRefundTotal,
                pending_commissions: pendingCommTotal,
                total: totalLiabilities,
            },
            equity: totalAssets - totalLiabilities,
        }
    }
}
