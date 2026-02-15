import { api } from '../client'

export interface MessageTemplate {
  id: number
  name: string
  type: string
  subject: string | null
  content: string
  channel: string | null
  distributor_id: number
  created_at: string
  updated_at: string
}

export interface CustomerMessage {
  id: number
  customer_id: number
  template_id: number | null
  type: string
  subject: string | null
  content: string
  channel: string | null
  related_order_id: number | null
  distributor_id: number
  created_at: string
}

export interface CommTrigger {
  id: number
  event_type: string
  template_id: number
  distributor_id: number
  created_at: string
}

interface ListParams {
  offset?: number
  limit?: number
  type?: string
}

export const communicationsApi = {
  listTemplates: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.type) q.set('type', params.type)
    const qs = q.toString()
    return api.get<{ templates: MessageTemplate[]; total: number }>(`/communications/templates${qs ? `?${qs}` : ''}`)
  },

  getTemplate: (id: number) =>
    api.get<{ template: MessageTemplate }>(`/communications/templates/${id}`),

  createTemplate: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; template: MessageTemplate }>('/communications/templates', data),

  updateTemplate: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; template: MessageTemplate }>(`/communications/templates/${id}`, data),

  deleteTemplate: (id: number) =>
    api.delete<{ success: boolean }>(`/communications/templates/${id}`),

  listMessages: (params: ListParams = {}) => {
    const q = new URLSearchParams()
    if (params.offset) q.set('offset', String(params.offset))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.type) q.set('type', params.type)
    const qs = q.toString()
    return api.get<{ messages: CustomerMessage[]; total: number }>(`/communications/messages${qs ? `?${qs}` : ''}`)
  },

  customerMessages: (customerId: number) =>
    api.get<{ messages: CustomerMessage[] }>(`/communications/messages/customer/${customerId}`),

  send: (data: { customer_id: number; type: string; content: string; template_id?: number; subject?: string; channel?: string; related_order_id?: number }) =>
    api.post<{ success: boolean; message: CustomerMessage }>('/communications/send', data),

  listTriggers: () => api.get<{ triggers: CommTrigger[] }>('/communications/triggers'),

  createTrigger: (data: { event_type: string; template_id: number }) =>
    api.post<{ success: boolean; trigger: CommTrigger }>('/communications/triggers', data),

  deleteTrigger: (id: number) =>
    api.delete<{ success: boolean }>(`/communications/triggers/${id}`),
}
