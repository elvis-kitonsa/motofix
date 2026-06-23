// InactivityGuard.tsx — tracks user activity for the 15-minute auto-logout, and if the last
// page load found an expired session, shows a "signed out for inactivity" notice that sends
// the mechanic back to login.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ArrowRight } from 'lucide-react'
import { markActivity, startActivity, wasInactivityLogout, clearInactivity } from '@/utils/sessionTimeout'

const AMBER = '#F59E0B'

/**
 * Tracks user activity (to drive the 15-minute inactivity timeout) and, if the last
 * page load detected an expired session, shows a blocking "signed out for inactivity"
 * notice. Tapping "Go ahead" sends the user through the splash flow back to login.
 */
export default function InactivityGuard() {
  const navigate = useNavigate()
  const [show, setShow] = useState(() => wasInactivityLogout())

  useEffect(() => {
    // Start the clock for the current session, then keep it fresh on interaction.
    startActivity()
    const onActivity = () => markActivity()
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, onActivity))
  }, [])

  if (!show) return null

  const goAhead = () => {
    clearInactivity()
    setShow(false)
    navigate('/intro', { replace: true }) // splash → entry → login
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface-1, #14141f)', borderRadius: 22, border: '1px solid var(--border-2, rgba(255,255,255,0.12))', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 18px', background: `${AMBER}1e`, border: `1.5px solid ${AMBER}45`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clock style={{ width: 30, height: 30, color: AMBER }} />
        </div>
        <h2 style={{ color: 'var(--text-hi, #fff)', fontWeight: 900, fontSize: 19, marginBottom: 8 }}>Signed out for inactivity</h2>
        <p style={{ color: 'var(--text-md, rgba(255,255,255,0.65))', fontSize: 13.5, lineHeight: 1.6, marginBottom: 22 }}>
          You were away for more than 15 minutes, so we signed you out to keep your account secure. Please log back in to continue.
        </p>
        <button onClick={goAhead}
          style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${AMBER}, #D97706)`, color: '#000', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          Go ahead <ArrowRight style={{ width: 17, height: 17 }} />
        </button>
      </div>
    </div>
  )
}
