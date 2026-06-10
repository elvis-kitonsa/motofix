import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'

const AMBER = '#F59E0B'

export default function ProviderSplash() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const hide  = setTimeout(() => setVisible(false), 1800)
    const leave = setTimeout(() => navigate('/entry', { replace: true }), 2150)
    return () => { clearTimeout(hide); clearTimeout(leave) }
  }, [navigate])

  return (
    <>
      <style>{`
        @keyframes sp-fade-in   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sp-slide-up  { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sp-spin-cw   { to { transform: rotate(360deg);  } }
        @keyframes sp-spin-ccw  { to { transform: rotate(-360deg); } }
        @keyframes sp-pulse-amber {
          0%,100% { box-shadow: 0 0 0 1px rgba(245,158,11,0.3), 0 0 28px rgba(245,158,11,0.45); }
          50%     { box-shadow: 0 0 0 1px rgba(245,158,11,0.5), 0 0 44px rgba(245,158,11,0.65); }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--page-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.35s ease',
        animation: 'sp-fade-in 0.3s ease both',
      }}>

        {/* Label + heading */}
        <div style={{ textAlign: 'center', animation: 'sp-slide-up 0.4s ease 0.08s both' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10, color: AMBER }}>
            MOTOFIX
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.25, color: 'var(--text-hi)' }}>
            Welcome to Service Provider View<br />
            <span style={{ color: AMBER }}>of MOTOFIX</span>
          </h1>
        </div>

        {/* Concentric spinner */}
        <div style={{ animation: 'sp-slide-up 0.4s ease 0.18s both' }}>
          <div style={{ position: 'relative', width: 200, height: 200 }}>

            {/* Slowest outer dashed ring */}
            <div style={{ position: 'absolute', inset: 0, animation: 'sp-spin-cw 10s linear infinite' }}>
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="96" stroke={`${AMBER}33`} strokeWidth="1" strokeDasharray="8 6" />
              </svg>
            </div>

            {/* Outer fast arc */}
            <div style={{ position: 'absolute', inset: 0, animation: 'sp-spin-cw 1.8s linear infinite' }}>
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="90"
                  stroke={AMBER} strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray="120 446"
                  style={{ filter: `drop-shadow(0 0 6px ${AMBER}99)` }} />
              </svg>
            </div>

            {/* Middle counter-rotating dashed ring */}
            <div style={{ position: 'absolute', inset: 28, animation: 'sp-spin-ccw 3s linear infinite' }}>
              <svg width="144" height="144" viewBox="0 0 144 144" fill="none">
                <circle cx="72" cy="72" r="68" stroke={`${AMBER}55`} strokeWidth="1.5" strokeDasharray="5 9" />
              </svg>
            </div>

            {/* Inner fast arc */}
            <div style={{ position: 'absolute', inset: 48, animation: 'sp-spin-cw 1.1s linear infinite' }}>
              <svg width="104" height="104" viewBox="0 0 104 104" fill="none">
                <circle cx="52" cy="52" r="48"
                  stroke={`${AMBER}66`} strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="48 254" />
              </svg>
            </div>

            {/* Logo badge — amber bg in dark, transparent in light (logo shows naturally) */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute', width: 100, height: 100, borderRadius: 24,
                background: `${AMBER}1A`, filter: 'blur(16px)',
                animation: 'sp-pulse-amber 2s ease-in-out infinite',
              }} />
              <div style={{
                position: 'relative', width: 88, height: 88, borderRadius: 20,
                background: isDark ? AMBER : 'transparent',
                border: `2.5px solid ${AMBER}CC`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'sp-pulse-amber 2s ease-in-out infinite',
              }}>
                <img src="/motofix-logo.png" alt="MOTOFIX"
                  style={{ width: 72, height: 72, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
