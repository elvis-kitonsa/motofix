// useWebSocket.ts — opens and maintains the live server connection (/ws/jobs). It pings
// periodically to stay alive and auto-reconnects after a drop. Exposes isConnected, the
// latest message, and sendMessage(). WebSocketContext uses it to share one connection app-wide.

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

    // Build WS URL relative to the current Vite dev server so it always goes through
    // Vite's /ws proxy regardless of which port Vite auto-assigned (avoids stale VITE_WS_URL).
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/jobs?token=${token}`
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

    ws.onerror = () => {
      ws.close()
    }
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
