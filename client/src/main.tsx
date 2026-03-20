import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { GameConfigProvider, useGameConfig } from "./hooks/useGameConfig";
import { LoadingScreen } from "./components/LoadingScreen";
import { normalizeGameLanguage } from "./lib/gameConfig";
import "./styles.css";

/**
 * Блокирует браузерные элементы UI (ПКМ, Ctrl+S, Ctrl+P, и т.д.)
 * Оставляет только инспектор (Ctrl+Shift+I / F12).
 * Также обрабатывает переключение раскладки Alt+Shift.
 */
function useDisableBrowserUI() {
  useEffect(() => {
    // Блокировка контекстного меню (ПКМ)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Блокировка горячих клавиш и переключение языка
    const handleKeyDown = (e: KeyboardEvent) => {
      // Разрешаем Ctrl+Shift+I, Ctrl+Shift+J, F12 (инспектор)
      const isDevTools = (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) || e.key === "F12";
      if (isDevTools) return;

      // Блокируем Ctrl+S (сохранение), Ctrl+P (печать), Ctrl+U (view source)
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }

      // Блокируем F1 (справка)
      if (e.key === "F1") {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu, { passive: false });
    document.addEventListener("keydown", handleKeyDown, { passive: false });

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}

function AppWrapper() {
  useDisableBrowserUI();
  const { ready, config } = useGameConfig();

  const lang = normalizeGameLanguage(config.gameLanguage);
  const [bootVisible, setBootVisible] = useState(true);
  const [bootFading, setBootFading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setBootFading(true);
    const t = window.setTimeout(() => setBootVisible(false), 450);
    return () => window.clearTimeout(t);
  }, [ready]);

  return (
    <>
      {ready ? (
        <AuthProvider wsUrlOverride={config.wsUrl}>
          <App />
        </AuthProvider>
      ) : null}
      {bootVisible ? <LoadingScreen lang={lang} phase="early" fadeOut={bootFading} /> : null}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GameConfigProvider>
        <AppWrapper />
      </GameConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
