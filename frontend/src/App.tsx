import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RequireAuth } from './components/layout/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { PrefetchRoutes } from './components/layout/PrefetchRoutes'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import { Toaster } from './components/ui/Toast'
import { Spinner } from './components/ui/Spinner'
import { ErrorBoundary, InlineErrorBoundary } from './components/ui/ErrorBoundary'

// All pages lazy-loaded for bundle splitting
const DashboardPage = lazy(() => import('./pages/dashboard'))
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage'))
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'))
const ShippingPage = lazy(() => import('./pages/shipping/ShippingPage'))
const ReturnsPage = lazy(() => import('./pages/returns/ReturnsPage'))
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'))
const CommissionsPage = lazy(() => import('./pages/commissions/CommissionsPage'))
const WalletPage = lazy(() => import('./pages/wallet/WalletPage'))
const SettingsPage = lazy(() => import('./pages/settings'))
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'))

// Sprint 16 pages (lazy loaded)
const DistributorsPage = lazy(() => import('./pages/distributors/DistributorsPage'))
const AuditPage = lazy(() => import('./pages/audit/AuditPage'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const FinancialReportsPage = lazy(() => import('./pages/financial-reports/FinancialReportsPage'))
const ForecastingPage = lazy(() => import('./pages/forecasting/ForecastingPage'))
const PurchaseOrdersPage = lazy(() => import('./pages/purchase-orders/PurchaseOrdersPage'))
const SuppliersPage = lazy(() => import('./pages/suppliers/SuppliersPage'))
const PricingPage = lazy(() => import('./pages/pricing/PricingPage'))
const CurrencyPage = lazy(() => import('./pages/currency/CurrencyPage'))
const CouponsPage = lazy(() => import('./pages/coupons/CouponsPage'))
const PromotionsPage = lazy(() => import('./pages/promotions/PromotionsPage'))
const ShippingFeesPage = lazy(() => import('./pages/shipping-fees/ShippingFeesPage'))
const AutomationPage = lazy(() => import('./pages/automation/AutomationPage'))
const ApprovalsPage = lazy(() => import('./pages/approvals/ApprovalsPage'))
const WebhooksPage = lazy(() => import('./pages/webhooks/WebhooksPage'))
const CommunicationsPage = lazy(() => import('./pages/communications/CommunicationsPage'))
const CustomerSegmentsPage = lazy(() => import('./pages/customer-segments/CustomerSegmentsPage'))
const StocktakesPage = lazy(() => import('./pages/stocktakes/StocktakesPage'))
const SkuMappingsPage = lazy(() => import('./pages/sku-mappings/SkuMappingsPage'))
const InvoicesPage = lazy(() => import('./pages/invoices/InvoicesPage'))
const DataScreenPage = lazy(() => import('./pages/data-screen/DataScreenPage'))
const SupplyChainPage = lazy(() => import('./pages/supply-chain/SupplyChainPage'))
const ImportPage = lazy(() => import('./pages/import/ImportPage'))
const BatchPage = lazy(() => import('./pages/batch/BatchPage'))
const PlatformSyncPage = lazy(() => import('./pages/platform-sync/PlatformSyncPage'))

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size={32} />
    </div>
  )
}

export default function App() {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    document.title = t('brand.title')
  }, [i18n.language, t])

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><OnboardingPage /></InlineErrorBoundary></Suspense>} />
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><DashboardPage /></InlineErrorBoundary></Suspense>} />
            {/* Orders */}
            <Route path="orders" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><OrdersPage /></InlineErrorBoundary></Suspense>} />
            <Route path="shipping" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><ShippingPage /></InlineErrorBoundary></Suspense>} />
            <Route path="returns" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><ReturnsPage /></InlineErrorBoundary></Suspense>} />
            {/* Inventory */}
            <Route path="inventory" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><InventoryPage /></InlineErrorBoundary></Suspense>} />
            <Route path="purchase-orders" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><PurchaseOrdersPage /></InlineErrorBoundary></Suspense>} />
            <Route path="suppliers" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><SuppliersPage /></InlineErrorBoundary></Suspense>} />
            <Route path="stocktakes" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><StocktakesPage /></InlineErrorBoundary></Suspense>} />
            <Route path="sku-mappings" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><SkuMappingsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="forecasting" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><ForecastingPage /></InlineErrorBoundary></Suspense>} />
            {/* Finance */}
            <Route path="wallet" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><WalletPage /></InlineErrorBoundary></Suspense>} />
            <Route path="commissions" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><CommissionsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="pricing" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><PricingPage /></InlineErrorBoundary></Suspense>} />
            <Route path="currency" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><CurrencyPage /></InlineErrorBoundary></Suspense>} />
            <Route path="coupons" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><CouponsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="promotions" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><PromotionsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="shipping-fees" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><ShippingFeesPage /></InlineErrorBoundary></Suspense>} />
            <Route path="financial-reports" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><FinancialReportsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="invoices" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><InvoicesPage /></InlineErrorBoundary></Suspense>} />
            {/* CRM */}
            <Route path="customers" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><CustomersPage /></InlineErrorBoundary></Suspense>} />
            <Route path="customer-segments" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><CustomerSegmentsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="communications" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><CommunicationsPage /></InlineErrorBoundary></Suspense>} />
            {/* Analytics */}
            <Route path="supply-chain" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><SupplyChainPage /></InlineErrorBoundary></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><ReportsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="data-screen" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><DataScreenPage /></InlineErrorBoundary></Suspense>} />
            {/* System */}
            <Route path="settings" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><SettingsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="distributors" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><DistributorsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="audit" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><AuditPage /></InlineErrorBoundary></Suspense>} />
            <Route path="notifications" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><NotificationsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="automation" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><AutomationPage /></InlineErrorBoundary></Suspense>} />
            <Route path="approvals" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><ApprovalsPage /></InlineErrorBoundary></Suspense>} />
            <Route path="webhooks" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><WebhooksPage /></InlineErrorBoundary></Suspense>} />
            <Route path="import" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><ImportPage /></InlineErrorBoundary></Suspense>} />
            <Route path="batch" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><BatchPage /></InlineErrorBoundary></Suspense>} />
            <Route path="platform-sync" element={<Suspense fallback={<LazyFallback />}><InlineErrorBoundary><PlatformSyncPage /></InlineErrorBoundary></Suspense>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <PrefetchRoutes />
      <Toaster />
    </ErrorBoundary>
  )
}
