import { cn } from '@/utils/cn'
import { STATUS_COLORS } from '@/utils/constants'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClasses = STATUS_COLORS[status] ?? 'bg-gray-500/15 text-gray-400'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClasses,
        className,
      )}
    >
      {status}
    </span>
  )
}
