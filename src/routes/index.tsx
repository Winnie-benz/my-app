import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import LoginPage from '../pages/LoginPage'
import StockPage from '../pages/StockPage'
import StockCheckPage from '../pages/StockCheckPage'
import LowStockPage from '../pages/LowStockPage'
import ProductDetailPage from '../pages/ProductDetailPage'
import CustomersPage from '../pages/CustomersPage'
import CustomerDetailPage from '../pages/CustomerDetailPage'
import DashboardPage from '../pages/DashboardPage'
import ReportsPage       from '../pages/ReportsPage'
import PendingCostsPage from '../pages/PendingCostsPage'
import SettingsPage     from '../pages/SettingsPage'
import OutstandingPage              from '../pages/OutstandingPage'
import OrdersPage                   from '../pages/OrdersPage'
import InventoryHistoryPage         from '../pages/InventoryHistoryPage'
import InventorySessionDetailPage   from '../pages/InventorySessionDetailPage'
import LensProductsPage             from '../pages/LensProductsPage'
import ClaimsPage                   from '../pages/ClaimsPage'
import AnalyticsPage                from '../pages/AnalyticsPage'
import UsersPage                   from '../pages/UsersPage'
import DailyClosePage              from '../pages/DailyClosePage'

export const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginPage /> },

  // Protected — entire app layout sits behind auth
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',       element: <DashboardPage /> },
      { path: 'stock',           element: <StockPage /> },
      { path: 'stock-check',     element: <StockCheckPage /> },
      { path: 'low-stock',       element: <LowStockPage /> },
      { path: 'products/:id',    element: <ProductDetailPage /> },
      { path: 'customers',       element: <CustomersPage /> },
      { path: 'customers/:id',   element: <CustomerDetailPage /> },
      { path: 'reports',         element: <ReportsPage /> },
      { path: 'pending-costs',  element: <PendingCostsPage /> },
      { path: 'settings',       element: <SettingsPage /> },
      { path: 'outstanding',          element: <OutstandingPage /> },
      { path: 'orders',               element: <OrdersPage /> },
      { path: 'inventory-history',    element: <InventoryHistoryPage /> },
      { path: 'inventory-history/:id', element: <InventorySessionDetailPage /> },
      { path: 'lens-products',         element: <LensProductsPage /> },
      { path: 'claims',                element: <ClaimsPage /> },
      { path: 'analytics',             element: <AnalyticsPage /> },
      { path: 'users',                 element: <UsersPage /> },
      { path: 'daily-close',           element: <DailyClosePage /> },
    ],
  },
])
