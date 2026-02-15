import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

interface PaginationProps {
  page: number
  pages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, pages, onPageChange, className }: PaginationProps) {
  const { t } = useTranslation()

  if (pages <= 1) return null

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={cn(
          'inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer',
          'text-text-secondary hover:text-text-primary hover:bg-bg-card',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        )}
      >
        <ChevronLeft size={16} />
        {t('common.prev')}
      </button>

      <span className="text-sm text-text-muted">
        {page} / {pages}
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className={cn(
          'inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer',
          'text-text-secondary hover:text-text-primary hover:bg-bg-card',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        )}
      >
        {t('common.next')}
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
