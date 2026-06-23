// WebSocketContext.tsx — one shared live connection to the server.
//
// A WebSocket is an always-open line the server can push messages down at any time
// (used for live job/location updates). We open ONE here and share it app-wide via
// useWS(), instead of every component opening its own.
//
// It reads the logged-in user + token from storage to authenticate the connection,
// and re-reads them whenever login changes (the 'motofix:auth-changed' event) so the
// socket reconnects as the right user. The actual connect/reconnect logic is in the
// useWebSocket hook; this file just supplies the credentials and shares the result.

import { createContext, useContext, useState, useEffect } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'

interface WSCtx {
  isConnected: boolean
  lastMessage: unknown
  sendMessage: (data: object) => void
}

const WebSocketContext = createContext<WSCtx>({
  isConnected: false,
  lastMessage: null,
  sendMessage: () => {},
})

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [token, setToken] = useState<string | null>(null)

  const readFromStorage = () => {
    setToken(localStorage.getItem('motofix_token'))
    const raw = localStorage.getItem('motofix_user')
    if (raw) {
      try {
        const u = JSON.parse(raw)
        setUserId(u.id ?? u.phone)
      } catch { /* ignore */ }
    } else {
      setUserId(undefined)
    }
  }

  useEffect(() => {
    readFromStorage()
    window.addEventListener('motofix:auth-changed', readFromStorage)
    return () => window.removeEventListener('motofix:auth-changed', readFromStorage)
  }, [])

  const { isConnected, lastMessage, sendMessage } = useWebSocket(userId, token)

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWS = () => useContext(WebSocketContext)
