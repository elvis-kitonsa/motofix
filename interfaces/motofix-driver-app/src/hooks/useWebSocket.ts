// useWebSocket.ts — opens and maintains the live connection to the server.
//
// Given a logged-in user and token, it connects to the server's /ws/jobs channel and
// keeps that connection healthy: it sends a "ping" every 30s to stop it timing out,
// and automatically reconnects 3s after any drop. Exposes isConnected, the latest
// message received, and a sendMessage() function. Used by WebSocketContext, which
// shares one connection across the whole app.

import { useEffect, useRef, useState, useCallback } from 'react'

export function useWebSocket(userId: string | undefined, token: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<unknown>(null)

  const connect = useCallback(() => {
    if (!userId || !token || !mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Connect through the SAME origin as the page (Vite/nginx proxies /ws → dispatch).
    // This works on a phone over the LAN and over HTTPS (wss), unlike a hardcoded
    // ws://localhost. An explicit VITE_WS_URL still wins if provided.
    const envUrl = import.meta.env.VITE_WS_URL as string | undefined
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = envUrl || `${proto}//${window.location.host}/ws/jobs`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setIsConnected(true)
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, 30000)
    }

    ws.onmessage = e => {
      if (!mountedRef.current) return
      try {
        setLastMessage(JSON.parse(e.data))
      } catch {
        setLastMessage(e.data)
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setIsConnected(false)
      if (pingRef.current) clearInterval(pingRef.current)
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => { ws.close() }
  }, [userId, token])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (pingRef.current) clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { isConnected, lastMessage, sendMessage }
}
