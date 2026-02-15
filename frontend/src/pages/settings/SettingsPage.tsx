import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  User,
  Shield,
  Settings,
  Save,
  Lock,
  Smartphone,
  ShieldCheck,
  ShieldOff,
  Users,
  Database,
  RotateCcw,
} from 'lucide-react'
import type { User as UserType } from '@/api/types'
import { authApi } from '@/api/endpoints/auth'
import { settingsApi } from '@/api/endpoints/settings'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/data/DataTable'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'

// ─── Schema definitions ─────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_reg_number: z.string().optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

// ─── Tab definitions ────────────────────────────────────────────────

type TabId = 'profile' | 'security' | 'system'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

// ─── Main component ─────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, isAdmin, fetchMe } = useAuthStore()
  const addToast = useUIStore((s) => s.addToast)
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  const tabs: Tab[] = [
    { id: 'profile', label: t('settings.profile', 'Profile'), icon: <User size={16} /> },
    { id: 'security', label: t('settings.security', 'Security'), icon: <Shield size={16} /> },
    { id: 'system', label: t('settings.system', 'System'), icon: <Settings size={16} />, adminOnly: true },
  ]

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('settings.title', 'Settings')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('settings.subtitle', 'Manage your account and system configuration')}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-accent-purple text-accent-purple'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && <ProfileTab user={user} addToast={addToast} fetchMe={fetchMe} />}
      {activeTab === 'security' && <SecurityTab user={user} addToast={addToast} fetchMe={fetchMe} />}
      {activeTab === 'system' && isAdmin && <SystemTab addToast={addToast} />}
    </div>
  )
}

// ─── Profile Tab ────────────────────────────────────────────────────

