import { api } from '../client'

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatResponse {
  success: boolean
  reply: string
  data?: { columns: string[]; rows: unknown[][] }
  sql?: string
}

export interface AiForecastItem {
  sku: string
  name: string
  action: string
  qty: number
  reason: string
  urgency: 'high' | 'medium' | 'low'
  currentStock: number
  daysOfStock: number
  dailyVelocity: number
  incoming: number
}

export interface AiForecastResponse {
  success: boolean
  suggestions: AiForecastItem[]
  summary: string
  generatedAt: string
}

export const aiApi = {
  chat: (message: string, history?: AiChatMessage[]) =>
    api.post<AiChatResponse>('/ai/chat', { message, history }),

  forecast: () =>
    api.post<AiForecastResponse>('/ai/forecast'),
}
