import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth } from './components/layout/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/orders/OrdersPage'
import InventoryPage from './pages/inventory/InventoryPage'
import ShippingPage from './pages/shipping/ShippingPage'
import ReturnsPage from './pages/returns/ReturnsPage'
import CustomersPage from './pages/customers/CustomersPage'
import CommissionsPage from './pages/commissions/CommissionsPage'
import WalletPage from './pages/wallet/WalletPage'
import SettingsPage from './pages/settings/SettingsPage'
import OnboardingPage from './pages/onboarding/OnboardingPage'
import NotFoundPage from './pages/NotFoundPage'
import { Toaster } from './components/ui/Toast'

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
            <Route path="orders" element={<OrdersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="shipping" element={<ShippingPage />} />
            <Route path="returns" element={<ReturnsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
