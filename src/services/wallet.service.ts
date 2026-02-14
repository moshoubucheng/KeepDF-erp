import type { Bindings, Distributor, WalletTransaction, RechargeRequest } from '../db/types'

/**
 * WalletService - 分销商钱包服务
 * 实现复式记账法：余额 → 冻结 → 扣除
 */
export class WalletService {
    constructor(private db: D1Database) { }

    /** 获取分销商余额 */
    async getBalance(distributorId: number): Promise<{ balance: number; frozen: number } | null> {
        const row = await this.db.prepare(
            'SELECT balance, frozen_balance FROM distributors WHERE id = ?'
        ).bind(distributorId).first<Distributor>()

        if (!row) return null
        return { balance: row.balance, frozen: row.frozen_balance }
    }

    /** 充值（管理员审核后调用） */
    async deposit(distributorId: number, amount: number): Promise<WalletTransaction> {
        const distributor = await this.db.prepare(
            'SELECT * FROM distributors WHERE id = ?'
        ).bind(distributorId).first<Distributor>()

        if (!distributor) throw new Error('Distributor not found')

        const newBalance = distributor.balance + amount

        // D1 Transaction: 更新余额 + 写入流水
        const batch = [
            this.db.prepare(
                'UPDATE distributors SET balance = ? WHERE id = ?'
            ).bind(newBalance, distributorId),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, balance_snapshot)
         VALUES (?, 'DEPOSIT', ?, ?)`
            ).bind(distributorId, amount, newBalance),
        ]

        await this.db.batch(batch)

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

    /** 冻结金额（订单创建时调用） */
    async freeze(distributorId: number, amount: number, orderId: string): Promise<void> {
        const distributor = await this.db.prepare(
            'SELECT * FROM distributors WHERE id = ?'
        ).bind(distributorId).first<Distributor>()

        if (!distributor) throw new Error('Distributor not found')
        if (distributor.balance < amount) throw new Error('Insufficient balance')

        const newBalance = distributor.balance - amount
        const newFrozen = distributor.frozen_balance + amount

        const batch = [
            this.db.prepare(
                'UPDATE distributors SET balance = ?, frozen_balance = ? WHERE id = ?'
            ).bind(newBalance, newFrozen, distributorId),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
         VALUES (?, 'FREEZE', ?, ?, ?)`
            ).bind(distributorId, amount, orderId, newBalance),
        ]

        await this.db.batch(batch)
    }

    /** 扣款（发货确认后调用） */
    async deduct(distributorId: number, amount: number, orderId: string): Promise<void> {
        const distributor = await this.db.prepare(
            'SELECT * FROM distributors WHERE id = ?'
        ).bind(distributorId).first<Distributor>()

        if (!distributor) throw new Error('Distributor not found')
        if (distributor.frozen_balance < amount) throw new Error('Frozen amount insufficient')

        const newFrozen = distributor.frozen_balance - amount

        const batch = [
            this.db.prepare(
                'UPDATE distributors SET frozen_balance = ? WHERE id = ?'
            ).bind(newFrozen, distributorId),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
         VALUES (?, 'DEDUCT', ?, ?, ?)`
            ).bind(distributorId, amount, orderId, distributor.balance),
        ]

        await this.db.batch(batch)
    }

    /** 退款（订单取消时调用） */
    async refund(distributorId: number, amount: number, orderId: string): Promise<void> {
        const distributor = await this.db.prepare(
            'SELECT * FROM distributors WHERE id = ?'
        ).bind(distributorId).first<Distributor>()

        if (!distributor) throw new Error('Distributor not found')

        const newBalance = distributor.balance + amount
        const newFrozen = distributor.frozen_balance - amount

        const batch = [
            this.db.prepare(
                'UPDATE distributors SET balance = ?, frozen_balance = ? WHERE id = ?'
            ).bind(newBalance, newFrozen, distributorId),
            this.db.prepare(
                `INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot)
         VALUES (?, 'REFUND', ?, ?, ?)`
            ).bind(distributorId, amount, orderId, newBalance),
        ]

        await this.db.batch(batch)
    }

    /** 获取交易流水 */
    async getTransactions(distributorId: number, limit = 50): Promise<WalletTransaction[]> {
        const { results } = await this.db.prepare(
            'SELECT * FROM wallet_transactions WHERE distributor_id = ? ORDER BY created_at DESC LIMIT ?'
        ).bind(distributorId, limit).all<WalletTransaction>()

        return results
    }
}
