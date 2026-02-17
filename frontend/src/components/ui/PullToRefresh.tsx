import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, Loader2 } from 'lucide-react'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { cn } from '@/utils/cn'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  enabled?: boolean
  children: React.ReactNode
  className?: string
}

export function PullToRefresh({ onRefresh, enabled = true, children, className }: PullToRefreshProps) {
  const { t } = useTranslation()
  const { pulling, pullDistance, refreshing, handlers, canTrigger } = usePullToRefresh({
    onRefresh,
    enabled,
  })

  return (
    <div
      className={cn('relative overflow-y-auto', className)}
      {...handlers}
    >
      {/* Pull indicator */}
      {(pulling || refreshing) && (
        <div
          className="flex items-center justify-center transition-all duration-150"
          style={{ height: pulling ? `${pullDistance}px` : refreshing ? '48px' : 0 }}
        >
          {refreshing ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent-purple" />
              <span>{t('mobile.refreshing', 'Refreshing...')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <ArrowDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  canTrigger && 'rotate-180 text-accent-purple',
                )}
              />
              <span>
                {canTrigger
                  ? t('mobile.releaseToRefresh', 'Release to refresh')
                  : t('mobile.pullToRefresh', 'Pull to refresh')}
              </span>
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  )
}
