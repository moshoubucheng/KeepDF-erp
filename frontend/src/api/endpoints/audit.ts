import { api } from '../client'

export interface AuditLog {
  id: number
  distributor_id: number | null
  action: string
  resource_type: string
  resource_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}

export interface RestorableLog extends AuditLog {
  snapshot_id: number
  before_data: string
  after_data: string
  distributor_name: string
}

export interface Snapshot {
  id: number
  audit_log_id: number
  before_data: string
  after_data: string
}

interface AuditLogsParams {
  offset?: number
  limit?: number
  distributor_id?: number
  action?: string
  resource_type?: string
  start_date?: string
  end_date?: string
}

export const auditApi = {
  list: (params: AuditLogsParams = {}) => {
    const query = new URLSearchParams()
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.distributor_id) query.set('distributor_id', String(params.distributor_id))
    if (params.action) query.set('action', params.action)
    if (params.resource_type) query.set('resource_type', params.resource_type)
    if (params.start_date) query.set('start_date', params.start_date)
    if (params.end_date) query.set('end_date', params.end_date)
    const qs = query.toString()
    return api.get<{
      logs: AuditLog[]
      total: number
      count: number
      hasMore: boolean
    }>(`/audit-logs${qs ? `?${qs}` : ''}`)
  },

  listRestorable: (params: { offset?: number; limit?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return api.get<{ logs: RestorableLog[]; total: number }>(
      `/audit-logs/restorable${qs ? `?${qs}` : ''}`,
    )
  },

  getSnapshot: (logId: number) =>
    api.get<{ snapshot: Snapshot }>(`/audit-logs/snapshots/${logId}`),

  restore: (logId: number) =>
    api.post<{ success: boolean; restored: { table: string; id: number } }>(
      `/audit-logs/restore/${logId}`,
    ),
}
