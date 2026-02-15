import { cn } from '@/utils/cn'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  error,
  required = false,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-text-secondary"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-accent-red">*</span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-xs text-accent-red">{error}</p>
      )}
    </div>
  )
}
