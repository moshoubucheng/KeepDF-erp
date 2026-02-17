import { useEffect } from 'react'

const PREFETCH_ROUTES = [
  () => import('../../pages/DashboardPage'),
  () => import('../../pages/orders/OrdersPage'),
  () => import('../../pages/inventory/InventoryPage'),
]

export function PrefetchRoutes() {
  useEffect(() => {
    const id = requestIdleCallback(() => {
      PREFETCH_ROUTES.forEach((load) => load())
    })
    return () => cancelIdleCallback(id)
  }, [])

  return null
}
