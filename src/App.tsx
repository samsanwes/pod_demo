import { Routes, Route, Navigate } from 'react-router-dom';
import { OrderFormPage } from './pages/OrderForm';
import { OrderSubmittedPage } from './pages/OrderSubmitted';
import { LoginPage } from './pages/Login';
import { NotAuthorizedPage } from './pages/NotAuthorized';
import { DashboardPage } from './pages/Dashboard';
import { ProtectedRoute } from './components/shared/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OrderFormPage />} />
      <Route path="/order-submitted/:orderNumber" element={<OrderSubmittedPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/not-authorized" element={<NotAuthorizedPage />} />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
