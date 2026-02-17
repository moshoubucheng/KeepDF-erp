import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startTranslate: number } | null>(null)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Drag handle touch events
  const handleDragStart = useCallback((e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, startTranslate: 0 }
  }, [])

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current || !sheetRef.current) return
    const diff = e.touches[0].clientY - dragRef.current.startY
    if (diff > 0) {
      dragRef.current.startTranslate = diff
      sheetRef.current.style.transform = `translateY(${diff}px)`
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current || !sheetRef.current) return
    if (dragRef.current.startTranslate > 100) {
      onClose()
    }
    sheetRef.current.style.transform = ''
    dragRef.current = null
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 rounded-t-2xl bg-bg-card border-t border-border',
          'max-h-[80vh] flex flex-col transition-transform duration-200',
          'pb-[env(safe-area-inset-bottom)]',
          className,
        )}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  )
}
