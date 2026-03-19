import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingScreen } from "./components/LoadingScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import { useGameConfig } from "./hooks/useGameConfig";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OsInstallPage } from "./pages/OsInstallPage";
import { RegisterPage } from "./pages/RegisterPage";

function InstallRoute() {
  const { config } = useGameConfig();
  if (config.setupComplete) {
    return <Navigate to="/login" replace />;
  }
  return <OsInstallPage />;
}

function LoginRoute() {
  const { config } = useGameConfig();
  if (!config.setupComplete) {
    return <Navigate to="/install" replace />;
  }
  return <LoginPage />;
}

export default function App() {
  const { systemLoading, isAuthenticated } = useAuth();
  const { config } = useGameConfig();

  if (systemLoading) {
    return (
      <LoadingScreen
        title="System Initialization"
        subtitle="Launching custom Linux environment..."
      />
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={isAuthenticated ? "/dashboard" : config.setupComplete ? "/login" : "/install"}
            replace
          />
        }
      />
      <Route path="/install" element={<InstallRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
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
