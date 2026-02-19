import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        // Use test config without [ai] binding (not supported in local miniflare)
        wrangler: { configPath: './wrangler.test.toml' },
      },
    },
    exclude: ['frontend/**', 'node_modules/**', 'e2e/**'],
  },
})
