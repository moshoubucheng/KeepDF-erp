import { useState, useEffect, useCallback, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Keyboard, RotateCcw, Check, Loader2 } from 'lucide-react'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { Button } from './Button'
import { Input } from './Input'
import { cn } from '@/utils/cn'

type ScanMode = 'camera' | 'manual'

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
  placeholder?: string
}

export function BarcodeScanner({ onScan, onClose, placeholder }: BarcodeScannerProps) {
  const { t } = useTranslation()
  const uniqueId = useId()
  const scannerId = `barcode-scanner-${uniqueId.replace(/:/g, '')}`
  const [mode, setMode] = useState<ScanMode>('camera')
  const [manualCode, setManualCode] = useState('')
  const [detected, setDetected] = useState<string | null>(null)

  const handleDetected = useCallback((code: string) => {
    setDetected(code)
    // Auto-submit after short delay for visual feedback
    setTimeout(() => {
      onScan(code)
    }, 600)
  }, [onScan])

  const { isScanning, error, startScanning, stopScanning } = useBarcodeScanner(handleDetected)

  // Start camera when mode is camera
  useEffect(() => {
    if (mode === 'camera') {
      // Small delay so the DOM element is rendered
      const timer = setTimeout(() => {
        startScanning(scannerId)
      }, 100)
      return () => {
        clearTimeout(timer)
        stopScanning()
      }
    }
    return () => {
      stopScanning()
    }
  }, [mode, scannerId, startScanning, stopScanning])

  const handleManualSubmit = () => {
    const trimmed = manualCode.trim()
    if (trimmed) {
      onScan(trimmed)
    }
  }

  const handleRetry = () => {
    setDetected(null)
    if (mode === 'camera') {
      startScanning(scannerId)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mode tabs */}
      <div className="flex rounded-lg bg-bg-input p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('camera')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer',
            mode === 'camera'
              ? 'bg-accent-purple text-white'
              : 'text-text-muted hover:text-text-primary',
          )}
        >
          <Camera size={16} />
          {t('scanner.title')}
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer',
            mode === 'manual'
              ? 'bg-accent-purple text-white'
              : 'text-text-muted hover:text-text-primary',
          )}
        >
          <Keyboard size={16} />
          {t('scanner.manual_input')}
        </button>
      </div>

      {/* Camera mode */}
      {mode === 'camera' && (
        <div className="relative">
          {/* Scanner viewport */}
          <div
            id={scannerId}
            className="relative w-full overflow-hidden rounded-xl bg-black"
            style={{ minHeight: 260 }}
          />

          {/* Overlay states */}
          {!isScanning && !error && !detected && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 size={28} className="animate-spin" />
                <span className="text-sm">{t('scanner.initializing')}</span>
              </div>
            </div>
          )}

          {detected && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
              <div className="flex flex-col items-center gap-2 text-emerald-400">
                <Check size={32} />
                <span className="text-sm font-medium">{t('scanner.detected')}</span>
                <span className="font-mono text-xs text-white/80">{detected}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <span className="text-sm text-accent-red">
                  {error === 'camera_denied'
                    ? t('scanner.camera_denied')
                    : error === 'camera_not_found'
                      ? t('scanner.camera_denied')
                      : t('scanner.error')}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={handleRetry}>
                    <RotateCcw size={14} />
                    {t('scanner.try_again')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setMode('manual')}>
                    <Keyboard size={14} />
                    {t('scanner.switch_manual')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Scan animation line */}
          {isScanning && !detected && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl">
              <div className="relative h-[200px] w-[200px]">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-accent-purple rounded-tl" />
                <div className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-accent-purple rounded-tr" />
                <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-accent-purple rounded-bl" />
                <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-accent-purple rounded-br" />
                {/* Scan line */}
                <div className="absolute left-2 right-2 h-0.5 bg-accent-purple/80 animate-[scanLine_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <div className="space-y-3">
          <Input
            placeholder={placeholder || t('scanner.manual_placeholder')}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleManualSubmit()
              }
            }}
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleManualSubmit}
            disabled={!manualCode.trim()}
            className="w-full"
          >
            {t('scanner.confirm')}
          </Button>
        </div>
      )}
    </div>
  )
}
