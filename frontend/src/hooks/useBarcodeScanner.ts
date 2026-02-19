import { useState, useCallback, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface UseBarcodeScaAnnerResult {
  isScanning: boolean
  error: string | null
  lastResult: string | null
  startScanning: (elementId: string) => Promise<void>
  stopScanning: () => Promise<void>
}

export function useBarcodeScanner(
  onDetected?: (code: string) => void,
): UseBarcodeScaAnnerResult {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onDetectedRef = useRef(onDetected)

  // Keep callback ref up to date
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        // Html5QrcodeScannerState: 1=NOT_STARTED, 2=SCANNING, 3=PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop()
        }
      } catch {
        // Ignore stop errors
      }
      try {
        scannerRef.current.clear()
      } catch {
        // Ignore clear errors
      }
      scannerRef.current = null
    }
    setIsScanning(false)
  }, [])

  const startScanning = useCallback(
    async (elementId: string) => {
      setError(null)
      setLastResult(null)

      // Stop any existing scanner
      await stopScanning()

      try {
        const scanner = new Html5Qrcode(elementId)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            setLastResult(decodedText)
            onDetectedRef.current?.(decodedText)
          },
          () => {
            // Ignore scan failures (no code in frame)
          },
        )

        setIsScanning(true)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start scanner'
        if (
          message.includes('NotAllowedError') ||
          message.includes('Permission')
        ) {
          setError('camera_denied')
        } else if (message.includes('NotFoundError')) {
          setError('camera_not_found')
        } else {
          setError(message)
        }
        setIsScanning(false)
      }
    },
    [stopScanning],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState()
          if (state === 2 || state === 3) {
            scannerRef.current.stop().catch(() => {})
          }
          scannerRef.current.clear()
        } catch {
          // Ignore cleanup errors
        }
        scannerRef.current = null
      }
    }
  }, [])

  return {
    isScanning,
    error,
    lastResult,
    startScanning,
    stopScanning,
  }
}
