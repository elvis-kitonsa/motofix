// WebSocketContext.tsx — one shared live connection to the server, exposed app-wide via
// useWS(). It authenticates using the logged-in provider (from AuthContext) so the server
// can route job events to the right mechanic. Only mounted inside the logged-in area
// (see ProtectedArea in App.tsx). The connect/reconnect logic lives in the useWebSocket hook.

import { createContext, useContext } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from './AuthContext'

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
  const { user, token, isAuthenticated } = useAuth()
  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    isAuthenticated ? (user?.id ?? undefined) : undefined,
    isAuthenticated ? token : null
  )

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWS = () => useContext(WebSocketContext)
