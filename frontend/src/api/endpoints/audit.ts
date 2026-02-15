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
}
