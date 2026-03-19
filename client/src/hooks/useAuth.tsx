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
};

const STORAGE_TOKEN_KEY = "zeroday.token";
const STORAGE_USER_KEY = "zeroday.user";

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const envWs = import.meta.env.VITE_WS_URL as string;
  const wsUrl = (wsUrlOverride && wsUrlOverride.trim().length > 0 ? wsUrlOverride.trim() : envWs) || envWs;
  const { readyState, lastMessage, sendJson } = useWebSocket(wsUrl);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);

  const pendingRequestRef = useRef<PendingAuthRequest | null>(null);

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
    if (!lastMessage) return;

    let message: WsMessage | null = null;
    try {
      message = JSON.parse(lastMessage) as WsMessage;
    } catch {
      return;
    }
    if (!message) return;

    if (message.type === "AuthSuccess") {
      setToken(message.token);
      setUser(message.user);
      localStorage.setItem(STORAGE_TOKEN_KEY, message.token);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(message.user));

      setSystemLoading(true);
      window.setTimeout(() => setSystemLoading(false), 1700);

      pendingRequestRef.current?.resolve();
      pendingRequestRef.current = null;
      return;
    }

    if (message.type === "AuthError") {
      pendingRequestRef.current?.reject(new Error(message.message));
      pendingRequestRef.current = null;
      return;
    }

    if (message.type === "Error") {
      pendingRequestRef.current?.reject(new Error(`${message.code}: ${message.message}`));
      pendingRequestRef.current = null;
    }
  }, [lastMessage]);

  const login = (email: string, password: string) =>
    new Promise<void>((resolve, reject) => {
      pendingRequestRef.current = { resolve, reject };
      try {
        sendJson({
          type: "Login",
          email,
          password
        } satisfies WsMessage);
      } catch (error) {
        pendingRequestRef.current = null;
        reject(error instanceof Error ? error : new Error("Failed to send login request"));
      }
    });

  const register = (username: string, email: string, password: string) =>
    new Promise<void>((resolve, reject) => {
      pendingRequestRef.current = { resolve, reject };
      try {
        sendJson({
          type: "Register",
          username,
          email,
          password
        } satisfies WsMessage);
      } catch (error) {
        pendingRequestRef.current = null;
        reject(error instanceof Error ? error : new Error("Failed to send register request"));
      }
    });

  const logout = () => {
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
      logout
    }),
    [readyState, systemLoading, token, user, wsUrl]
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

