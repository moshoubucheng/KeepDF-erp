import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import {
  Zap,
  Building2,
  Globe2,
  Package,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  PartyPopper,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { LangSwitcher } from '@/components/layout/LangSwitcher'
import { useAuthStore } from '@/stores/auth.store'
import { useUIStore } from '@/stores/ui.store'
import { authApi } from '@/api/endpoints/auth'
import { inventoryApi } from '@/api/endpoints/inventory'
import { settingsApi } from '@/api/endpoints/settings'
import type { Platform } from '@/api/types'

/* ------------------------------------------------------------------ */
/*  Step metadata                                                      */
/* ------------------------------------------------------------------ */

const STEPS = [
  { key: 'welcome', icon: Zap },
  { key: 'company', icon: Building2 },
  { key: 'platform', icon: Globe2 },
  { key: 'product', icon: Package },
  { key: 'complete', icon: CheckCircle2 },
] as const

type StepKey = (typeof STEPS)[number]['key']

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const companySchema = z.object({
  company_name: z.string().min(1, 'onboarding.company_name'),
  contact_person: z.string().optional(),
  email: z.string().email('onboarding.email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  tax_reg_number: z.string().optional(),
})
type CompanyFormData = z.infer<typeof companySchema>

const productSchema = z.object({
  sku: z.string().min(1, 'onboarding.product_sku'),
  name_jp: z.string().min(1, 'onboarding.product_name'),
  cost_price: z.coerce.number().min(0),
  tax_category: z.enum(['standard', 'reduced']),
})
type ProductFormData = z.infer<typeof productSchema>

/* ------------------------------------------------------------------ */
/*  Platform card data                                                 */
/* ------------------------------------------------------------------ */

const PLATFORM_CARDS: { id: Platform; label: string; emoji: string; color: string; bg: string }[] = [
  {
    id: 'TIKTOK',
    label: 'TikTok Shop',
    emoji: '\u{1F3B5}',
    color: 'border-pink-500/60 text-pink-400',
    bg: 'bg-pink-500/10 hover:bg-pink-500/20',
  },
  {
    id: 'TEMU',
    label: 'Temu',
    emoji: '\u{1F30D}',
    color: 'border-orange-500/60 text-orange-400',
    bg: 'bg-orange-500/10 hover:bg-orange-500/20',
  },
  {
    id: 'RAKUTEN',
    label: 'Rakuten',
    emoji: '\u{1F6D2}',
    color: 'border-red-500/60 text-red-400',
    bg: 'bg-red-500/10 hover:bg-red-500/20',
  },
]

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const addToast = useUIStore((s) => s.addToast)

  const [step, setStep] = useState(0)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [saving, setSaving] = useState(false)

  /* --- Company form ------------------------------------------------ */
  const companyForm = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: { company_name: '', contact_person: '', email: '', phone: '', tax_reg_number: '' },
  })

  /* --- Product form ------------------------------------------------ */
  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { sku: '', name_jp: '', cost_price: 0, tax_category: 'standard' },
  })

  /* --- Navigation helpers ------------------------------------------ */
  const currentStep: StepKey = STEPS[step].key

  const stepLabel = useCallback(
    (key: StepKey) => {
      const map: Record<StepKey, string> = {
        welcome: t('onboarding.welcome_title'),
        company: t('onboarding.step_company'),
        platform: t('onboarding.step_platform'),
        product: t('onboarding.step_product'),
        complete: t('onboarding.step_complete'),
      }
      return map[key]
    },
    [t],
  )

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), [])
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])

  /* --- Step handlers ----------------------------------------------- */

  const handleCompanySubmit = async (data: CompanyFormData) => {
    setSaving(true)
    try {
      await authApi.updateProfile({
        name: data.company_name,
        contact_person: data.contact_person || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        tax_reg_number: data.tax_reg_number || undefined,
      })
      addToast('success', t('common.success'))
      goNext()
    } catch {
      addToast('error', t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleProductSubmit = async (data: ProductFormData) => {
    setSaving(true)
    try {
      await inventoryApi.create({
        sku: data.sku,
        name_jp: data.name_jp,
        cost_price: data.cost_price,
        tax_category: data.tax_category,
      })
      addToast('success', t('common.success'))
      goNext()
    } catch {
      addToast('error', t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      await settingsApi.completeOnboarding()
      await fetchMe()
      navigate('/dashboard')
    } catch {
      addToast('error', t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  /* ================================================================= */
  /*  Render                                                            */
  /* ================================================================= */

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg-primary px-4 py-8">
      {/* ---- Progress bar ---- */}
      <div className="mb-8 w-full max-w-2xl">
        {/* Step indicators */}
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isCompleted = i < step
            const isActive = i === step
            return (
              <div key={s.key} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 transition-colors duration-300',
                        i <= step ? 'bg-accent-purple' : 'bg-border',
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                      isCompleted && 'border-accent-purple bg-accent-purple text-white',
                      isActive && 'border-accent-purple bg-accent-purple/20 text-accent-purple shadow-lg shadow-accent-purple/25',
                      !isCompleted && !isActive && 'border-border bg-bg-card text-text-muted',
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 transition-colors duration-300',
                        i < step ? 'bg-accent-purple' : 'bg-border',
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-center text-xs font-medium transition-colors',
                    isActive ? 'text-accent-purple' : isCompleted ? 'text-text-primary' : 'text-text-muted',
                  )}
                >
                  {stepLabel(s.key)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Linear progress bar */}
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-blue transition-all duration-500 ease-out"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* ---- Step content card ---- */}
      <Card className="w-full max-w-lg shadow-xl">
        <div className="px-8 py-8">
          {/* ========== STEP 1: Welcome ========== */}
          {currentStep === 'welcome' && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple to-accent-blue shadow-lg shadow-accent-purple/30">
                <Zap className="h-10 w-10 text-white" />
              </div>

              <h1 className="mb-2 text-2xl font-bold text-text-primary">
                {t('onboarding.welcome_title')}
              </h1>
              <p className="mb-8 text-text-secondary">{t('onboarding.welcome_desc')}</p>

              <div className="mb-8 flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-text-secondary">
                  {t('onboarding.select_language')}
                </span>
                <LangSwitcher />
              </div>

              <Button size="lg" className="w-full" onClick={goNext}>
                {t('onboarding.next')}
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}

          {/* ========== STEP 2: Company ========== */}
          {currentStep === 'company' && (
            <form onSubmit={companyForm.handleSubmit(handleCompanySubmit)} className="flex flex-col gap-4">
              <div className="mb-2 text-center">
                <Building2 className="mx-auto mb-2 h-8 w-8 text-accent-purple" />
                <h2 className="text-lg font-semibold text-text-primary">{t('onboarding.step_company')}</h2>
              </div>

              <Input
                label={t('onboarding.company_name')}
                placeholder={t('onboarding.company_name')}
                error={companyForm.formState.errors.company_name?.message}
                {...companyForm.register('company_name')}
              />
              <Input
                label={t('onboarding.contact_person')}
                placeholder={t('onboarding.contact_person')}
                {...companyForm.register('contact_person')}
              />
              <Input
                label={t('onboarding.email')}
                type="email"
                placeholder="mail@example.com"
                error={companyForm.formState.errors.email?.message}
                {...companyForm.register('email')}
              />
              <Input
                label={t('onboarding.phone')}
                type="tel"
                placeholder="03-xxxx-xxxx"
                {...companyForm.register('phone')}
              />
              <Input
                label={t('onboarding.tax_reg')}
                placeholder="T1234567890123"
                {...companyForm.register('tax_reg_number')}
              />

              {/* Buttons */}
              <div className="mt-4 flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" />
                  {t('onboarding.back')}
                </Button>
                <div className="flex-1" />
                <Button type="submit" loading={saving}>
                  {t('onboarding.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {/* ========== STEP 3: Platform ========== */}
          {currentStep === 'platform' && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <Globe2 className="mx-auto mb-2 h-8 w-8 text-accent-purple" />
                <h2 className="text-lg font-semibold text-text-primary">{t('onboarding.step_platform')}</h2>
                <p className="mt-1 text-sm text-text-secondary">{t('onboarding.platform_desc')}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PLATFORM_CARDS.map((p) => {
                  const selected = selectedPlatforms.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 transition-all duration-200',
                        p.bg,
                        selected ? p.color + ' ring-2 ring-offset-2 ring-offset-bg-primary ring-accent-purple' : 'border-border',
                      )}
                    >
                      <span className="text-3xl">{p.emoji}</span>
                      <span className={cn('text-sm font-semibold', selected ? '' : 'text-text-primary')}>
                        {p.label}
                      </span>
                      {selected && <CheckCircle2 className="h-5 w-5 text-accent-purple" />}
                    </button>
                  )
                })}
              </div>

              {/* Buttons */}
              <div className="mt-2 flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" />
                  {t('onboarding.back')}
                </Button>
                <div className="flex-1" />
                <Button type="button" variant="secondary" onClick={goNext}>
                  <SkipForward className="h-4 w-4" />
                  {t('onboarding.skip')}
                </Button>
                <Button type="button" onClick={goNext}>
                  {t('onboarding.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========== STEP 4: First Product ========== */}
          {currentStep === 'product' && (
            <form onSubmit={productForm.handleSubmit(handleProductSubmit)} className="flex flex-col gap-4">
              <div className="mb-2 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-accent-purple" />
                <h2 className="text-lg font-semibold text-text-primary">{t('onboarding.step_product')}</h2>
                <p className="mt-1 text-sm text-text-secondary">{t('onboarding.product_desc')}</p>
              </div>

              <Input
                label={t('onboarding.product_sku')}
                placeholder="SKU-001"
                error={productForm.formState.errors.sku?.message}
                {...productForm.register('sku')}
              />
              <Input
                label={t('onboarding.product_name')}
                placeholder={t('onboarding.product_name')}
                error={productForm.formState.errors.name_jp?.message}
                {...productForm.register('name_jp')}
              />
              <Input
                label={t('onboarding.product_price')}
                type="number"
                min={0}
                placeholder="1000"
                {...productForm.register('cost_price')}
              />
              <Select label={t('inventory.tax_category')} {...productForm.register('tax_category')}>
                <option value="standard">{t('inventory.tax_standard')}</option>
                <option value="reduced">{t('inventory.tax_reduced')}</option>
              </Select>

              {/* Buttons */}
              <div className="mt-4 flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" />
                  {t('onboarding.back')}
                </Button>
                <div className="flex-1" />
                <Button type="button" variant="secondary" onClick={goNext}>
                  <SkipForward className="h-4 w-4" />
                  {t('onboarding.skip')}
                </Button>
                <Button type="submit" loading={saving}>
                  {t('onboarding.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {/* ========== STEP 5: Complete ========== */}
          {currentStep === 'complete' && (
            <div className="flex flex-col items-center text-center">
              {/* Celebration UI */}
              <div className="relative mb-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-accent-blue shadow-xl shadow-emerald-500/30">
                  <PartyPopper className="h-12 w-12 text-white" />
                </div>
                {/* Sparkles decorations */}
                <Sparkles className="absolute -right-3 -top-2 h-6 w-6 animate-pulse text-amber-400" />
                <Sparkles className="absolute -left-4 top-4 h-5 w-5 animate-pulse text-accent-purple delay-150" />
                <Sparkles className="absolute -bottom-1 right-0 h-4 w-4 animate-pulse text-pink-400 delay-300" />
              </div>

              {/* Confetti dots */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full animate-bounce"
                    style={{
                      width: `${4 + Math.random() * 6}px`,
                      height: `${4 + Math.random() * 6}px`,
                      left: `${10 + Math.random() * 80}%`,
                      top: `${10 + Math.random() * 80}%`,
                      backgroundColor: [
                        '#a855f7',
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#ec4899',
                      ][i % 6],
                      opacity: 0.5 + Math.random() * 0.4,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${1.5 + Math.random() * 2}s`,
                    }}
                  />
                ))}
              </div>

              <h1 className="mb-2 text-2xl font-bold text-text-primary">{t('onboarding.congrats')}</h1>
              <p className="mb-8 text-text-secondary">{t('onboarding.congrats_desc')}</p>

              <Button size="lg" className="w-full" loading={saving} onClick={handleFinish}>
                {t('onboarding.go_dashboard')}
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Footer branding */}
      <p className="mt-8 text-xs text-text-muted">
        KeepDF &mdash; {t('brand.tagline')}
      </p>
    </div>
  )
}
