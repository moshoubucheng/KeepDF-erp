import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { WalletService } from '../services/wallet.service'

// 读取 schema 和 seed SQL
import schemaSQL from '../db/schema.sql'
import seedSQL from '../db/seed.sql'

// 提取 schema 中的表名，用于清理
const TABLE_NAMES = [
    'backup_snapshots', 'notification_logs', 'api_logs', 'invoices',
    'commissions', 'wallet_transactions', 'outbound_records',
    'inbound_records', 'warehouse_locations', 'order_items', 'orders',
    'platform_mappings', 'product_variants', 'products', 'distributors',
]

async function setupDB(db: D1Database) {
    // 清理所有表（按外键依赖倒序）
    for (const table of TABLE_NAMES) {
        await db.prepare(`DROP TABLE IF EXISTS ${table}`).run()
    }
    // 逐条执行 schema
    for (const stmt of schemaSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
    // 逐条执行 seed
    for (const stmt of seedSQL.split(';')) {
        const trimmed = stmt.trim()
        if (trimmed) await db.prepare(trimmed).run()
    }
}

describe('WalletService', () => {
    let service: WalletService

    beforeEach(async () => {
        await setupDB(env.DB)
        service = new WalletService(env.DB)
    })

    describe('getBalance', () => {
        it('返回已有分销商的余额', async () => {
            const result = await service.getBalance(1)
            expect(result).not.toBeNull()
            expect(result!.balance).toBe(500000)
            expect(result!.frozen).toBe(0)
        })

        it('不存在的分销商返回 null', async () => {
            const result = await service.getBalance(999)
            expect(result).toBeNull()
        })
    })

    describe('deposit', () => {
        it('充值后余额增加', async () => {
            const tx = await service.deposit(1, 10000)
            expect(tx.type).toBe('DEPOSIT')
            expect(tx.amount).toBe(10000)
            expect(tx.balance_snapshot).toBe(510000)

            const balance = await service.getBalance(1)
            expect(balance!.balance).toBe(510000)
        })

        it('不存在的分销商充值抛错', async () => {
            await expect(service.deposit(999, 10000)).rejects.toThrow('Distributor not found')
        })
    })

    describe('freeze', () => {
        it('冻结后余额减少、冻结金额增加', async () => {
            await service.freeze(1, 20000, 'ORD-TEST-001')

            const balance = await service.getBalance(1)
            expect(balance!.balance).toBe(480000)
            expect(balance!.frozen).toBe(20000)
        })

        it('余额不足时冻结抛错', async () => {
            await expect(
                service.freeze(1, 999999, 'ORD-TEST-002')
            ).rejects.toThrow('Insufficient balance')
        })

        it('不存在的分销商冻结抛错', async () => {
            await expect(
                service.freeze(999, 1000, 'ORD-TEST-003')
            ).rejects.toThrow('Distributor not found')
        })
    })

    describe('deduct', () => {
        it('冻结后扣款成功', async () => {
            // 先冻结
            await service.freeze(1, 10000, 'ORD-TEST-004')
            // 再扣款
            await service.deduct(1, 10000, 'ORD-TEST-004')

            const balance = await service.getBalance(1)
            expect(balance!.balance).toBe(490000) // 500000 - 10000 freeze
            expect(balance!.frozen).toBe(0) // 10000 frozen - 10000 deduct
        })

        it('冻结金额不足时扣款抛错', async () => {
            await expect(
                service.deduct(1, 10000, 'ORD-TEST-005')
            ).rejects.toThrow('Frozen amount insufficient')
        })

        it('不存在的分销商扣款抛错', async () => {
            await expect(
                service.deduct(999, 1000, 'ORD-TEST-006')
            ).rejects.toThrow('Distributor not found')
        })
    })

    describe('getTransactions', () => {
        it('返回交易流水列表', async () => {
            // 先做几笔操作
            await service.deposit(1, 5000)
            await service.freeze(1, 3000, 'ORD-TEST-007')

            const txns = await service.getTransactions(1)
            expect(txns.length).toBeGreaterThanOrEqual(2)
            const types = txns.map(t => t.type)
            expect(types).toContain('DEPOSIT')
            expect(types).toContain('FREEZE')
        })

        it('limit 参数生效', async () => {
            await service.deposit(1, 1000)
            await service.deposit(1, 2000)
            await service.deposit(1, 3000)

            const txns = await service.getTransactions(1, 2)
            expect(txns.length).toBe(2)
        })
    })

    describe('复式记账完整流程', () => {
        it('充值 → 冻结 → 扣款 全流程', async () => {
            // 分销商 3 初始余额 100000, 冻结 10000
            const initial = await service.getBalance(3)
            expect(initial!.balance).toBe(100000)
            expect(initial!.frozen).toBe(10000)

            // 充值 50000
            await service.deposit(3, 50000)
            let bal = await service.getBalance(3)
            expect(bal!.balance).toBe(150000)
            expect(bal!.frozen).toBe(10000)

            // 冻结 30000（新订单）
            await service.freeze(3, 30000, 'ORD-FLOW-001')
            bal = await service.getBalance(3)
            expect(bal!.balance).toBe(120000)
            expect(bal!.frozen).toBe(40000)

            // 扣款 30000（发货）
            await service.deduct(3, 30000, 'ORD-FLOW-001')
            bal = await service.getBalance(3)
            expect(bal!.balance).toBe(120000)
            expect(bal!.frozen).toBe(10000)

            // 验证流水记录
            const txns = await service.getTransactions(3)
            const types = txns.map(t => t.type)
            expect(types).toContain('DEPOSIT')
            expect(types).toContain('FREEZE')
            expect(types).toContain('DEDUCT')
        })
    })
})
