// src/services/ws.ts
// Lightweight WebSocket helper for the mechanic app
import { getToken } from './api';

const API_BASE_URL = (import.meta.env.VITE_REQUESTS_URL as unknown as string) || '';

export type JobEvent =
  | { type: 'new_job'; job: any; expires_at?: string }
  | { type: 'job_taken'; job_id: number; mechanic: { id: number; name: string }; eta_minutes?: number; taken_at?: string };

export function connectJobsWebSocket(onEvent: (evt: JobEvent) => void) {
  // Don't attempt to connect if no backend URL is configured (e.g. local dev without backend)
  if (!API_BASE_URL) {
    console.info('[WS] No VITE_REQUESTS_URL set — skipping WebSocket connection in dev');
    return { close: () => {} };
  }

  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws/jobs';
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let attempts = 0;
  let closed = false; // set by close() to permanently stop all reconnects

  function connect() {
    if (closed) return;
    const token = getToken();
    const url = token ? `${wsUrl}?token=${token}` : wsUrl;

    ws = new WebSocket(url);

    ws.onopen = () => {
      attempts = 0; // reset backoff on successful connect
      console.log('[WS] connected to', url);
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        onEvent(data);
      } catch (err) {
        console.warn('[WS] failed to parse message', err);
      }
    };

    ws.onclose = (ev) => {
      // onclose fires asynchronously even after close() is called — guard against it
      if (closed) return;
      // Exponential backoff: 2s, 4s, 8s, capped at 30s
      attempts++;
      const delay = Math.min(2000 * Math.pow(2, attempts - 1), 30000);
      console.log(`[WS] closed - will retry in ${delay / 1000}s`, ev.reason);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // Suppress noisy error event — the close handler will manage reconnection
      ws?.close();
    };
  }

  connect();

  return {
    close: () => {
      closed = true; // must be set before ws.close() so onclose sees it
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}