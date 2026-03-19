import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReadyState = "connecting" | "open" | "closed" | "error";

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [readyState, setReadyState] = useState<ReadyState>("connecting");
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setReadyState("connecting");

    ws.onopen = () => setReadyState("open");
    ws.onclose = () => setReadyState("closed");
    ws.onerror = () => setReadyState("error");
    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        setLastMessage(event.data);
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore close race
      }
    };
  }, [url]);

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

