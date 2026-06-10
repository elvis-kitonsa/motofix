import { Navigate, useLocation } from 'react-router-dom'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('motofix_sp_token')
  const location = useLocation()

  if (!token) return <Navigate to="/login" replace />

  // Enforce password change before accessing any protected page
  try {
    const raw = localStorage.getItem('motofix_sp_user')
    const user = raw ? JSON.parse(raw) : null
    if (user && user.password_changed === false && location.pathname !== '/change-password') {
      return <Navigate to="/change-password" replace />
    }
  } catch {
    // corrupt storage — let the page handle it
  }

  return <>{children}</>
}
