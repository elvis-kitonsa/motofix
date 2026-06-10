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
