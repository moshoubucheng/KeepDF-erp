import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Lock, Smartphone, ShieldCheck, ShieldOff } from 'lucide-react'
import type { User as UserType } from '@/api/types'
import { authApi } from '@/api/endpoints/auth'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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

interface SecurityTabProps {
  user: UserType | null
  addToast: (type: 'success' | 'error', message: string) => void
  fetchMe: () => Promise<void>
}

export function SecurityTab({ user, addToast, fetchMe }: SecurityTabProps) {
  const { t } = useTranslation()
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle')
  const [otpauthUri, setOtpauthUri] = useState('')
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
      setOtpauthUri(data.otpauth_uri)
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
      setOtpauthUri('')
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

  const is2FAEnabled = !!user?.totp_enabled

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

              {twoFAStep === 'verify' && otpauthUri ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-bg-input border border-border">
                    <p className="text-sm text-text-secondary mb-2">
                      {t('settings.enterSecretManually', 'Add this account to your authenticator app:')}
                    </p>
                    <div className="mt-2 p-3 bg-bg-secondary rounded-lg">
                      <p className="text-xs text-text-muted mb-1">Secret Key:</p>
                      <p className="font-mono text-sm text-accent-purple break-all select-all">
                        {otpauthUri.includes('secret=')
                          ? new URLSearchParams(otpauthUri.split('?')[1]).get('secret')
                          : otpauthUri}
                      </p>
                    </div>
                    <p className="text-xs text-text-muted mt-2 break-all">
                      {otpauthUri}
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
                        setOtpauthUri('')
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
