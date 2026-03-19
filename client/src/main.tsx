import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { GameConfigProvider, useGameConfig } from "./hooks/useGameConfig";
import { LoadingScreen } from "./components/LoadingScreen";
import { normalizeGameLanguage } from "./lib/gameConfig";
import "./styles.css";

function AuthBridge() {
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
        <AuthBridge />
      </GameConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
