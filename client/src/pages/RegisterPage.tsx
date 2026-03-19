import { Navigate } from "react-router-dom";
import { useGameConfig } from "../hooks/useGameConfig";

/**
 * Registration happens during the first-run OS installer (`/install`).
 * This route keeps old links working.
 */
export function RegisterPage() {
  const { config } = useGameConfig();
  if (!config.setupComplete) {
    return <Navigate to="/install" replace />;
  }
  return <Navigate to="/login" replace />;
}

