/**
 * Главный файл приложения
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './hooks/useAuthStore';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ServicesPage } from './pages/ServicesPage';
import './styles/index.css';

/** Защищённый роут для авторизованных */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** Защищённый роут для админов */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { init } = useAuthStore();

  // Инициализация авторизации при загрузке
  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPanelPage />
            </AdminRoute>
          }
        />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/services" element={<ServicesPage />} />
        {/* Редирект на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
