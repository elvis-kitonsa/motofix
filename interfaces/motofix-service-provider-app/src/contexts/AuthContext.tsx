import { createContext, useContext, useState } from 'react'
import type { User } from '@/types'

interface AuthCtx {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('motofix_sp_user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('motofix_sp_token')
  )
  const [user, setUser] = useState<User | null>(readStoredUser)

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('motofix_sp_token', newToken)
    localStorage.setItem('motofix_sp_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('motofix_sp_token')
    localStorage.removeItem('motofix_sp_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, token,
      isAuthenticated: !!token,
      login, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
