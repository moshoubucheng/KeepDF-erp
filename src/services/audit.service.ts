import { toCSV, csvResponse } from '../utils/csv'

export type AuditAction =
    | 'LOGIN'
    | 'LOGIN_PASSWORD'
    | 'CREATE_ORDER'
    | 'UPDATE_ORDER'
    | 'SHIP_ORDER'
    | 'DELIVER_ORDER'
    | 'CANCEL_ORDER'
    | 'GENERATE_INVOICE'
    | 'GENERATE_PDF'
    | 'DEPOSIT'
    | 'FREEZE'
    | 'DEDUCT'
    | 'REFUND'
    | 'CREATE_DISTRIBUTOR'
    | 'UPDATE_DISTRIBUTOR'
    | 'RESET_TOKEN'
    | 'SYNC_PLATFORM'
    | 'EXPORT_CSV'
    | 'UPDATE_PRODUCT'
    | 'DELETE_PRODUCT'
    | 'CHANGE_PASSWORD'
    | 'ENABLE_2FA'
    | 'DISABLE_2FA'
    | 'CREATE_SHIPMENT'
    | 'BATCH_SHIPMENT'
    | 'UPDATE_SHIPMENT_STATUS'
    | 'CREATE_CUSTOMER'
    | 'UPDATE_CUSTOMER'
    | 'IMPORT_CSV'
    | 'BATCH_UPDATE'
    | 'RESET_PASSWORD'
    | 'UPDATE_CONFIG'

export type ResourceType =
    | 'order'
    | 'invoice'
    | 'wallet'
    | 'distributor'
    | 'platform_sync'
    | 'product'
    | 'shipment'
    | 'customer'
    | 'import'
    | 'notification'
    | 'settings'

export interface AuditLogParams {
    distributorId?: number | null
    action: AuditAction
    resourceType: ResourceType
    resourceId?: string | null
    details?: string | null
    ipAddress?: string | null
}

export interface AuditQueryFilters {
    distributorId?: number
    action?: string
    resourceType?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
}

export class AuditService {
    constructor(private db: D1Database) {}

    /** Fire-and-forget audit log — never throws, never blocks */
    async log(params: AuditLogParams): Promise<void> {
        try {
            await this.db.prepare(
                'INSERT INTO audit_logs (distributor_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(
                params.distributorId ?? null,
                params.action,
                params.resourceType,
                params.resourceId ?? null,
                params.details ?? null,
                params.ipAddress ?? null,
            ).run()
        } catch (e) {
            console.error('[AUDIT] Failed to log:', e)
        }
    }

    /** Query audit logs with filters and pagination */
    async query(filters: AuditQueryFilters): Promise<{ logs: any[]; total: number }> {
        const limit = Math.min(filters.limit || 50, 200)
        const offset = filters.offset || 0

        let where = 'WHERE 1=1'
        const params: (string | number)[] = []

        if (filters.distributorId) {
            where += ' AND distributor_id = ?'
            params.push(filters.distributorId)
        }
        if (filters.action) {
            where += ' AND action = ?'
            params.push(filters.action)
        }
        if (filters.resourceType) {
            where += ' AND resource_type = ?'
            params.push(filters.resourceType)
        }
        if (filters.startDate) {
            where += ' AND created_at >= ?'
            params.push(filters.startDate)
        }
        if (filters.endDate) {
            where += ' AND created_at <= ?'
            params.push(filters.endDate)
        }

        const countParams = [...params]

        const sql = `SELECT a.*, d.name as distributor_name FROM audit_logs a LEFT JOIN distributors d ON d.id = a.distributor_id ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const countSql = `SELECT COUNT(*) as total FROM audit_logs ${where}`

        const [{ results }, countResult] = await Promise.all([
            this.db.prepare(sql).bind(...params).all(),
            this.db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
        ])

        return { logs: results, total: countResult?.total || 0 }
    }

    /** Export audit logs as CSV */
    async exportCSV(filters: AuditQueryFilters): Promise<string> {
        // Override limit for export
        const exportFilters = { ...filters, limit: 5000, offset: 0 }
        const { logs } = await this.query(exportFilters)

        return toCSV(logs as Record<string, unknown>[], [
            { key: 'id', header: 'ID' },
            { key: 'distributor_name', header: '\u5B9F\u884C\u8005' },       // 実行者
            { key: 'action', header: '\u30A2\u30AF\u30B7\u30E7\u30F3' },     // アクション
            { key: 'resource_type', header: '\u30EA\u30BD\u30FC\u30B9' },     // リソース
            { key: 'resource_id', header: '\u30EA\u30BD\u30FC\u30B9ID' },     // リソースID
            { key: 'details', header: '\u8A73\u7D30' },                       // 詳細
            { key: 'ip_address', header: 'IP' },
            { key: 'created_at', header: '\u65E5\u6642' },                    // 日時
        ])
    }
}
