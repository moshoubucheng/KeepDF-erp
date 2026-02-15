import { api } from '../client'

export interface Segment {
  id: number
  name: string
  criteria: Record<string, unknown>
  customer_count: number
  distributor_id: number
  created_at: string
  updated_at: string
}

export interface RfmCustomer {
  customer_id: number
  name: string
  recency: number
  frequency: number
  monetary: number
  rfm_score: string
}

export const customerSegmentsApi = {
  rfm: () => api.get<{ customers: RfmCustomer[]; total: number }>('/customer-segments/rfm'),

  rfmDistribution: () =>
    api.get<Record<string, unknown>>('/customer-segments/rfm/distribution'),

  listSegments: () =>
    api.get<{ segments: Segment[] }>('/customer-segments/segments'),

  createSegment: (data: { name: string; criteria: Record<string, unknown> }) =>
    api.post<Segment>('/customer-segments/segments', data),

  updateSegment: (id: number, data: Record<string, unknown>) =>
    api.patch<Segment>(`/customer-segments/segments/${id}`, data),

  deleteSegment: (id: number) =>
    api.delete<{ success: boolean }>(`/customer-segments/segments/${id}`),

  segmentCustomers: (id: number, offset = 0, limit = 50) => {
    const q = new URLSearchParams({ offset: String(offset), limit: String(limit) })
    return api.get<{ customers: Array<Record<string, unknown>>; total: number }>(
      `/customer-segments/segments/${id}/customers?${q.toString()}`
    )
  },
}
