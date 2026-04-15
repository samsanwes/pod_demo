import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { OrdersTable } from '@/components/dashboard/OrdersTable';
import { OrderDetail } from '@/components/dashboard/OrderDetail';
import { RateCardAdmin } from '@/components/pricing/RateCardAdmin';
import { UsersAdmin } from '@/components/dashboard/UsersAdmin';
import { Reports } from '@/components/dashboard/Reports';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

export function DashboardPage() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<OrdersTable />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route
          path="reports"
          element={
            <ProtectedRoute requiredRoles={['manager']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="rate-card"
          element={
            <ProtectedRoute requiredRoles={['manager']}>
              <RateCardAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute requiredRoles={['manager']}>
              <UsersAdmin />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<div className="text-muted-foreground">Settings coming soon.</div>} />
        <Route path="*" element={<Navigate to="orders" replace />} />
      </Route>
    </Routes>
  );
}
