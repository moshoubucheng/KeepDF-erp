/**
 * DisasterRecoveryService - 财务灾备服务
 * 每日导出 wallet_transactions → AES-256-GCM 加密 → R2 存储
 */
export class DisasterRecoveryService {
    constructor(
        private db: D1Database,
        private bucket: R2Bucket,
        private encryptionKey: string
    ) { }

    /** 从字符串密钥派生 AES-256 CryptoKey */
    private async deriveKey(): Promise<CryptoKey> {
        const encoder = new TextEncoder()
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.encryptionKey),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        )
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('smart-erp-disaster-recovery'),
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
    }

    /** AES-256-GCM 加密：返回 IV (12 bytes) + ciphertext */
    private async encrypt(plaintext: string): Promise<ArrayBuffer> {
        const key = await this.deriveKey()
        const encoder = new TextEncoder()
        const iv = crypto.getRandomValues(new Uint8Array(12))

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(plaintext)
        )

        // Prepend IV to ciphertext
        const result = new Uint8Array(iv.byteLength + ciphertext.byteLength)
        result.set(iv, 0)
        result.set(new Uint8Array(ciphertext), iv.byteLength)
        return result.buffer
    }

    /** AES-256-GCM 解密：从 IV 前缀 + 密文中恢复明文 */
    private async decrypt(encrypted: ArrayBuffer): Promise<string> {
        const key = await this.deriveKey()
        const data = new Uint8Array(encrypted)
        const iv = data.slice(0, 12)
        const ciphertext = data.slice(12)

        const plainBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        )
        return new TextDecoder().decode(plainBuffer)
    }

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

        // 3. 计算明文 SHA-256 校验值
        const encoder = new TextEncoder()
        const data = encoder.encode(jsonlData)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const checksum = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')

        // 4. AES-256-GCM 加密
        const encryptedData = await this.encrypt(jsonlData)

        // 5. 上传加密数据到 R2
        const today = new Date().toISOString().split('T')[0]
        const r2Path = `backup/${today}/wallet_snapshot.jsonl.enc`

        await this.bucket.put(r2Path, encryptedData, {
            customMetadata: {
                checksum,
                rowCount: String(transactions.length),
                createdAt: new Date().toISOString(),
                encrypted: 'AES-256-GCM',
            },
        })

        // 6. 记录快照信息到 D1
        await this.db.prepare(
            'INSERT INTO backup_snapshots (date, r2_path, checksum) VALUES (?, ?, ?)'
        ).bind(today, r2Path, checksum).run()

        console.log(`Snapshot complete: ${r2Path} (${transactions.length} rows, SHA-256: ${checksum})`)

        return { r2Path, checksum, rowCount: transactions.length }
    }

    /** 恢复数据（从 R2 读取加密快照） */
    async restoreFromSnapshot(date: string): Promise<string | null> {
        const r2Path = `backup/${date}/wallet_snapshot.jsonl.enc`
        const object = await this.bucket.get(r2Path)

        if (!object) {
            console.error(`Snapshot not found: ${r2Path}`)
            return null
        }

        // 1. 读取加密数据并解密
        const encryptedBuffer = await object.arrayBuffer()
        const data = await this.decrypt(encryptedBuffer)

        // 2. 验证校验值
        const encoder = new TextEncoder()
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
        const computedChecksum = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')

        const storedChecksum = object.customMetadata?.checksum
        if (storedChecksum && computedChecksum !== storedChecksum) {
            throw new Error(`Checksum mismatch! Expected ${storedChecksum}, got ${computedChecksum}`)
        }

        console.log(`Snapshot restored: ${r2Path} (decrypted, checksum verified)`)
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
