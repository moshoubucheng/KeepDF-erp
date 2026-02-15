import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { CacheService } from '../services/cache.service'

describe('CacheService', () => {
    let cache: CacheService

    beforeEach(async () => {
        cache = new CacheService(env.KV)
        // Clean up any leftover cache keys
        const list = await env.KV.list({ prefix: 'cache:' })
        for (const key of list.keys) {
            await env.KV.delete(key.name)
        }
    })

    it('returns fetched value on cache miss and caches it', async () => {
        let fetchCount = 0
        const fetcher = async () => { fetchCount++; return { data: 'hello' } }

        const result1 = await cache.getOrFetch('test:miss', fetcher, 60)
        expect(result1).toEqual({ data: 'hello' })
        expect(fetchCount).toBe(1)

        // Second call should use cached value
        const result2 = await cache.getOrFetch('test:miss', fetcher, 60)
        expect(result2).toEqual({ data: 'hello' })
        expect(fetchCount).toBe(1) // fetcher not called again
    })

    it('invalidates a single key', async () => {
        let fetchCount = 0
        const fetcher = async () => { fetchCount++; return { n: fetchCount } }

        await cache.getOrFetch('test:inv', fetcher, 60)
        expect(fetchCount).toBe(1)

        await cache.invalidate('test:inv')

        const result = await cache.getOrFetch('test:inv', fetcher, 60)
        expect(fetchCount).toBe(2) // fetcher called again after invalidation
        expect(result).toEqual({ n: 2 })
    })

    it('invalidates by prefix', async () => {
        await cache.getOrFetch('dashboard:stats:1', async () => 'a', 60)
        await cache.getOrFetch('dashboard:stats:2', async () => 'b', 60)

        await cache.invalidatePrefix('dashboard:stats:')

        // Both should be gone
        let calls = 0
        await cache.getOrFetch('dashboard:stats:1', async () => { calls++; return 'c' }, 60)
        await cache.getOrFetch('dashboard:stats:2', async () => { calls++; return 'd' }, 60)
        expect(calls).toBe(2)
    })

    it('gracefully handles corrupted cache data', async () => {
        // Write invalid JSON directly to KV
        await env.KV.put('cache:test:corrupt', 'not-json{{{')

        const result = await cache.getOrFetch('test:corrupt', async () => ({ ok: true }), 60)
        expect(result).toEqual({ ok: true }) // falls back to fetcher
    })
})
