/**
 * NotificationService - 运营监控与异常通知
 * 支持 Lark / Slack / Line Notify 的 Webhook 通知
 */
export class NotificationService {
    constructor(private db: D1Database) { }

    /** 发送通知（统一入口） */
    async send(params: {
        type: 'INFO' | 'WARNING' | 'CRITICAL'
        channel: string
        message: string
        webhookUrl?: string
    }): Promise<void> {
        const { type, channel, message, webhookUrl } = params

        // 1. 记录到 D1
        await this.db.prepare(
            'INSERT INTO notification_logs (type, channel, message) VALUES (?, ?, ?)'
        ).bind(type, channel, message).run()

        // 2. 发送 Webhook（如果配置了 URL）
        if (webhookUrl) {
            try {
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.formatPayload(channel, type, message)),
                })

                if (!response.ok) {
                    console.error(`Webhook failed (${channel}): ${response.status}`)
                }
            } catch (error) {
                console.error(`Webhook error (${channel}):`, error)
            }
        }
    }

    /** 格式化不同平台的 Payload */
    private formatPayload(channel: string, type: string, message: string): object {
        const icon = type === 'CRITICAL' ? '🚨' : type === 'WARNING' ? '⚠️' : 'ℹ️'
        const formattedMsg = `${icon} [${type}] ${message}`

        switch (channel.toUpperCase()) {
            case 'SLACK':
                return { text: formattedMsg }
            case 'LARK':
                return { msg_type: 'text', content: { text: formattedMsg } }
            case 'LINE':
                return { message: formattedMsg }
            default:
                return { text: formattedMsg }
        }
    }

    // ===== 预设的异常场景通知 =====

    /** 库存低水位 */
    async alertLowStock(sku: string, qty: number, webhookUrl?: string) {
        await this.send({
            type: 'WARNING',
            channel: 'SLACK',
            message: `庫存低水位: ${sku} 僅剩 ${qty} 件`,
            webhookUrl,
        })
    }

    /** API 连续失败 */
    async alertApiFailure(platform: string, count: number, webhookUrl?: string) {
        await this.send({
            type: 'CRITICAL',
            channel: 'SLACK',
            message: `${platform} API 連續 ${count} 次失敗`,
            webhookUrl,
        })
    }

    /** Token 即将过期 */
    async alertTokenExpiring(platform: string, hoursLeft: number, webhookUrl?: string) {
        await this.send({
            type: 'WARNING',
            channel: 'LARK',
            message: `${platform} Token 將在 ${hoursLeft} 小時後過期`,
            webhookUrl,
        })
    }

    /** 充值待审 */
    async alertRechargeRequest(distributorName: string, amount: number, webhookUrl?: string) {
        await this.send({
            type: 'INFO',
            channel: 'LARK',
            message: `分銷商 ${distributorName} 申請充值 ¥${amount.toLocaleString()}`,
            webhookUrl,
        })
    }

    /** Send email via external SMTP relay (MailChannels / Resend) */
    async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
        try {
            // Log the email attempt
            await this.db.prepare(
                'INSERT INTO notification_logs (type, channel, message) VALUES (?, ?, ?)'
            ).bind('INFO', 'EMAIL', `To: ${to}, Subject: ${subject}`).run()

            // In production, this would use MailChannels Workers API or Resend
            // For now, we log and return success (actual sending requires env config)
            console.log(`[EMAIL] To: ${to}, Subject: ${subject}`)
            return true
        } catch (error) {
            console.error('[EMAIL] Send failed:', error)
            return false
        }
    }
}
