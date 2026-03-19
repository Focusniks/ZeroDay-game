import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingScreen } from "./components/LoadingScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import { useGameConfig } from "./hooks/useGameConfig";
import { useI18n } from "./hooks/useI18n";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OsInstallPage } from "./pages/OsInstallPage";
import { RegisterPage } from "./pages/RegisterPage";
import { EARLY_BOOT_DISPLAY_MS } from "./lib/bootConsoleSequence";

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
  const { lang } = useI18n();

  const [bootVisible, setBootVisible] = useState(false);
  const [bootFading, setBootFading] = useState(false);
  const [rebootBootVisible, setRebootBootVisible] = useState(false);

  useEffect(() => {
    let t: number | undefined;
    if (systemLoading) {
      setBootVisible(true);
      setBootFading(false);
    } else if (bootVisible) {
      setBootFading(true);
      t = window.setTimeout(() => setBootVisible(false), 450);
    }
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [bootVisible, systemLoading]);

  // Симуляция "реальной перезагрузки": показываем systemd-подобный boot,
  // и только потом (после редиректа) показываем логин.
  useEffect(() => {
    const handler = () => {
      setRebootBootVisible(true);
      window.setTimeout(() => setRebootBootVisible(false), EARLY_BOOT_DISPLAY_MS);
    };
    window.addEventListener("zeroday:reboot", handler);
    return () => window.removeEventListener("zeroday:reboot", handler);
  }, []);

  if (rebootBootVisible) {
    return <LoadingScreen lang={lang} phase="early" />;
  }

  return (
    <>
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
      {bootVisible ? <LoadingScreen lang={lang} phase="session" fadeOut={bootFading} /> : null}
    </>
  );
}
