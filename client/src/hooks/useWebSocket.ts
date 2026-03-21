import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReadyState = "connecting" | "open" | "closed" | "error";

// WebSocket URL из .env или значение по умолчанию
const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8080";

export function useWebSocket(url?: string) {
  const wsUrl = url || DEFAULT_WS_URL;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const backoffMsRef = useRef(500);
  const shouldReconnectRef = useRef(true);
  const [readyState, setReadyState] = useState<ReadyState>("connecting");
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    shouldReconnectRef.current = true;
    attemptsRef.current = 0;
    backoffMsRef.current = 500;
    setLastMessage(null);

    const clearTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (!shouldReconnectRef.current) return;
      attemptsRef.current += 1;
      const delay = Math.min(10000, backoffMsRef.current * Math.pow(2, attemptsRef.current - 1));
      backoffMsRef.current = delay;

      clearTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    };

    const connect = () => {
      setReadyState("connecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        setReadyState("error");
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        backoffMsRef.current = 500;
        setReadyState("open");
      };
      ws.onclose = () => {
        setReadyState("closed");
        scheduleReconnect();
      };
      ws.onerror = () => {
        setReadyState("error");
        // onclose will also trigger scheduleReconnect
      };
      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          setLastMessage(event.data);
        }
      };
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearTimer();
      try {
        wsRef.current?.close();
      } catch {
        // ignore close race
      }
    };
  }, [wsUrl]);

  const sendRaw = useCallback((payload: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    ws.send(payload);
  }, []);

  const sendJson = useCallback(
    (payload: unknown) => {
      sendRaw(JSON.stringify(payload));
    },
    [sendRaw]
  );

  return useMemo(
    () => ({
      readyState,
      lastMessage,
      sendRaw,
      sendJson
    }),
    [lastMessage, readyState, sendJson, sendRaw]
  );
}

