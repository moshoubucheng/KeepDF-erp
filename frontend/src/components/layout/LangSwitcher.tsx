import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/i18n/index'
import { cn } from '@/utils/cn'

const languages = [
  { code: 'ja', label: 'JP' },
  { code: 'en', label: 'EN' },
  { code: 'zh', label: 'CN' },
] as const

export function LangSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language

  return (
    <div className="flex items-center rounded-lg border border-border bg-bg-input p-0.5">
      {languages.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => changeLanguage(code)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-all',
            current === code
              ? 'bg-accent-purple text-white shadow-sm'
              : 'text-text-muted hover:text-text-primary',
          )}
          aria-label={`Switch language to ${label}`}
          aria-pressed={current === code}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
