// BackLogoutGuard.tsx — traps the browser Back button so the mechanic doesn't accidentally
// leave the app; instead it asks whether they want to log out. Staying keeps the session.

import { useEffect, useState } from 'react'
import { C } from '@/styles/tokens'

/**
 * Traps the browser Back button on the dashboard. Instead of leaving the app
 * (which would land on the login flow), it re-arms history and asks whether to
 * log out. Staying keeps the session intact.
 */
export default function BackLogoutGuard({ onLogout }: { onLogout: () => void }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      window.history.pushState(null, '', window.location.href)
      setShow(true)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (!show) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 360, borderRadius: 22, background: C.surface1, border: `1px solid ${C.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', padding: '24px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: C.textHi, marginBottom: 6 }}>Log out of MOTOFIX?</h2>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.55, marginBottom: 20 }}>You're still signed in. Stay on MOTOFIX, or log out?</p>
        <button onClick={() => setShow(false)} style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`, color: '#111', fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Stay logged in</button>
        <button onClick={onLogout} style={{ width: '100%', height: 46, borderRadius: 14, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444', fontWeight: 700, fontSize: 14 }}>Log out</button>
      </div>
    </div>
  )
}
