/**
 * CacheService - KV-based transparent caching
 * Key prefix: `cache:` to avoid collision with `session:` keys
 */
export class CacheService {
    constructor(private kv: KVNamespace) {}

    /**
     * Get cached value or fetch and store it.
     * Falls back to fetcher on KV errors (graceful degradation).
     */
    async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 300): Promise<T> {
        const cacheKey = `cache:${key}`

        try {
            const cached = await this.kv.get(cacheKey)
            if (cached !== null) {
                return JSON.parse(cached) as T
            }
        } catch {
            // KV read failed — fall through to fetcher
        }

        const value = await fetcher()

        try {
            await this.kv.put(cacheKey, JSON.stringify(value), { expirationTtl: ttlSeconds })
        } catch {
            // KV write failed — ignore, value is still returned
        }

        return value
    }

    /** Invalidate a single cache key */
    async invalidate(key: string): Promise<void> {
        try {
            await this.kv.delete(`cache:${key}`)
        } catch {
            // best-effort
        }
    }

    /** Invalidate all keys matching a prefix (KV list + delete) */
    async invalidatePrefix(prefix: string): Promise<void> {
        try {
            const listed = await this.kv.list({ prefix: `cache:${prefix}` })
            await Promise.all(listed.keys.map(k => this.kv.delete(k.name)))
        } catch {
            // best-effort
        }
    }
}
