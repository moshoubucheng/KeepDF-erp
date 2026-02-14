import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './db/types'
import type { OrderSyncMessage } from './db/types'
import { authMiddleware, loggerMiddleware } from './middleware/auth'
import { securityHeaders } from './middleware/security-headers'
import { loginRateLimit } from './middleware/rate-limit'
import { wallet } from './controllers/wallet.controller'
import { orders } from './controllers/orders.controller'
import { inventory } from './controllers/inventory.controller'
import { auth } from './controllers/auth.controller'
import { commissions } from './controllers/commissions.controller'
import { invoices } from './controllers/invoices.controller'
import { dashboard } from './controllers/dashboard.controller'
import { platformSync } from './controllers/platform-sync.controller'
import { distributors } from './controllers/distributors.controller'
import { auditLogs } from './controllers/audit.controller'
import { DisasterRecoveryService } from './services/disaster-recovery.service'
import { WalletService } from './services/wallet.service'
import { LowStockChecker } from './services/lowstock-checker'
import { PlatformSyncService } from './services/platform-sync.service'

const ALLOWED_ORIGINS = [
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    'https://erp.keepdf.com',
]

const app = new Hono<{ Bindings: Bindings }>()

// ===== Global Middleware =====
app.use('/*', cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
}))
app.use('/*', securityHeaders)
app.use('/api/*', loggerMiddleware)
app.use('/api/v1/auth/login', loginRateLimit)
app.use('/api/v1/auth/verify-2fa', loginRateLimit)
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
app.route('/api/v1/auth', auth)
app.route('/api/v1/commissions', commissions)
app.route('/api/v1/invoices', invoices)
app.route('/api/v1/dashboard', dashboard)
app.route('/api/v1/platform-sync', platformSync)
app.route('/api/v1/distributors', distributors)
app.route('/api/v1/audit-logs', auditLogs)

// ===== Error Handler =====
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message, err.stack)
  return c.json({ error: 'Internal Server Error' }, 500)
})

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

// ===== Export =====
export default {
  fetch: app.fetch,

  // Queue Consumer - 订单异步处理
  async queue(batch: MessageBatch<OrderSyncMessage>, env: Bindings) {
    for (const message of batch.messages) {
      const body = message.body

      // 验证消息结构
      if (
        !body ||
        typeof body.platform !== 'string' ||
        !body.payload ||
        typeof body.payload.order_id !== 'string' ||
        typeof body.payload.total !== 'number' ||
        body.payload.total <= 0
      ) {
        console.error('[QUEUE] Invalid message, skipping:', JSON.stringify(body))
        message.ack()
        continue
      }

      const { platform, payload } = body
      console.log(`[QUEUE] Processing ${platform} order: ${payload.order_id}`)

      try {
        // 1. 写入订单
        const { meta } = await env.DB.prepare(
          `INSERT INTO orders (platform, platform_order_id, status, total_amount, tax_total)
           VALUES (?, ?, 'PROCESSING', ?, 0)`
        ).bind(platform, payload.order_id, payload.total).run()

        const orderId = meta.last_row_id

        // 2. 写入订单明细
        if (Array.isArray(payload.items) && payload.items.length > 0) {
          const stmts = payload.items.map((item) =>
            env.DB.prepare(
              'INSERT INTO order_items (order_id, sku, qty, unit_price, tax_rate) VALUES (?, ?, ?, ?, ?)'
            ).bind(orderId, item.sku, item.qty, item.price, 0.10)
          )
          await env.DB.batch(stmts)
        }

        // 3. 冻结分销商余额
        if ((body as any).payload?.distributor_id) {
          const walletService = new WalletService(env.DB)
          await walletService.freeze((body as any).payload.distributor_id, payload.total, String(orderId))
        }

        message.ack()
      } catch (e) {
        console.error(`[QUEUE] Failed:`, e)
        message.retry()
      }
    }
  },

  // Cron Trigger - 灾备快照 + 低库存检查
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('[CRON] Daily tasks triggered')

    // 1. 灾备快照
    try {
      const drService = new DisasterRecoveryService(env.DB, env.BUCKET, env.ENCRYPTION_KEY)
      const result = await drService.performDailySnapshot()
      console.log(`[CRON] Backup complete: ${result.rowCount} rows -> ${result.r2Path}`)
    } catch (e) {
      console.error('[CRON] Backup failed:', e)
    }

    // 2. 低库存检查
    try {
      const checker = new LowStockChecker(env.DB)
      const stockResult = await checker.check()
      console.log(`[CRON] Low stock check: ${stockResult.alertsSent} alerts sent`)
    } catch (e) {
      console.error('[CRON] Low stock check failed:', e)
    }

    // 3. 三平台自动同步
    const platforms = ['TIKTOK', 'TEMU', 'RAKUTEN'] as const
    const syncService = new PlatformSyncService(env.DB, env.ORDER_QUEUE)
    for (const platform of platforms) {
      try {
        const result = await syncService.syncPlatform(platform, 'CRON')
        console.log(`[CRON] ${platform} sync: fetched=${result.ordersFetched}, queued=${result.ordersQueued}`)
      } catch (e) {
        console.error(`[CRON] ${platform} sync failed:`, e)
      }
    }
  },
}
