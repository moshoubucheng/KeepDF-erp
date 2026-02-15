import { api } from '../client'

export interface ExchangeRate {
  id: number
  from_currency: string
  to_currency: string
  rate: number
  created_by: number
  created_at: string
  updated_at: string
}

export const currencyApi = {
  getRates: () => api.get<{ rates: ExchangeRate[] }>('/currency/rates'),

  setRate: (from: string, to: string, rate: number) =>
    api.post<{ success: boolean; rate: ExchangeRate }>('/currency/rates', { from, to, rate }),

  // Aliases used by CurrencyPage.tsx

  listRates: (params: { page?: number; limit?: number } = {}) => {
    return currencyApi.getRates().then((res) => {
      const all = res.rates || []
      const page = params.page || 1
      const limit = params.limit || 20
      const start = (page - 1) * limit
      const sliced = all.slice(start, start + limit)
      return {
        data: sliced,
        pages: Math.ceil(all.length / limit),
        total: all.length,
      }
    })
  },

  convert: ((
    amountOrParams: number | { amount: number; from: string; to: string },
    from?: string,
    to?: string,
  ) => {
    let amount: number
    let fromCurrency: string
    let toCurrency: string
    if (typeof amountOrParams === 'object') {
      amount = amountOrParams.amount
      fromCurrency = amountOrParams.from
      toCurrency = amountOrParams.to
    } else {
      amount = amountOrParams
      fromCurrency = from!
      toCurrency = to!
    }
    const q = new URLSearchParams({
      amount: String(amount),
      from: fromCurrency,
      to: toCurrency,
    })
    return api
      .get<{ from: string; to: string; amount: number; converted: number; rate: number }>(
        `/currency/convert?${q.toString()}`,
      )
      .then((res) => ({
        ...res,
        result: res.converted,
      }))
  }) as {
    (params: { amount: number; from: string; to: string }): Promise<{
      from: string; to: string; amount: number; converted: number; rate: number; result: number
    }>
    (amount: number, from: string, to: string): Promise<{
      from: string; to: string; amount: number; converted: number; rate: number; result: number
    }>
  },

  updateRate: (id: number, data: { rate: number }) =>
    api.put<{ success: boolean; rate: ExchangeRate }>(`/currency/rates/${id}`, data),
}
