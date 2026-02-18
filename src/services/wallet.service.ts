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

    /** 充值（管理员審核後調用） — atomic balance + amount */
    async deposit(distributorId: number, amount: number): Promise<WalletTransaction> {
        const result = await this.db.prepare(
            'UPDATE distributors SET balance = balance + ? WHERE id = ?'
        ).bind(amount, distributorId).run()

        if (!result.meta.changes) throw new Error('Distributor not found')

        // Read new balance for snapshot
        const row = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()
        const newBalance = row?.balance ?? 0

        await this.db.prepare(
            `INSERT INTO wallet_transactions (distributor_id, type, amount, balance_snapshot)
         VALUES (?, 'DEPOSIT', ?, ?)`
        ).bind(distributorId, amount, newBalance).run()

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

    /** 冻結金額（訂単作成時調用） — atomic: balance -= amount, frozen += amount WHERE balance >= amount */
    async freeze(distributorId: number, amount: number, orderId: string): Promise<void> {
        const result = await this.db.prepare(
            'UPDATE distributors SET balance = balance - ?, frozen_balance = frozen_balance + ? WHERE id = ? AND balance >= ?'
        ).bind(amount, amount, distributorId, amount).run()

        if (!result.meta.changes) throw new Error('Insufficient balance')

        const row = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()

        await this.db.prepare(
            `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
         VALUES (?, 'FREEZE', ?, ?, ?)`
        ).bind(distributorId, amount, orderId, row?.balance ?? 0).run()
    }

    /** 扣款（発貨確認後調用） — atomic: frozen -= amount WHERE frozen >= amount */
    async deduct(distributorId: number, amount: number, orderId: string): Promise<void> {
        const result = await this.db.prepare(
            'UPDATE distributors SET frozen_balance = frozen_balance - ? WHERE id = ? AND frozen_balance >= ?'
        ).bind(amount, distributorId, amount).run()

        if (!result.meta.changes) throw new Error('Frozen amount insufficient')

        const row = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()

        await this.db.prepare(
            `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
         VALUES (?, 'DEDUCT', ?, ?, ?)`
        ).bind(distributorId, amount, orderId, row?.balance ?? 0).run()
    }

    /** 退款 — atomic: balance += amount, frozen -= amount; guard against negative frozen */
    async refund(distributorId: number, amount: number, orderId: string): Promise<void> {
        const result = await this.db.prepare(
            'UPDATE distributors SET balance = balance + ?, frozen_balance = MAX(0, frozen_balance - ?) WHERE id = ? AND frozen_balance >= 0'
        ).bind(amount, amount, distributorId).run()

        if (!result.meta.changes) throw new Error('Distributor not found')

        const row = await this.db.prepare(
            'SELECT balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<{ balance: number }>()

        await this.db.prepare(
            `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
         VALUES (?, 'REFUND', ?, ?, ?)`
        ).bind(distributorId, amount, orderId, row?.balance ?? 0).run()
    }

    /** 获取交易流水 */
    async getTransactions(distributorId: number, limit = 50): Promise<WalletTransaction[]> {
        const { results } = await this.db.prepare(
            'SELECT * FROM wallet_transactions WHERE distributor_id = ? ORDER BY created_at DESC LIMIT ?'
        ).bind(distributorId, limit).all<WalletTransaction>()

        return results
    }
}
