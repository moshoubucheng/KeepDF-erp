import { cn } from '@/utils/cn'

type AccentColor = 'purple' | 'blue' | 'emerald' | 'amber'

const ACCENT_STYLES: Record<AccentColor, { icon: string; glow: string; border: string }> = {
  purple: {
    icon: 'text-accent-purple bg-accent-purple-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
    border: 'hover:border-accent-purple/30',
  },
  blue: {
    icon: 'text-accent-blue bg-accent-blue-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
    border: 'hover:border-accent-blue/30',
  },
  emerald: {
    icon: 'text-accent-emerald bg-accent-emerald-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    border: 'hover:border-accent-emerald/30',
  },
  amber: {
    icon: 'text-accent-amber bg-accent-amber-glow',
    glow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    border: 'hover:border-accent-amber/30',
  },
}

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string | number
  subtitle?: string
  accent?: AccentColor
  className?: string
}

export function StatCard({
  icon,
  title,
  value,
  subtitle,
  accent = 'purple',
  className,
}: StatCardProps) {
  const styles = ACCENT_STYLES[accent]

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-card p-5',
        'transition-all duration-300 ease-out',
        styles.glow,
        styles.border,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-text-primary truncate">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-text-secondary truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={cn(
            'ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            styles.icon,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
