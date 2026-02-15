import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Construction } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      {/* Text-based illustration */}
      <div className="mb-8 select-none">
        <div className="text-[8rem] font-black leading-none tracking-tighter">
          <span className="bg-gradient-to-r from-accent-purple to-accent-blue bg-clip-text text-transparent">
            4
          </span>
          <span className="relative inline-block text-text-muted">
            0
            {/* Eyes in the zero */}
            <span className="absolute left-1/2 top-[40%] -translate-x-[60%] text-2xl">
              o
            </span>
            <span className="absolute left-1/2 top-[40%] translate-x-[10%] text-2xl">
              o
            </span>
          </span>
          <span className="bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
            4
          </span>
        </div>
      </div>

      {/* Message */}
      <h1 className="mb-2 text-2xl font-bold text-text-primary">
        {t('error.page_not_found', 'Page not found')}
      </h1>
      <p className="mb-2 max-w-md text-text-secondary">
        {t(
          'error.page_not_found_desc',
          'The page you are looking for does not exist or has been moved.',
        )}
      </p>

      {/* Coming soon hint */}
      <div className="mb-8 flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
        <Construction className="h-4 w-4 shrink-0" />
        <span>{t('error.coming_soon', 'Some pages are coming soon in Sprint 16.')}</span>
      </div>

      {/* CTA */}
      <Link to="/dashboard">
        <Button size="lg">
          <Home className="h-5 w-5" />
          {t('onboarding.go_dashboard', 'Go to Dashboard')}
        </Button>
      </Link>
    </div>
  )
}
