import { type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-md hover:shadow-lg hover:brightness-110',
  secondary:
    'bg-bg-card text-text-primary border border-border hover:border-border-hover hover:bg-bg-card-hover',
  danger:
    'bg-accent-red text-white hover:brightness-110',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-card',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-3 text-base rounded-lg gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={size === 'lg' ? 20 : size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}
