import { api } from '../client'
import type { WalletTransaction } from '../types'

export const walletApi = {
  balance: (distributorId: number) =>
    api.get<{ distributorId: number; balance: number; frozen_balance: number }>(`/wallet/balance/${distributorId}`),

  transactions: (distributorId: number) =>
    api.get<{ distributorId: number; transactions: WalletTransaction[] }>(`/wallet/transactions/${distributorId}`),

  deposit: (distributorId: number, amount: number) =>
    api.post<{ status: string; transaction: WalletTransaction }>('/wallet/deposit', { distributor_id: distributorId, amount }),
}
