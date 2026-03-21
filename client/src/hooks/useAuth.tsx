import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { User, WsMessage } from "../types/auth";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  wsUrl: string;
  wsState: "connecting" | "open" | "closed" | "error";
  isAuthenticated: boolean;
  systemLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  sendJson: (message: any) => void;
  lastMessage: string | null;
};

const STORAGE_TOKEN_KEY = "zeroday.token";
const STORAGE_USER_KEY = "zeroday.user";

const AuthContext = createContext<AuthContextValue | null>(null);

// WebSocket URL из .env или значение по умолчанию
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8080";

function normalizeWsUrl(url: string): string {
  // Windows часто резолвит `localhost` в IPv6 (::1), а backend может слушать только IPv4.
  return url
    .replace(/^ws:\/\/localhost\b/i, "ws://127.0.0.1")
    .replace(/^wss:\/\/localhost\b/i, "wss://127.0.0.1");
}

type PendingAuthRequest = {
  resolve: () => void;
  reject: (error: Error) => void;
};

export function AuthProvider({
  children,
  wsUrlOverride
}: {
  children: React.ReactNode;
  wsUrlOverride?: string | null;
}) {
  const envWs = import.meta.env.VITE_WS_URL as string | undefined;
  const override = typeof wsUrlOverride === "string" ? wsUrlOverride.trim() : "";
  const wsUrlRaw = override.length > 0 ? override : envWs;
  const wsUrlFallback = wsUrlRaw && wsUrlRaw.trim().length > 0 ? wsUrlRaw : DEFAULT_WS_URL;
  const wsUrl = normalizeWsUrl(wsUrlFallback);
  const { readyState, lastMessage, sendJson } = useWebSocket(wsUrl);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);

  const pendingRequestRef = useRef<PendingAuthRequest | null>(null);
  const pendingTimeoutRef = useRef<number | null>(null);
  const didAuthorizeRef = useRef(false);
  const suppressNextSystemLoadingRef = useRef(false);

  const clearPendingTimeout = () => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const storedUser = localStorage.getItem(STORAGE_USER_KEY);

    if (storedToken) {
      setToken(storedToken);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        localStorage.removeItem(STORAGE_USER_KEY);
      }
    }

  }, []);

  useEffect(() => {
    if (readyState !== "open") {
      didAuthorizeRef.current = false;
    }
  }, [readyState]);

  // Auto-resume session: if we have a token from localStorage, ask backend to verify it.
  useEffect(() => {
    if (readyState !== "open") return;
    if (!token) return;
    if (didAuthorizeRef.current) return;

    didAuthorizeRef.current = true;
    suppressNextSystemLoadingRef.current = true; // do not show boot overlay on resume

    try {
      sendJson({ type: "Authorize", token } satisfies WsMessage);
    } catch {
      didAuthorizeRef.current = false;
    }
  }, [readyState, sendJson, token]);

  useEffect(() => {
    if (!lastMessage) return;

    let message: WsMessage | null = null;
    try {
      message = JSON.parse(lastMessage) as WsMessage;
    } catch {
      return;
    }
    if (!message) return;

    if (message.type === "AuthSuccess") {
      clearPendingTimeout();
      setToken(message.token);
      setUser(message.user);
      localStorage.setItem(STORAGE_TOKEN_KEY, message.token);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(message.user));
      // Сохраняем JWT токен для использования в Tauri FS
      localStorage.setItem("zeroday.jwt", message.token);

      // Disable session boot overlay after auth success to avoid flashing loading console.
      setSystemLoading(false);
      suppressNextSystemLoadingRef.current = true;

      pendingRequestRef.current?.resolve();
      pendingRequestRef.current = null;
      return;
    }

    if (message.type === "AuthError") {
      clearPendingTimeout();
      if (pendingRequestRef.current) {
        pendingRequestRef.current.reject(new Error(message.message));
        pendingRequestRef.current = null;
        return;
      }

      // AuthError without an in-flight login/register request => token is invalid/expired.
      logout();
      return;
    }

    if (message.type === "Error") {
      clearPendingTimeout();
      pendingRequestRef.current?.reject(new Error(`${message.code}: ${message.message}`));
      pendingRequestRef.current = null;
    }
  }, [lastMessage]);

  const login = (email: string, password: string) =>
    new Promise<void>((resolve, reject) => {
      clearPendingTimeout();
      if (pendingRequestRef.current) {
        pendingRequestRef.current.reject(new Error("Another auth request is already in progress"));
      }
      pendingRequestRef.current = { resolve, reject };
      pendingTimeoutRef.current = window.setTimeout(() => {
        pendingRequestRef.current?.reject(new Error("WebSocket auth timed out"));
        pendingRequestRef.current = null;
      }, 10000);
      suppressNextSystemLoadingRef.current = false;
      try {
        sendJson({
          type: "Login",
          email,
          password
        } satisfies WsMessage);
      } catch (error) {
        pendingRequestRef.current = null;
        clearPendingTimeout();
        reject(error instanceof Error ? error : new Error("Failed to send login request"));
      }
    });

  const register = (username: string, email: string, password: string) =>
    new Promise<void>((resolve, reject) => {
      clearPendingTimeout();
      if (pendingRequestRef.current) {
        pendingRequestRef.current.reject(new Error("Another auth request is already in progress"));
      }
      pendingRequestRef.current = { resolve, reject };
      pendingTimeoutRef.current = window.setTimeout(() => {
        pendingRequestRef.current?.reject(new Error("WebSocket auth timed out"));
        pendingRequestRef.current = null;
      }, 10000);
      suppressNextSystemLoadingRef.current = true;
      try {
        sendJson({
          type: "Register",
          username,
          email,
          password
        } satisfies WsMessage);
      } catch (error) {
        pendingRequestRef.current = null;
        clearPendingTimeout();
        reject(error instanceof Error ? error : new Error("Failed to send register request"));
      }
    });

  const logout = () => {
    clearPendingTimeout();
    pendingRequestRef.current = null;
    didAuthorizeRef.current = false;
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      wsState: readyState,
      isAuthenticated: Boolean(token),
      wsUrl,
      systemLoading,
      login,
      register,
      logout,
      sendJson,
      lastMessage
    }),
    [readyState, systemLoading, token, user, wsUrl, login, register, logout, sendJson, lastMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

