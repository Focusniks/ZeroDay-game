import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { GameConfigProvider, useGameConfig } from "./hooks/useGameConfig";
import { LoadingScreen } from "./components/LoadingScreen";
import "./styles.css";

function AuthBridge() {
  const { ready, config } = useGameConfig();

  if (!ready) {
    return (
      <LoadingScreen
        title="ZeroDay"
        subtitle="Loading local game configuration (zeroday_game.json)..."
      />
    );
  }

  return (
    <AuthProvider wsUrlOverride={config.wsUrl}>
      <App />
    </AuthProvider>
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
