import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Settings,
  Save,
  ShieldCheck,
  ShieldOff,
  Users,
  Database,
  RotateCcw,
} from 'lucide-react'
import { settingsApi } from '@/api/endpoints/settings'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/data/DataTable'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'

interface SystemTabProps {
  addToast: (type: 'success' | 'error', message: string) => void
}

export function SystemTab({ addToast }: SystemTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // System settings query
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getConfig(),
  })

  // System info query
  const systemInfoQuery = useQuery({
    queryKey: ['settings', 'system-info'],
    queryFn: () => settingsApi.systemInfo(),
  })

  // Users query
  const usersQuery = useQuery({
    queryKey: ['settings', 'users'],
    queryFn: () => settingsApi.users(),
  })

  const [lowStockThreshold, setLowStockThreshold] = useState('')
  const [defaultCarrier, setDefaultCarrier] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Initialize form values when settings load
  const settingsData = settingsQuery.data?.config as Record<string, string> | undefined
  useEffect(() => {
    if (settingsData && !initialized) {
      if (settingsData.low_stock_threshold) setLowStockThreshold(settingsData.low_stock_threshold)
      if (settingsData.default_carrier) setDefaultCarrier(settingsData.default_carrier)
      setInitialized(true)
    }
  }, [settingsData, initialized])

  const updateSettings = useMutation({
    mutationFn: (data: Record<string, string>) => settingsApi.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      addToast('success', t('settings.settingsSaved', 'Settings saved successfully'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.settingsError', 'Failed to save settings'))
    },
  })

  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      settingsApi.resetPassword(userId, password),
    onSuccess: () => {
      addToast('success', t('settings.passwordReset', 'Password reset successfully'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.passwordResetError', 'Failed to reset password'))
    },
  })

  const disableUser2FA = useMutation({
    mutationFn: (userId: number) => settingsApi.disable2FA(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'users'] })
      addToast('success', t('settings.user2faDisabled', '2FA disabled for user'))
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.user2faError', 'Failed to disable 2FA'))
    },
  })

  function handleSaveConfig() {
    const data: Record<string, string> = {}
    if (lowStockThreshold) data.low_stock_threshold = lowStockThreshold
    if (defaultCarrier) data.default_carrier = defaultCarrier
    updateSettings.mutate(data)
  }

  function handleResetPassword(userId: number, userName: string) {
    const newPassword = window.prompt(
      t('settings.enterNewPassword', 'Enter new password for {{name}}:', { name: userName }),
    )
    if (newPassword && newPassword.length >= 8) {
      resetPassword.mutate({ userId, password: newPassword })
    } else if (newPassword) {
      addToast('error', t('settings.passwordTooShort', 'Password must be at least 8 characters'))
    }
  }

  function handleDisableUser2FA(userId: number) {
    if (window.confirm(t('settings.confirmDisableUser2FA', 'Are you sure you want to disable 2FA for this user?'))) {
      disableUser2FA.mutate(userId)
    }
  }

  const counts = systemInfoQuery.data?.counts ?? {}
  const users = usersQuery.data?.distributors ?? []

  type UserRow = { id: number; name: string; username: string; role: string; totp_enabled: number; created_at: string }

  const userColumns: Column<UserRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (row) => <span className="font-mono text-xs text-text-muted">#{row.id}</span>,
    },
    {
      key: 'name',
      header: t('settings.userName', 'Name'),
      render: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    {
      key: 'username',
      header: t('settings.username', 'Username'),
      render: (row) => <span className="font-mono text-xs">{row.username}</span>,
    },
    {
      key: 'role',
      header: t('settings.role', 'Role'),
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            row.role === 'admin'
              ? 'bg-purple-500/15 text-purple-400'
              : 'bg-blue-500/15 text-blue-400',
          )}
        >
          {row.role}
        </span>
      ),
    },
    {
      key: 'totp_enabled',
      header: '2FA',
      render: (row) =>
        row.totp_enabled ? (
          <ShieldCheck size={16} className="text-emerald-400" />
        ) : (
          <ShieldOff size={16} className="text-text-muted" />
        ),
    },
    {
      key: 'created_at',
      header: t('settings.createdAt', 'Created'),
      render: (row) => (
        <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: t('common.actions', 'Actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              handleResetPassword(row.id, row.name)
            }}
          >
            <RotateCcw size={12} />
            {t('settings.resetPW', 'Reset PW')}
          </Button>
          {row.totp_enabled && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation()
                handleDisableUser2FA(row.id)
              }}
            >
              <ShieldOff size={12} />
              {t('settings.disable2FAShort', '2FA Off')}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* System Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database size={18} className="text-accent-purple" />
            <h3 className="text-text-primary font-semibold text-base">
              {t('settings.systemInfo', 'System Information')}
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          {systemInfoQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
            </div>
          ) : Object.keys(counts).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(counts).map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 rounded-lg bg-bg-input border border-border"
                >
                  <span className="text-xs text-text-muted font-mono truncate mr-2">
                    {name}
                  </span>
                  <span className="text-sm font-semibold text-text-primary tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {t('settings.noTableData', 'No table information available')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Business Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-accent-emerald" />
            <h3 className="text-text-primary font-semibold text-base">
              {t('settings.businessConfig', 'Business Configuration')}
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
            <Input
              label={t('settings.lowStockThreshold', 'Low Stock Threshold')}
              type="number"
              min={0}
              placeholder="10"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
            <Input
              label={t('settings.defaultCarrier', 'Default Carrier')}
              placeholder="YAMATO"
              value={defaultCarrier}
              onChange={(e) => setDefaultCarrier(e.target.value)}
            />
            <div className="md:col-span-2 flex justify-end pt-2">
              <Button
                loading={updateSettings.isPending}
                onClick={handleSaveConfig}
              >
                <Save size={16} />
                {t('common.save', 'Save')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users size={18} className="text-accent-blue" />
            <h3 className="text-text-primary font-semibold text-base">
              {t('settings.userManagement', 'User Management')}
            </h3>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={userColumns}
            data={users}
            loading={usersQuery.isLoading}
            emptyMessage={t('settings.noUsers', 'No users found')}
          />
        </CardContent>
      </Card>
    </div>
  )
}