function ProfileTab({
  user,
  addToast,
  fetchMe,
}: {
  user: UserType | null
  addToast: (type: 'success' | 'error', message: string) => void
  fetchMe: () => Promise<void>
}) {
  const { t } = useTranslation()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      contact_person: '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      address: '',
      tax_reg_number: '',
    },
  })

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: async () => {
      addToast('success', t('settings.profileSaved', 'Profile updated successfully'))
      await fetchMe()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.profileError', 'Failed to update profile'))
    },
  })

  function handleProfileSave(data: ProfileForm) {
    updateProfile.mutate(data)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User size={18} className="text-accent-purple" />
          <h3 className="text-text-primary font-semibold text-base">
            {t('settings.companyProfile', 'Company Profile')}
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={profileForm.handleSubmit(handleProfileSave)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl"
        >
          <Input
            label={t('settings.companyName', 'Company Name')}
            placeholder={t('settings.companyNamePlaceholder', 'Your company name')}
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register('name')}
          />
          <Input
            label={t('settings.contactPerson', 'Contact Person')}
            placeholder={t('settings.contactPersonPlaceholder', 'Contact person name')}
            error={profileForm.formState.errors.contact_person?.message}
            {...profileForm.register('contact_person')}
          />
          <Input
            label={t('settings.email', 'Email')}
            type="email"
            placeholder="info@example.com"
            error={profileForm.formState.errors.email?.message}
            {...profileForm.register('email')}
          />
          <Input
            label={t('settings.phone', 'Phone')}
            placeholder="03-1234-5678"
            error={profileForm.formState.errors.phone?.message}
            {...profileForm.register('phone')}
          />
          <div className="md:col-span-2">
            <Input
              label={t('settings.address', 'Address')}
              placeholder={t('settings.addressPlaceholder', 'Business address')}
              error={profileForm.formState.errors.address?.message}
              {...profileForm.register('address')}
            />
          </div>
          <Input
            label={t('settings.taxRegNumber', 'Tax Registration Number')}
            placeholder="T1234567890123"
            error={profileForm.formState.errors.tax_reg_number?.message}
            {...profileForm.register('tax_reg_number')}
          />
          <div className="md:col-span-2 flex justify-end pt-2">
            <Button type="submit" loading={updateProfile.isPending}>
              <Save size={16} />
              {t('common.save', 'Save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Security Tab ───────────────────────────────────────────────────

function SecurityTab({
  user,
  addToast,
  fetchMe,
}: {
  user: UserType | null
  addToast: (type: 'success' | 'error', message: string) => void
  fetchMe: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle')
  const [qrUrl, setQrUrl] = useState('')
  const [totpCode, setTotpCode] = useState('')

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const changePassword = useMutation({
    mutationFn: (data: PasswordForm) =>
      authApi.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      }),
    onSuccess: () => {
      addToast('success', t('settings.passwordChanged', 'Password changed successfully'))
      passwordForm.reset()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.passwordError', 'Failed to change password'))
    },
  })

  const setup2FA = useMutation({
    mutationFn: () => authApi.setup2FA(),
    onSuccess: (data) => {
      setQrUrl(data.qr_url)
      setTwoFAStep('verify')
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.2faSetupError', 'Failed to set up 2FA'))
      setTwoFAStep('idle')
    },
  })

  const enable2FA = useMutation({
    mutationFn: (code: string) => authApi.enable2FA(code),
    onSuccess: async () => {
      addToast('success', t('settings.2faEnabled', '2FA enabled successfully'))
      setTwoFAStep('idle')
      setTotpCode('')
      setQrUrl('')
      await fetchMe()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.2faEnableError', 'Invalid verification code'))
    },
  })

  const disable2FA = useMutation({
    mutationFn: (code: string) => authApi.disable2FA(code),
    onSuccess: async () => {
      addToast('success', t('settings.2faDisabled', '2FA disabled successfully'))
      setTwoFAStep('idle')
      setTotpCode('')
      await fetchMe()
    },
    onError: (err: Error) => {
      addToast('error', err.message || t('settings.2faDisableError', 'Failed to disable 2FA'))
    },
  })

  function handlePasswordChange(data: PasswordForm) {
    changePassword.mutate(data)
  }

  function handleEnable2FA() {
    if (twoFAStep === 'idle') {
      setTwoFAStep('setup')
      setup2FA.mutate()
    }
  }

  function handleVerify2FA() {
    if (totpCode.length === 6) {
      enable2FA.mutate(totpCode)
    }
  }

  function handleDisable2FA() {
    if (twoFAStep === 'disable' && totpCode.length === 6) {
      disable2FA.mutate(totpCode)
    }
  }

  const is2FAEnabled = user?.totp_enabled === 1

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-accent-amber" />
            <h3 className="text-text-primary font-semibold text-base">
              {t('settings.changePassword', 'Change Password')}
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit(handlePasswordChange)}
            className="space-y-4 max-w-md"
          >
            <Input
              label={t('settings.currentPassword', 'Current Password')}
              type="password"
              autoComplete="current-password"
              error={passwordForm.formState.errors.current_password?.message}
              {...passwordForm.register('current_password')}
            />
            <Input
              label={t('settings.newPassword', 'New Password')}
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.new_password?.message}
              {...passwordForm.register('new_password')}
            />
            <Input
              label={t('settings.confirmPassword', 'Confirm New Password')}
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.confirm_password?.message}
              {...passwordForm.register('confirm_password')}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={changePassword.isPending}>
                <Lock size={16} />
                {t('settings.updatePassword', 'Update Password')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone size={18} className="text-accent-blue" />
            <h3 className="text-text-primary font-semibold text-base">
              {t('settings.twoFactorAuth', 'Two-Factor Authentication')}
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          {is2FAEnabled ? (
            <div className="space-y-4 max-w-md">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">
                    {t('settings.2faActive', '2FA is active')}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t('settings.2faActiveDesc', 'Your account is protected with two-factor authentication')}
                  </p>
                </div>
              </div>

              {twoFAStep === 'disable' ? (
                <div className="space-y-3">
                  <Input
                    label={t('settings.verificationCode', 'Verification Code')}
                    placeholder="000000"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTwoFAStep('idle')
                        setTotpCode('')
                      }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      loading={disable2FA.isPending}
                      disabled={totpCode.length !== 6}
                      onClick={handleDisable2FA}
                    >
                      <ShieldOff size={16} />
                      {t('settings.confirmDisable', 'Confirm Disable')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => {
                    setTwoFAStep('disable')
                    setTotpCode('')
                  }}
                >
                  <ShieldOff size={16} />
                  {t('settings.disable2FA', 'Disable 2FA')}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <ShieldOff size={20} className="text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-400">
                    {t('settings.2faInactive', '2FA is not enabled')}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t('settings.2faInactiveDesc', 'Enable two-factor authentication for added security')}
                  </p>
                </div>
              </div>

              {twoFAStep === 'verify' && qrUrl ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-bg-input border border-border">
                    <p className="text-sm text-text-secondary mb-2">
                      {t('settings.scanQrCode', 'Scan this QR code with your authenticator app:')}
                    </p>
                    <div className="flex justify-center py-3">
                      <img
                        src={qrUrl}
                        alt="2FA QR Code"
                        className="w-48 h-48 rounded-lg bg-white p-2"
                      />
                    </div>
                    <p className="text-xs text-text-muted text-center mt-2 break-all">
                      {qrUrl}
                    </p>
                  </div>
                  <Input
                    label={t('settings.verificationCode', 'Verification Code')}
                    placeholder="000000"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTwoFAStep('idle')
                        setTotpCode('')
                        setQrUrl('')
                      }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                      loading={enable2FA.isPending}
                      disabled={totpCode.length !== 6}
                      onClick={handleVerify2FA}
                    >
                      <ShieldCheck size={16} />
                      {t('settings.verify2FA', 'Verify & Enable')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  loading={setup2FA.isPending}
                  onClick={handleEnable2FA}
                >
                  <ShieldCheck size={16} />
                  {t('settings.enable2FA', 'Enable 2FA')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── System Tab (Admin Only) ────────────────────────────────────────

function SystemTab({
  addToast,
}: {
  addToast: (type: 'success' | 'error', message: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // System settings query
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll(),
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
  const settingsData = settingsQuery.data?.settings
  useEffect(() => {
    if (settingsData && !initialized) {
      if (settingsData.low_stock_threshold) setLowStockThreshold(settingsData.low_stock_threshold)
      if (settingsData.default_carrier) setDefaultCarrier(settingsData.default_carrier)
      setInitialized(true)
    }
  }, [settingsData, initialized])

  const updateSettings = useMutation({
    mutationFn: (data: Record<string, string>) => settingsApi.update(data),
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

  const tables = settingsQuery.data?.tables ?? []
  const users = usersQuery.data?.users ?? []

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
          {row.totp_enabled === 1 && (
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
          {settingsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
            </div>
          ) : tables.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {tables.map((table) => (
                <div
                  key={table.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-bg-input border border-border"
                >
                  <span className="text-xs text-text-muted font-mono truncate mr-2">
                    {table.name}
                  </span>
                  <span className="text-sm font-semibold text-text-primary tabular-nums">
                    {table.count}
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
