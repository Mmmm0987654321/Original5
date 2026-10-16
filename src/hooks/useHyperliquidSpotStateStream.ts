import { useCallback, useEffect, useRef, useState } from "react";

type Hex = `0x${string}`;

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface SpotStreamState {
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  spotState?: any;
}

const HL_MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws";

function sameHex(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function useHyperliquidSpotStateStream(user?: string | Hex | null): SpotStreamState {
  const [state, setState] = useState<SpotStreamState>({
    isConnected: false,
    connectionStatus: "disconnected",
    spotState: undefined,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCount = useRef<number>(0);
  const userRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      try {
        socket.close();
      } catch {
        /* ignore close errors */
      }
    }

    setState((s) => ({
      ...s,
      isConnected: false,
      connectionStatus: "disconnected",
    }));
  }, []);

  const connect = useCallback(() => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setState((s) => ({
      ...s,
      connectionStatus: "connecting",
    }));

    try {
      const ws = new WebSocket(HL_MAINNET_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws) return;

        retryCount.current = 0;

        setState((s) => ({
          ...s,
          isConnected: true,
          connectionStatus: "connected",
        }));

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN && userRef.current) {
            ws.send(
              JSON.stringify({
                method: "subscribe",
                subscription: {
                  type: "spotState",
                  user: userRef.current,
                },
              })
            );
          }
        }, 50);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                method: "ping",
              })
            );
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.method === "pong") return;

          const channel = msg?.channel;
          const data = msg?.data;
          if (!channel) return;

          const frameUser =
            typeof data?.user === "string" ? data.user : null;

          if (
            frameUser &&
            userRef.current &&
            !sameHex(frameUser, userRef.current)
          ) {
            return;
          }

          if (channel === "spotState") {
            setState((s) => ({
              ...s,
              spotState: data?.spotState ?? data,
            }));
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = () => {
        if (wsRef.current === ws) {
          setState((s) => ({
            ...s,
            connectionStatus: "error",
          }));
        }
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        setState((s) => ({
          ...s,
          isConnected: false,
          connectionStatus: "disconnected",
        }));

        wsRef.current = null;

        retryCount.current += 1;
        const delay = Math.min(
          1000 * Math.pow(2, retryCount.current - 1),
          30000
        );

        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    } catch {
      setState((s) => ({
        ...s,
        connectionStatus: "error",
      }));
    }
  }, []);

  useEffect(() => {
    userRef.current = user ?? null;
    retryCount.current = 0;

    disconnect();

    setState({
      isConnected: false,
      connectionStatus: user ? "connecting" : "disconnected",
      spotState: undefined,
    });

    if (!user) return;

    connect();

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    isConnected: state.isConnected,
    connectionStatus: state.connectionStatus,
    spotState: state.spotState,
  };
}
