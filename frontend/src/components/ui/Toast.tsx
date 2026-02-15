import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUIStore } from '@/stores/ui.store'

const toastConfig = {
  success: {
    icon: CheckCircle,
    containerClass: 'border-accent-emerald/30 bg-accent-emerald-glow',
    iconClass: 'text-accent-emerald',
  },
  error: {
    icon: XCircle,
    containerClass: 'border-accent-red/30 bg-accent-red/10',
    iconClass: 'text-accent-red',
  },
  info: {
    icon: Info,
    containerClass: 'border-accent-blue/30 bg-accent-blue-glow',
    iconClass: 'text-accent-blue',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-accent-amber/30 bg-accent-amber-glow',
    iconClass: 'text-accent-amber',
  },
} as const

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts)
  const removeToast = useUIStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type]
        const Icon = config.icon

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg',
              'bg-bg-card text-text-primary',
              'animate-[slideIn_200ms_ease-out]',
              config.containerClass,
            )}
          >
            <Icon size={18} className={cn('mt-0.5 shrink-0', config.iconClass)} />
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
