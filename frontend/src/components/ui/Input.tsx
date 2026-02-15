import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || props.name

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 rounded-lg text-sm',
            'bg-bg-input text-text-primary placeholder:text-text-muted',
            'border border-border focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/50',
            'transition-colors duration-200',
            error && 'border-accent-red focus:border-accent-red focus:ring-accent-red/50',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-accent-red">{error}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
