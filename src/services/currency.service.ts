/**
 * CurrencyService - Exchange rate management and currency conversion
 */
import type { ExchangeRate } from '../db/types'

const VALID_CURRENCIES = ['JPY', 'USD', 'CNY'] as const

export class CurrencyService {
    constructor(private db: D1Database) {}

    async getRates(): Promise<ExchangeRate[]> {
        const { results } = await this.db.prepare(
            'SELECT * FROM exchange_rates ORDER BY from_currency, to_currency'
        ).all<ExchangeRate>()
        return results
    }

    async getRate(from: string, to: string): Promise<number | null> {
        if (from === to) return 1.0
        const row = await this.db.prepare(
            'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?'
        ).bind(from.toUpperCase(), to.toUpperCase()).first<{ rate: number }>()
        return row ? row.rate : null
    }

    async setRate(from: string, to: string, rate: number, updatedBy: number): Promise<ExchangeRate> {
        from = from.toUpperCase()
        to = to.toUpperCase()

        if (!VALID_CURRENCIES.includes(from as typeof VALID_CURRENCIES[number])) {
            throw new Error(`Invalid currency: ${from}`)
        }
        if (!VALID_CURRENCIES.includes(to as typeof VALID_CURRENCIES[number])) {
            throw new Error(`Invalid currency: ${to}`)
        }
        if (from === to) throw new Error('Cannot set rate for same currency')
        if (rate <= 0) throw new Error('Rate must be positive')

        await this.db.prepare(
            `INSERT INTO exchange_rates (from_currency, to_currency, rate, source, updated_by, updated_at)
             VALUES (?, ?, ?, 'MANUAL', ?, CURRENT_TIMESTAMP)
             ON CONFLICT(from_currency, to_currency)
             DO UPDATE SET rate = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP`
        ).bind(from, to, rate, updatedBy, rate, updatedBy).run()

        return this.db.prepare(
            'SELECT * FROM exchange_rates WHERE from_currency = ? AND to_currency = ?'
        ).bind(from, to).first<ExchangeRate>() as Promise<ExchangeRate>
    }

    async convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: number; converted: number }> {
        from = from.toUpperCase()
        to = to.toUpperCase()

        if (from === to) {
            return { amount, rate: 1.0, converted: amount }
        }

        const rate = await this.getRate(from, to)
        if (rate === null) {
            throw new Error(`Exchange rate not found: ${from} → ${to}`)
        }

        let converted = amount * rate
        // JPY has no decimals
        if (to === 'JPY') {
            converted = Math.floor(converted)
        } else {
            converted = Math.round(converted * 100) / 100
        }

        return { amount, rate, converted }
    }

    async toJPY(amount: number, currency: string): Promise<{ jpyAmount: number; rate: number }> {
        currency = currency.toUpperCase()
        if (currency === 'JPY') {
            return { jpyAmount: amount, rate: 1.0 }
        }
        const result = await this.convert(amount, currency, 'JPY')
        return { jpyAmount: result.converted, rate: result.rate }
    }
}
