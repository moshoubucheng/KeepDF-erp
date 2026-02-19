import { ScanLine } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ScanButtonProps {
  onClick: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ScanButton({ onClick, disabled, size = 'sm', className }: ScanButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border border-border',
        'bg-bg-input text-text-secondary hover:text-accent-purple hover:border-accent-purple',
        'transition-colors duration-200 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'p-2' : 'p-2.5',
        className,
      )}
      title="Scan"
    >
      <ScanLine size={size === 'sm' ? 16 : 20} />
    </button>
  )
}
