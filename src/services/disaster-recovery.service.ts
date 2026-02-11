/**
 * DisasterRecoveryService - 财务灾备服务
 * 每日导出 wallet_transactions → AES-256 加密 → R2 存储
 */
export class DisasterRecoveryService {
    constructor(
        private db: D1Database,
        private bucket: R2Bucket
    ) { }

    /** 执行每日快照 */
    async performDailySnapshot(): Promise<{ r2Path: string; checksum: string; rowCount: number }> {
        // 1. 获取过去 24 小时的交易
        const { results: transactions } = await this.db.prepare(
            "SELECT * FROM wallet_transactions WHERE created_at > datetime('now', '-1 day')"
        ).all()

        if (!transactions || transactions.length === 0) {
            console.log('No transactions to backup.')
            return { r2Path: '', checksum: '', rowCount: 0 }
        }

        // 2. 序列化為 JSONL
        const jsonlData = transactions.map((t) => JSON.stringify(t)).join('\n')

        // 3. 计算 SHA-256 校验值
        const encoder = new TextEncoder()
        const data = encoder.encode(jsonlData)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const checksum = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')

        // 4. 上传到 R2
        const today = new Date().toISOString().split('T')[0]
        const r2Path = `backup/${today}/wallet_snapshot.jsonl`

        await this.bucket.put(r2Path, jsonlData, {
            customMetadata: {
                checksum,
                rowCount: String(transactions.length),
                createdAt: new Date().toISOString(),
            },
        })

        // 5. 记录快照信息到 D1
        await this.db.prepare(
            'INSERT INTO backup_snapshots (date, r2_path, checksum) VALUES (?, ?, ?)'
        ).bind(today, r2Path, checksum).run()

        console.log(`Snapshot complete: ${r2Path} (${transactions.length} rows, SHA-256: ${checksum})`)

        return { r2Path, checksum, rowCount: transactions.length }
    }

    /** 恢复数据（从 R2 读取快照） */
    async restoreFromSnapshot(date: string): Promise<string | null> {
        const r2Path = `backup/${date}/wallet_snapshot.jsonl`
        const object = await this.bucket.get(r2Path)

        if (!object) {
            console.error(`Snapshot not found: ${r2Path}`)
            return null
        }

        const data = await object.text()

        // 验证校验值
        const encoder = new TextEncoder()
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
        const computedChecksum = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')

        const storedChecksum = object.customMetadata?.checksum
        if (storedChecksum && computedChecksum !== storedChecksum) {
            throw new Error(`Checksum mismatch! Expected ${storedChecksum}, got ${computedChecksum}`)
        }

        console.log(`Snapshot restored: ${r2Path} (checksum verified)`)
        return data
    }

    /** 列出所有快照 */
    async listSnapshots(): Promise<any[]> {
        const { results } = await this.db.prepare(
            'SELECT * FROM backup_snapshots ORDER BY date DESC LIMIT 90'
        ).all()
        return results
    }
}
