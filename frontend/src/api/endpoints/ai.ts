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

export const aiApi = {
  chat: (message: string, history?: AiChatMessage[]) =>
    api.post<AiChatResponse>('/ai/chat', { message, history }),
}
