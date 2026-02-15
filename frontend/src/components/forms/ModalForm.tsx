import { useEffect, useRef, useCallback } from 'react'
import { type FieldValues, type SubmitHandler, type UseFormReturn, FormProvider } from 'react-hook-form'
import { X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

interface ModalFormProps<T extends FieldValues> {
  title: string
  isOpen: boolean
  onClose: () => void
  onSubmit: SubmitHandler<T>
  form: UseFormReturn<T>
  children: React.ReactNode
  submitLabel?: string
  isSubmitting?: boolean
  className?: string
}

export function ModalForm<T extends FieldValues>({
  title,
  isOpen,
  onClose,
  onSubmit,
  form,
  children,
  submitLabel,
  isSubmitting: externalSubmitting,
  className,
}: ModalFormProps<T>) {
  const { t } = useTranslation()
  const overlayRef = useRef<HTMLDivElement>(null)
  const submitting = externalSubmitting ?? form.formState.isSubmitting

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose],
  )

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-xl border border-border bg-bg-card shadow-2xl',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-card-hover hover:text-text-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-4">
              {children}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={cn(
                  'rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary',
                  'transition-colors hover:bg-bg-card-hover hover:text-text-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2',
                  'text-sm font-medium text-white',
                  'transition-colors hover:bg-accent-purple/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitLabel ?? t('common.save', 'Save')}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  )
}
