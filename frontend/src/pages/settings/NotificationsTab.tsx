import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff, Send, Loader2 } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

interface NotificationsTabProps {
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void
}

export function NotificationsTab({ addToast }: NotificationsTabProps) {
  const { t } = useTranslation()
  const { supported, permission, isSubscribed, loading, subscribe, unsubscribe, testPush } =
    usePushNotifications()
  const [testing, setTesting] = useState(false)

  async function handleToggle() {
    try {
      if (isSubscribed) {
        await unsubscribe()
        addToast('info', t('push.disabled', 'Push notifications disabled'))
      } else {
        await subscribe()
        addToast('success', t('push.enabled', 'Push notifications enabled'))
      }
    } catch (err) {
      addToast('error', (err as Error).message || t('push.error', 'Failed to toggle push'))
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const result = await testPush()
      if (result.sent > 0) {
        addToast('success', t('push.testSent', 'Test notification sent'))
      } else {
        addToast('warning', t('push.testFailed', 'No active subscriptions to send to'))
      }
    } catch (err) {
      addToast('error', (err as Error).message || t('push.testError', 'Failed to send test'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Push notifications */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/15">
              <Bell className="h-5 w-5 text-accent-purple" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">
                {t('push.title', 'Push Notifications')}
              </h3>
              <p className="text-sm text-text-muted">
                {t('push.description', 'Receive real-time notifications even when the app is closed')}
              </p>
            </div>
          </div>

          {!supported ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-sm text-amber-400">
                {t('push.notSupported', 'Push notifications are not supported in this browser')}
              </p>
            </div>
          ) : permission === 'denied' ? (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-sm text-red-400">
                {t('push.permissionDenied', 'Push notification permission was denied. Please enable it in your browser settings.')}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleToggle}
                loading={loading}
                variant={isSubscribed ? 'secondary' : 'primary'}
              >
                {isSubscribed ? (
                  <>
                    <BellOff size={16} />
                    {t('push.disable', 'Disable')}
                  </>
                ) : (
                  <>
                    <Bell size={16} />
                    {t('push.enable', 'Enable')}
                  </>
                )}
              </Button>

              {isSubscribed && (
                <Button
                  onClick={handleTest}
                  variant="secondary"
                  size="sm"
                  disabled={testing}
                >
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {t('push.test', 'Test')}
                </Button>
              )}
            </div>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <div
              className={`h-2 w-2 rounded-full ${
                isSubscribed ? 'bg-emerald-400' : 'bg-text-muted'
              }`}
            />
            {isSubscribed
              ? t('push.statusActive', 'Active — notifications will be delivered')
              : t('push.statusInactive', 'Inactive — enable to receive notifications')}
          </div>
        </CardContent>
      </Card>

      {/* Notification event preferences */}
      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-semibold text-text-primary">
            {t('push.eventPreferences', 'Event Preferences')}
          </h3>
          <p className="text-sm text-text-muted">
            {t('push.eventDescription', 'Choose which events trigger push notifications')}
          </p>

          <div className="space-y-2">
            {[
              { key: 'ORDER_SHIPPED', label: t('push.event.orderShipped', 'Order Shipped') },
              { key: 'ORDER_DELIVERED', label: t('push.event.orderDelivered', 'Order Delivered') },
              { key: 'ORDER_CANCELLED', label: t('push.event.orderCancelled', 'Order Cancelled') },
              { key: 'LOW_STOCK', label: t('push.event.lowStock', 'Low Stock Alert') },
              { key: 'COMMISSION_SETTLED', label: t('push.event.commissionSettled', 'Commission Settled') },
              { key: 'IMPORT_COMPLETE', label: t('push.event.importComplete', 'Import Complete') },
            ].map((event) => (
              <label
                key={event.key}
                className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-bg-card-hover transition-colors"
              >
                <span className="text-sm text-text-primary">{event.label}</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-border accent-accent-purple"
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
