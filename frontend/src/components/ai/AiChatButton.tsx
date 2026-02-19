import { Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { cn } from '@/utils/cn'

interface AiChatButtonProps {
  onClick: () => void
}

export function AiChatButton({ onClick }: AiChatButtonProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed z-50 flex items-center justify-center rounded-full',
        'bg-purple-600 text-white shadow-lg',
        'hover:bg-purple-700 hover:scale-110 active:scale-95',
        'transition-all duration-200',
        'w-12 h-12 md:w-14 md:h-14',
        isMobile ? 'bottom-20 right-4' : 'bottom-6 right-6',
      )}
      title={t('ai.title')}
      aria-label={t('ai.title')}
    >
      <Bot className="h-6 w-6 md:h-7 md:w-7" />
    </button>
  )
}
