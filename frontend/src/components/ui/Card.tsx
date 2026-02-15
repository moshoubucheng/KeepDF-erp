import { type HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

/* ---- Card ---- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-card border border-border rounded-xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ---- CardHeader ---- */

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
}

export function CardHeader({ title, subtitle, className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('px-6 py-4 border-b border-border', className)}
      {...props}
    >
      {title && (
        <div>
          <h3 className="text-text-primary font-semibold text-base">{title}</h3>
          {subtitle && (
            <p className="text-text-muted text-sm mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

/* ---- CardContent ---- */

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  )
}
