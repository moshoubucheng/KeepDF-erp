import { cn } from '@/utils/cn'
import { PLATFORM_COLORS } from '@/utils/constants'

const PLATFORM_ICONS: Record<string, string> = {
  TIKTOK: '\uD83C\uDFB5',
  TEMU: '\uD83D\uDED2',
  RAKUTEN: '\uD83C\uDFEF',
}

interface PlatformBadgeProps {
  platform: string
  className?: string
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const colorClasses = PLATFORM_COLORS[platform] ?? 'bg-gray-500/15 text-gray-400'
  const icon = PLATFORM_ICONS[platform] ?? '\uD83C\uDF10'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClasses,
        className,
      )}
    >
      <span className="text-sm leading-none">{icon}</span>
      {platform}
    </span>
  )
}
