import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, MapPin, Search } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { Button } from '@/components/ui/Button'
import { inventoryApi } from '@/api/endpoints/inventory'
import type { Product } from '@/api/types'
import { formatCurrency } from '@/utils/format'

interface ScanLookupSheetProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (product: Product, sku: string) => void
}

interface LookupResult {
  product: Product
  locations: { code: string; qty: number }[]
  totalStock: number
}

export function ScanLookupSheet({ isOpen, onClose, onSelect }: ScanLookupSheetProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [scannedCode, setScannedCode] = useState('')

  const handleScan = useCallback(async (code: string) => {
    setScannedCode(code)
    setLoading(true)
    setResult(null)
    setNotFound(false)

    try {
      const data = await inventoryApi.barcodeLookup(code)
      setResult(data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleClose = useCallback(() => {
    setResult(null)
    setNotFound(false)
    setScannedCode('')
    setLoading(false)
    onClose()
  }, [onClose])

  const handleSelect = useCallback(() => {
    if (result?.product) {
      onSelect?.(result.product, result.product.sku)
      handleClose()
    }
  }, [result, onSelect, handleClose])

  const handleReset = useCallback(() => {
    setResult(null)
    setNotFound(false)
    setScannedCode('')
  }, [])

  return (
    <BottomSheet open={isOpen} onClose={handleClose} title={t('scanner.lookup')}>
      {/* Show scanner when no result yet */}
      {!result && !notFound && !loading && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={handleClose}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
            <span className="text-sm text-text-muted">{t('scanner.scanning')}</span>
          </div>
        </div>
      )}

      {/* Product found */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Package size={18} />
            <span className="text-sm font-medium">{t('scanner.product_found')}</span>
          </div>

          <div className="rounded-lg bg-bg-input p-4 space-y-3">
            <div>
              <span className="text-xs text-text-muted">SKU</span>
              <p className="font-mono text-sm font-medium text-accent-purple">{result.product.sku}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">{t('inventory.name_jp')}</span>
              <p className="text-sm text-text-primary">{result.product.name_jp || '-'}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted">{t('scanner.current_stock')}</span>
                <p className="text-lg font-semibold text-text-primary">{result.totalStock}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">{t('inventory.cost_price')}</span>
                <p className="text-sm text-text-primary">{formatCurrency(result.product.cost_price)}</p>
              </div>
            </div>

            {result.locations.length > 0 && (
              <div>
                <span className="text-xs text-text-muted flex items-center gap-1 mb-1">
                  <MapPin size={12} />
                  {t('scanner.warehouse')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {result.locations.map((loc) => (
                    <span
                      key={loc.code}
                      className="inline-flex items-center gap-1 rounded-full bg-bg-card px-2.5 py-1 text-xs border border-border"
                    >
                      <span className="font-mono text-text-secondary">{loc.code}</span>
                      <span className="text-text-muted">×{loc.qty}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleReset} className="flex-1">
              {t('scanner.try_again')}
            </Button>
            {onSelect && (
              <Button size="sm" onClick={handleSelect} className="flex-1">
                {t('scanner.confirm')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-8 text-center">
            <Search size={40} className="text-text-muted mb-3" />
            <p className="text-sm font-medium text-text-primary mb-1">
              {t('scanner.product_not_found')}
            </p>
            <p className="text-xs text-text-muted font-mono">{scannedCode}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={handleReset} className="w-full">
            {t('scanner.try_again')}
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}
