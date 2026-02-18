import { useEffect } from 'react'

const PREFETCH_ROUTES = [
  () => import('../../pages/dashboard'),
  () => import('../../pages/orders/OrdersPage'),
  () => import('../../pages/inventory/InventoryPage'),
]

const rIC = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 1) as unknown as number
const cIC = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : (id: number) => clearTimeout(id)

export function PrefetchRoutes() {
  useEffect(() => {
    const id = rIC(() => {
      PREFETCH_ROUTES.forEach((load) => load())
    })
    return () => cIC(id)
  }, [])

  return null
}
