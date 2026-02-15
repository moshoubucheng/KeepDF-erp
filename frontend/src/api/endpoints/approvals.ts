import { api } from '../client'

export interface ApprovalWorkflow {
  id: number
  name: string
  resource_type: string
  approval_steps: number
  is_active: number
  created_at: string
}

export interface ApprovalRequest {
  id: number
  workflow_id: number
  resource_type: string
  resource_id: number | null
  request_data: Record<string, unknown>
  status: string
  requested_by: number
  approved_by: number | null
  reason: string | null
  created_at: string
  updated_at: string
}

interface ListParams {
  offset?: number
  limit?: number
  status?: string
  resource_type?: string
}

export const approvalsApi = {
  listWorkflows: (resource_type?: string) => {
    const q = resource_type ? `?resource_type=${resource_type}` : ''
    return api.get<{ workflows: ApprovalWorkflow[] }>(`/approvals/workflows${q}`)
  },

  createWorkflow: (data: Record<string, unknown>) =>
    api.post<ApprovalWorkflow>('/approvals/workflows', data),

  updateWorkflow: (id: number, data: Record<string, unknown>) =>
    api.patch<ApprovalWorkflow>(`/approvals/workflows/${id}`, data),

  deleteWorkflow: (id: number) =>
    api.delete<{ success: boolean }>(`/approvals/workflows/${id}`),

  listRequests: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.status) q.set('status', params.status)
    if (params.resource_type) q.set('resource_type', params.resource_type)
    const qs = q.toString()
    return api.get<{ requests: ApprovalRequest[]; total: number }>(`/approvals/requests${qs ? `?${qs}` : ''}`)
  },

  approve: (id: number, reason?: string) =>
    api.post<ApprovalRequest>(`/approvals/requests/${id}/approve`, { reason }),

  reject: (id: number, reason: string) =>
    api.post<ApprovalRequest>(`/approvals/requests/${id}/reject`, { reason }),
}
