import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth } from './components/layout/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import { Toaster } from './components/ui/Toast'
import { Spinner } from './components/ui/Spinner'

// Sprint 15 core pages (eager)
import OrdersPage from './pages/orders/OrdersPage'
import InventoryPage from './pages/inventory/InventoryPage'
import ShippingPage from './pages/shipping/ShippingPage'
import ReturnsPage from './pages/returns/ReturnsPage'
import CustomersPage from './pages/customers/CustomersPage'
import CommissionsPage from './pages/commissions/CommissionsPage'
import WalletPage from './pages/wallet/WalletPage'
import SettingsPage from './pages/settings/SettingsPage'
import OnboardingPage from './pages/onboarding/OnboardingPage'

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

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size={32} />
    </div>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            {/* Orders */}
            <Route path="orders" element={<OrdersPage />} />
            <Route path="shipping" element={<ShippingPage />} />
            <Route path="returns" element={<ReturnsPage />} />
            {/* Inventory */}
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="purchase-orders" element={<Suspense fallback={<LazyFallback />}><PurchaseOrdersPage /></Suspense>} />
            <Route path="suppliers" element={<Suspense fallback={<LazyFallback />}><SuppliersPage /></Suspense>} />
            <Route path="stocktakes" element={<Suspense fallback={<LazyFallback />}><StocktakesPage /></Suspense>} />
            <Route path="sku-mappings" element={<Suspense fallback={<LazyFallback />}><SkuMappingsPage /></Suspense>} />
            <Route path="forecasting" element={<Suspense fallback={<LazyFallback />}><ForecastingPage /></Suspense>} />
            {/* Finance */}
            <Route path="wallet" element={<WalletPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="pricing" element={<Suspense fallback={<LazyFallback />}><PricingPage /></Suspense>} />
            <Route path="currency" element={<Suspense fallback={<LazyFallback />}><CurrencyPage /></Suspense>} />
            <Route path="coupons" element={<Suspense fallback={<LazyFallback />}><CouponsPage /></Suspense>} />
            <Route path="promotions" element={<Suspense fallback={<LazyFallback />}><PromotionsPage /></Suspense>} />
            <Route path="shipping-fees" element={<Suspense fallback={<LazyFallback />}><ShippingFeesPage /></Suspense>} />
            <Route path="financial-reports" element={<Suspense fallback={<LazyFallback />}><FinancialReportsPage /></Suspense>} />
            {/* CRM */}
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customer-segments" element={<Suspense fallback={<LazyFallback />}><CustomerSegmentsPage /></Suspense>} />
            <Route path="communications" element={<Suspense fallback={<LazyFallback />}><CommunicationsPage /></Suspense>} />
            {/* Analytics */}
            <Route path="reports" element={<Suspense fallback={<LazyFallback />}><ReportsPage /></Suspense>} />
            {/* System */}
            <Route path="settings" element={<SettingsPage />} />
            <Route path="distributors" element={<Suspense fallback={<LazyFallback />}><DistributorsPage /></Suspense>} />
            <Route path="audit" element={<Suspense fallback={<LazyFallback />}><AuditPage /></Suspense>} />
            <Route path="notifications" element={<Suspense fallback={<LazyFallback />}><NotificationsPage /></Suspense>} />
            <Route path="automation" element={<Suspense fallback={<LazyFallback />}><AutomationPage /></Suspense>} />
            <Route path="approvals" element={<Suspense fallback={<LazyFallback />}><ApprovalsPage /></Suspense>} />
            <Route path="webhooks" element={<Suspense fallback={<LazyFallback />}><WebhooksPage /></Suspense>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
