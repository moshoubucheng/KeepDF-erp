import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './db/types'
import { authMiddleware, loggerMiddleware } from './middleware/auth'
import { wallet } from './controllers/wallet.controller'
import { orders } from './controllers/orders.controller'
import { inventory } from './controllers/inventory.controller'
import { DisasterRecoveryService } from './services/disaster-recovery.service'
import { WalletService } from './services/wallet.service'

const app = new Hono<{ Bindings: Bindings }>()

// ===== Global Middleware =====
app.use('/*', cors())
app.use('/api/*', loggerMiddleware)
app.use('/api/*', authMiddleware)

app.get('/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first()
    return c.json({ status: 'healthy', db: 'connected' })
  } catch {
    return c.json({ status: 'unhealthy', db: 'disconnected' }, 503)
  }
})

// Mount Controllers
app.route('/api/v1/wallet', wallet)
app.route('/api/v1/orders', orders)
app.route('/api/v1/inventory', inventory)

// ===== Error Handler =====
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message)
  return c.json({ error: 'Internal Server Error', message: err.message }, 500)
})

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

// ===== Export =====
export default {
  fetch: app.fetch,

  // Queue Consumer - 订单异步处理
  async queue(batch: MessageBatch<any>, env: Bindings) {
    for (const message of batch.messages) {
      const { platform, payload } = message.body
      console.log(`[QUEUE] Processing ${platform} order: ${payload.order_id}`)

      try {
        // 1. 写入订单
        const { meta } = await env.DB.prepare(
          `INSERT INTO orders (platform, platform_order_id, status, total_amount, tax_total)
           VALUES (?, ?, 'PROCESSING', ?, 0)`
        ).bind(platform, payload.order_id, payload.total).run()

        const orderId = meta.last_row_id

        // 2. 写入订单明细
        if (payload.items?.length > 0) {
          const stmts = payload.items.map((item: any) =>
            env.DB.prepare(
              'INSERT INTO order_items (order_id, sku, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?)'
            ).bind(orderId, item.sku, item.qty, item.price, 0.10)
          )
          await env.DB.batch(stmts)
        }

        // 3. 冻结分销商余额
        if (payload.distributor_id) {
          const walletService = new WalletService(env.DB)
          await walletService.freeze(payload.distributor_id, payload.total, String(orderId))
        }

        message.ack()
      } catch (e) {
        console.error(`[QUEUE] Failed:`, e)
        message.retry()
      }
    }
  },

  // Cron Trigger - 灾备快照
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('[CRON] Disaster Recovery Snapshot triggered')
    const drService = new DisasterRecoveryService(env.DB, env.BUCKET, env.ENCRYPTION_KEY)
    const result = await drService.performDailySnapshot()
    console.log(`[CRON] Backup complete: ${result.rowCount} rows -> ${result.r2Path}`)
  },
}
