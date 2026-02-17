import { decodeCursor, buildCursorWhere, encodeCursor } from '../utils/cursor'
import type { PushService } from './push.service'

/**
 * NotificationCenterService - In-app notifications (站内通知)
 * Different from NotificationService which handles external webhooks
 */
export class NotificationCenterService {
    private pushService?: PushService

    constructor(private db: D1Database, pushService?: PushService) {
        this.pushService = pushService
    }

    /** Create a notification and push to external channels if configured */
    async create(params: {
        distributorId: number
        type: string
        title: string
        message: string
        relatedResourceType?: string
        relatedResourceId?: string
    }): Promise<void> {
        try {
            await this.db.prepare(
                `INSERT INTO notifications (distributor_id, type, title, message, related_resource_type, related_resource_id)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
                params.distributorId,
                params.type,
                params.title,
                params.message,
                params.relatedResourceType ?? null,
                params.relatedResourceId ?? null,
            ).run()

            // Send web push notification
            if (this.pushService) {
                try {
                    await this.pushService.sendToDistributor(params.distributorId, {
                        title: params.title,
                        body: params.message,
                        url: params.relatedResourceType && params.relatedResourceId
                            ? `/${params.relatedResourceType}s`
                            : '/notifications',
                    })
                } catch (e) {
                    console.error('[NOTIFICATION_CENTER] Push send failed:', e)
                }
            }

            // Check external channel preferences
            await this.pushToExternalChannels(params)
        } catch (e) {
            console.error('[NOTIFICATION_CENTER] Failed to create:', e)
        }
    }

    /** Push notification to external channels based on preferences */
    private async pushToExternalChannels(params: {
        distributorId: number; type: string; title: string; message: string
    }): Promise<void> {
        try {
            const pref = await this.db.prepare(
                'SELECT * FROM notification_preferences WHERE distributor_id = ? AND event_type = ? AND enabled = 1'
            ).bind(params.distributorId, params.type).first<any>()

            if (!pref || pref.channel === 'IN_APP') return

            const channel = pref.channel?.toUpperCase()
            const webhookUrl = pref.webhook_url

            if ((channel === 'SLACK' || channel === 'LINE' || channel === 'LARK') && webhookUrl) {
                const { NotificationService } = await import('./notification.service')
                const notifService = new NotificationService(this.db)
                await notifService.send({
                    type: 'INFO',
                    channel,
                    message: `${params.title}: ${params.message}`,
                    webhookUrl,
                })
            } else if (channel === 'EMAIL') {
                // Get distributor email
                const dist = await this.db.prepare(
                    'SELECT email FROM distributors WHERE id = ?'
                ).bind(params.distributorId).first<{ email: string | null }>()

                if (dist?.email) {
                    const { NotificationService } = await import('./notification.service')
                    const notifService = new NotificationService(this.db)
                    await notifService.sendEmail(dist.email, params.title, params.message)
                }
            }
        } catch (e) {
            console.error('[NOTIFICATION_CENTER] External push failed:', e)
        }
    }

    /** List notifications for a distributor */
    async list(distributorId: number, limit = 50, offset = 0, cursor?: string): Promise<{ notifications: any[]; total: number; unreadCount: number; nextCursor?: string; hasMore?: boolean }> {
        const safeLimit = Math.min(Math.max(1, limit), 200)
        const safeOffset = Math.max(0, offset)

        // Merged count query: total + unread in a single query (was 2 separate queries)
        const countsResult = await this.db.prepare(
            'SELECT COUNT(*) as total, COUNT(CASE WHEN is_read = 0 THEN 1 END) as unread_count FROM notifications WHERE distributor_id = ?'
        ).bind(distributorId).first<{ total: number; unread_count: number }>()

        // Cursor-based pagination
        if (cursor) {
            const decoded = decodeCursor(cursor)
            if (decoded) {
                const { clause, binds } = buildCursorWhere(decoded)
                const { results } = await this.db.prepare(
                    `SELECT * FROM notifications WHERE distributor_id = ? AND ${clause} ORDER BY created_at DESC, id DESC LIMIT ?`
                ).bind(distributorId, ...binds, safeLimit + 1).all()

                const hasMore = results.length > safeLimit
                const page = hasMore ? results.slice(0, safeLimit) : results
                const nextCursor = hasMore && page.length > 0
                    ? encodeCursor((page[page.length - 1] as any).created_at, (page[page.length - 1] as any).id)
                    : undefined

                return {
                    notifications: page,
                    total: countsResult?.total || 0,
                    unreadCount: countsResult?.unread_count || 0,
                    nextCursor,
                    hasMore,
                }
            }
        }

        // Offset-based fallback
        const { results } = await this.db.prepare(
            'SELECT * FROM notifications WHERE distributor_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        ).bind(distributorId, safeLimit, safeOffset).all()

        return {
            notifications: results,
            total: countsResult?.total || 0,
            unreadCount: countsResult?.unread_count || 0,
        }
    }

    /** Get unread count */
    async getUnreadCount(distributorId: number): Promise<number> {
        const result = await this.db.prepare(
            'SELECT COUNT(*) as count FROM notifications WHERE distributor_id = ? AND is_read = 0'
        ).bind(distributorId).first<{ count: number }>()
        return result?.count || 0
    }

    /** Mark single notification as read */
    async markRead(id: number, distributorId: number): Promise<boolean> {
        const { meta } = await this.db.prepare(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND distributor_id = ?'
        ).bind(id, distributorId).run()
        return (meta.changes ?? 0) > 0
    }

    /** Mark all notifications as read */
    async markAllRead(distributorId: number): Promise<number> {
        const { meta } = await this.db.prepare(
            'UPDATE notifications SET is_read = 1 WHERE distributor_id = ? AND is_read = 0'
        ).bind(distributorId).run()
        return meta.changes ?? 0
    }

    /** Get notification preferences */
    async getPreferences(distributorId: number): Promise<any[]> {
        const { results } = await this.db.prepare(
            'SELECT * FROM notification_preferences WHERE distributor_id = ?'
        ).bind(distributorId).all()
        return results
    }

    /** Update notification preferences (upsert) */
    async updatePreferences(distributorId: number, preferences: { event_type: string; enabled: boolean; channel?: string; webhook_url?: string }[]): Promise<void> {
        const stmts = preferences.map(p =>
            this.db.prepare(
                `INSERT INTO notification_preferences (distributor_id, event_type, enabled, channel, webhook_url)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(distributor_id, event_type) DO UPDATE SET enabled = ?, channel = ?, webhook_url = ?`
            ).bind(
                distributorId,
                p.event_type,
                p.enabled ? 1 : 0,
                p.channel || 'IN_APP',
                p.webhook_url || null,
                p.enabled ? 1 : 0,
                p.channel || 'IN_APP',
                p.webhook_url || null,
            )
        )
        if (stmts.length > 0) {
            await this.db.batch(stmts)
        }
    }

    // ===== Preset notification helpers =====

    async notifyOrderShipped(distributorId: number, orderId: number, tracking: string): Promise<void> {
        await this.create({
            distributorId,
            type: 'ORDER_SHIPPED',
            title: '出荷完了',
            message: `注文 #${orderId} が発送されました。追跡番号: ${tracking}`,
            relatedResourceType: 'order',
            relatedResourceId: String(orderId),
        })
    }

    async notifyOrderDelivered(distributorId: number, orderId: number): Promise<void> {
        await this.create({
            distributorId,
            type: 'ORDER_DELIVERED',
            title: '配達完了',
            message: `注文 #${orderId} が配達されました。`,
            relatedResourceType: 'order',
            relatedResourceId: String(orderId),
        })
    }

    async notifyOrderCancelled(distributorId: number, orderId: number): Promise<void> {
        await this.create({
            distributorId,
            type: 'ORDER_CANCELLED',
            title: '注文キャンセル',
            message: `注文 #${orderId} がキャンセルされました。`,
            relatedResourceType: 'order',
            relatedResourceId: String(orderId),
        })
    }

    async notifyImportComplete(distributorId: number, type: string, success: number, errors: number): Promise<void> {
        await this.create({
            distributorId,
            type: 'IMPORT_COMPLETE',
            title: 'インポート完了',
            message: `${type} インポート完了: ${success}件成功, ${errors}件エラー`,
            relatedResourceType: 'import',
        })
    }
}
