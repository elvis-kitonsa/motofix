// src/services/driverWs.ts
// Production-ready WebSocket client for real-time request status updates

import { REQUESTS_BASE_URL } from '@/config/api';

const WS_BASE = REQUESTS_BASE_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

export interface WsPayload {
  type: string;
  job_id?: number | string;
  request_id?: number | string;
  service_request_id?: number | string;
  status?: string;
  mechanic_id?: string;
  mechanic_name?: string;
  mechanic_lat?: number;
  mechanic_lon?: number;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

/**
 * Opens a WebSocket connection to the requests service with automatic
 * exponential-backoff reconnection. Reads the JWT from localStorage so
 * no import of a broken auth helper is needed.
 *
 * @returns cleanup function — call it when the consumer unmounts.
 */
export function createRequestsWs(
  onMessage: (payload: WsPayload) => void,
  onConnect?: () => void,
  onDisconnect?: () => void,
): { stop: () => void; send: (data: object) => void } {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let retryCount = 0;

  const connect = () => {
    if (stopped) return;

    const token = localStorage.getItem('motofix_token');
    // Pass token as query param so the backend can authenticate WS connections
    const url = `${WS_BASE}/ws/jobs${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      retryCount = 0;
      console.log('[WS] connected');
      onConnect?.();
    };

    ws.onmessage = (ev) => {
      try {
        const payload: WsPayload = JSON.parse(ev.data as string);
        onMessage(payload);
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      ws = null;
      onDisconnect?.();
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
      ws?.close();
    };
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    // Exponential backoff: 1s, 2s, 4s … capped at 30s
    const delay = Math.min(1000 * 2 ** retryCount, 30_000);
    retryCount = Math.min(retryCount + 1, 5);
    console.log(`[WS] reconnecting in ${delay}ms (attempt ${retryCount})`);
    reconnectTimer = setTimeout(connect, delay);
  };

  connect();

  const send = (data: object): void => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
    send,
  };
}
