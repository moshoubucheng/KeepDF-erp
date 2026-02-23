import { api } from '../client'

// AI requests need longer timeout (Workers AI inference can take 30-60s)
const AI_TIMEOUT_MS = 60000

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
    api.post<AiChatResponse>('/ai/chat', { message, history }, AI_TIMEOUT_MS),

  forecast: () =>
    api.post<AiForecastResponse>('/ai/forecast', undefined, AI_TIMEOUT_MS),
}
