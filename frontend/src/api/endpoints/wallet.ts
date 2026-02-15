import { api } from '../client'
import type { WalletTransaction } from '../types'

interface WalletTxParams {
  page?: number
  limit?: number
}

export const walletApi = {
  balance: () =>
    api.get<{ success: boolean; balance: number; frozen_balance: number }>('/wallet/balance'),

  transactions: (params: WalletTxParams = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return api.get<{ success: boolean; transactions: WalletTransaction[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/wallet/transactions${qs ? `?${qs}` : ''}`)
  },

  deposit: (data: { amount: number; note?: string }) =>
    api.post('/wallet/recharge', data),
}
