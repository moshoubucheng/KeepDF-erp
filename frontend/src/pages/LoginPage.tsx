import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { LangSwitcher } from '@/components/layout/LangSwitcher'

// ---------- Zod Schemas ----------

const passwordSchema = z.object({
  username: z.string().min(1, 'auth.username'),
  password: z.string().min(1, 'auth.password'),
})

const tokenSchema = z.object({
  token: z.string().min(1, 'error.invalid_token'),
})

const totpSchema = z.object({
  code: z
    .string()
    .length(6, 'auth.2fa_code')
    .regex(/^\d{6}$/, 'auth.2fa_code'),
})

type PasswordForm = z.infer<typeof passwordSchema>
type TokenForm = z.infer<typeof tokenSchema>
type TotpForm = z.infer<typeof totpSchema>

type LoginMode = 'password' | 'token'

// ---------- Component ----------

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const addToast = useUIStore((s) => s.addToast)
  const { loginWithPassword, setToken, fetchMe, verify2FA } = useAuthStore()

  const [mode, setMode] = useState<LoginMode>('password')
  const [showPassword, setShowPassword] = useState(false)
  const [show2FA, setShow2FA] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Where to redirect after login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  // ---------- Password form ----------

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { username: '', password: '' },
  })

  const handlePasswordLogin = async (data: PasswordForm) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await loginWithPassword(data.username, data.password)
      if (result.requires_2fa && result.temp_token) {
        setTempToken(result.temp_token)
        setShow2FA(true)
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error.login_failed')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Token form ----------

  const tokenForm = useForm<TokenForm>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { token: '' },
  })

  const handleTokenLogin = async (data: TokenForm) => {
    setSubmitting(true)
    setError(null)
    try {
      setToken(data.token)
      await fetchMe()
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error.login_failed')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- 2FA form ----------

  const totpForm = useForm<TotpForm>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: '' },
  })

  const handle2FA = async (data: TotpForm) => {
    if (!tempToken) return
    setSubmitting(true)
    setError(null)
    try {
      await verify2FA(tempToken, data.code)
      addToast('success', t('common.success'))
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error.login_failed')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Mode toggle ----------

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setError(null)
    setShow2FA(false)
    setTempToken(null)
  }

  // ---------- Render ----------

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="relative w-full max-w-[400px] rounded-xl border border-border bg-bg-card p-12 shadow-2xl max-[480px]:mx-4 max-[480px]:p-8">
        {/* Language switcher */}
        <div className="absolute right-4 top-4">
          <LangSwitcher />
        </div>

        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">&#9889;</div>
          <h1 className="text-2xl font-bold text-text-primary">KeepDF</h1>
          <p className="mt-1 text-sm text-text-muted">{t('brand.tagline')}</p>
        </div>

        {/* ---- 2FA Step ---- */}
        {show2FA ? (
          <form onSubmit={totpForm.handleSubmit(handle2FA)} noValidate>
            <h3 className="mb-5 text-center text-base font-semibold text-text-primary">
              {t('auth.2fa_title')}
            </h3>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-medium text-text-secondary">
                {t('auth.2fa_code')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
                className="w-full rounded-lg border border-border bg-bg-input px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-purple"
                {...totpForm.register('code')}
              />
              {totpForm.formState.errors.code && (
                <p className="mt-1.5 text-xs text-red-400">
                  {t(totpForm.formState.errors.code.message ?? '')}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent-purple to-purple-700 px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t('auth.2fa_verifying') : t('auth.2fa_verify')}
            </button>

            {error && (
              <p className="mt-4 text-center text-[13px] text-red-400">{error}</p>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setShow2FA(false)
                  setTempToken(null)
                  setError(null)
                }}
                className="text-[13px] text-accent-purple hover:underline"
              >
                {t('auth.password_login')}
              </button>
            </div>
          </form>
        ) : mode === 'password' ? (
          /* ---- Password Login ---- */
          <form onSubmit={passwordForm.handleSubmit(handlePasswordLogin)} noValidate>
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-medium text-text-secondary">
                {t('auth.username')}
              </label>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="admin"
                className="w-full rounded-lg border border-border bg-bg-input px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-purple"
                {...passwordForm.register('username')}
              />
              {passwordForm.formState.errors.username && (
                <p className="mt-1.5 text-xs text-red-400">
                  {t(passwordForm.formState.errors.username.message ?? '')}
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-medium text-text-secondary">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border bg-bg-input px-4 py-3 pr-10 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-purple"
                  {...passwordForm.register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.password && (
                <p className="mt-1.5 text-xs text-red-400">
                  {t(passwordForm.formState.errors.password.message ?? '')}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent-purple to-purple-700 px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t('auth.logging_in') : t('auth.login')}
            </button>

            {error && (
              <p className="mt-4 text-center text-[13px] text-red-400">{error}</p>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => switchMode('token')}
                className="text-[13px] text-accent-purple hover:underline"
              >
                {t('auth.token_login')}
              </button>
            </div>
          </form>
        ) : (
          /* ---- Token Login ---- */
          <form onSubmit={tokenForm.handleSubmit(handleTokenLogin)} noValidate>
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-medium text-text-secondary">
                {t('auth.token')}
              </label>
              <input
                type="text"
                autoComplete="off"
                autoFocus
                placeholder="tok_xxxxxxxx"
                className="w-full rounded-lg border border-border bg-bg-input px-4 py-3 text-sm font-mono text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-purple"
                {...tokenForm.register('token')}
              />
              {tokenForm.formState.errors.token && (
                <p className="mt-1.5 text-xs text-red-400">
                  {t(tokenForm.formState.errors.token.message ?? '')}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent-purple to-purple-700 px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t('auth.logging_in') : t('auth.login')}
            </button>

            {error && (
              <p className="mt-4 text-center text-[13px] text-red-400">{error}</p>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => switchMode('password')}
                className="text-[13px] text-accent-purple hover:underline"
              >
                {t('auth.password_login')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
