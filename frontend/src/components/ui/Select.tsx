import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const selectId = id || props.name

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full px-3 py-2 rounded-lg text-sm appearance-none',
            'bg-bg-input text-text-primary',
            'border border-border focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/50',
            'transition-colors duration-200',
            'bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat',
            'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2716%27%20height%3D%2716%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%2394a3b8%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27%2F%3E%3C%2Fsvg%3E")]',
            'pr-10',
            error && 'border-accent-red focus:border-accent-red focus:ring-accent-red/50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="text-xs text-accent-red">{error}</p>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'
