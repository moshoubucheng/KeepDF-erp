import type { Bindings, Distributor, WalletTransaction, RechargeRequest } from '../db/types'

/**
 * WalletService - 分销商钱包服务
 * 实现复式记账法：余额 → 冻結 → 扣除
 * All balance operations use atomic SQL to prevent race conditions.
 */
export class WalletService {
    constructor(private db: D1Database) { }

    /** 获取分销商余额 */
    async getBalance(distributorId: number): Promise<{ balance: number; frozen: number; frozen_balance: number } | null> {
        const row = await this.db.prepare(
            'SELECT balance, frozen_balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<Distributor>()

        if (!row) return null
        return { balance: row.balance, frozen: row.frozen_balance, frozen_balance: row.frozen_balance }
    }

    /** 充值（管理员審核後調用） — atomic: batch UPDATE + INSERT */
    async deposit(distributorId: number, amount: number): Promise<WalletTransaction> {
        const row = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()
        if (!row) throw new Error('Distributor not found')

        const newBalance = row.balance + amount

        await this.db.batch([
            this.db.prepare(
                'UPDATE distributors SET balance = balance + ? WHERE id = ?'
            ).bind(amount, distributorId),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, balance_snapshot)
                 VALUES (?, 'DEPOSIT', ?, ?)`
            ).bind(distributorId, amount, newBalance),
        ])

        return {
            id: 0,
            distributor_id: distributorId,
            type: 'DEPOSIT',
            amount,
            related_order_id: null,
            balance_snapshot: newBalance,
            created_at: new Date().toISOString(),
        }
    }

    /** 冻結金額（訂単作成時調用） — atomic: batch UPDATE + INSERT */
    async freeze(distributorId: number, amount: number, orderId: string): Promise<void> {
        const row = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()
        if (!row || row.balance < amount) throw new Error('Insufficient balance')

        const newBalance = row.balance - amount

        await this.db.batch([
            this.db.prepare(
                'UPDATE distributors SET balance = balance - ?, frozen_balance = frozen_balance + ? WHERE id = ? AND balance >= ?'
            ).bind(amount, amount, distributorId, amount),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
                 VALUES (?, 'FREEZE', ?, ?, ?)`
            ).bind(distributorId, amount, orderId, newBalance),
        ])
    }

    /** 扣款（発貨確認後調用） — atomic: batch UPDATE + INSERT */
    async deduct(distributorId: number, amount: number, orderId: string): Promise<void> {
        const row = await this.db.prepare(
            'SELECT balance, frozen_balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number; frozen_balance: number }>()
        if (!row || row.frozen_balance < amount) throw new Error('Frozen amount insufficient')

        await this.db.batch([
            this.db.prepare(
                'UPDATE distributors SET frozen_balance = frozen_balance - ? WHERE id = ? AND frozen_balance >= ?'
            ).bind(amount, distributorId, amount),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
                 VALUES (?, 'DEDUCT', ?, ?, ?)`
            ).bind(distributorId, amount, orderId, row.balance),
        ])
    }

    /** 退款 — atomic: batch UPDATE + INSERT */
    async refund(distributorId: number, amount: number, orderId: string): Promise<void> {
        const row = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()
        if (!row) throw new Error('Distributor not found')

        const newBalance = row.balance + amount

        await this.db.batch([
            this.db.prepare(
                'UPDATE distributors SET balance = balance + ?, frozen_balance = MAX(0, frozen_balance - ?) WHERE id = ?'
            ).bind(amount, amount, distributorId),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
                 VALUES (?, 'REFUND', ?, ?, ?)`
            ).bind(distributorId, amount, orderId, newBalance),
        ])
    }

    /** 获取交易流水 */
    async getTransactions(distributorId: number, limit = 50): Promise<WalletTransaction[]> {
        const { results } = await this.db.prepare(
            'SELECT * FROM wallet_transactions WHERE distributor_id = ? ORDER BY created_at DESC LIMIT ?'
        ).bind(distributorId, limit).all<WalletTransaction>()

        return results
    }
}
