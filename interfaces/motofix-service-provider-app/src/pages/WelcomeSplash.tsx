import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

const AMBER = '#F59E0B'

const MESSAGES = [
  'Verifying your credentials…',
  'Loading your profile…',
  'Syncing job requests…',
  'All set — welcome back!',
]

type Phase = 'loading' | 'success'

export default function WelcomeSplash() {
  const navigate       = useNavigate()
  const { user }       = useAuth()
  const { isDark }     = useTheme()
  const [msgIdx, setMsgIdx] = useState(0)
  const [phase,  setPhase]  = useState<Phase>('loading')
  const doneFired = useRef(false)

  const firstName = user?.full_name?.trim().split(' ')[0] ?? 'Provider'

  // theme-dependent values
  const pageBg      = isDark ? '#0c0e18' : 'hsl(220,20%,96%)'
  const badgeBg     = isDark ? '#0c0e18' : '#ffffff'
  const textHi      = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)'
  const textLo      = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'
  const textFaint   = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.35)'
  const stepBg      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'
  const stepBorder  = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'
  // ring opacities: light mode needs more contrast against pale background
  const r1 = isDark ? '30' : '77'   // outer dashed
  const r2 = isDark ? '55' : 'aa'   // middle dashed
  const r3 = isDark ? '66' : 'bb'   // inner arc

  useEffect(() => {
    const timers = MESSAGES.map((_, i) =>
      setTimeout(() => setMsgIdx(i), i * 900)
    )
    const done = setTimeout(() => {
      if (!doneFired.current) { doneFired.current = true; setPhase('success') }
    }, MESSAGES.length * 900)
    return () => { timers.forEach(clearTimeout); clearTimeout(done) }
  }, [])

  useEffect(() => {
    if (phase !== 'success') return
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 2400)
    return () => clearTimeout(t)
  }, [phase, navigate])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: pageBg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: isDark ? `${AMBER}16` : `${AMBER}22`,
        filter: 'blur(72px)', pointerEvents: 'none',
      }} />

      {/* ── SUCCESS OVERLAY ── */}
      {phase === 'success' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: pageBg,
          animation: 'ws-fade-in 0.5s ease both',
        }}>
          <div style={{ position: 'relative', marginBottom: 24, width: 100, height: 100 }}>
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="44"
                stroke={`${AMBER}33`} strokeWidth="2" />
              <circle cx="50" cy="50" r="44"
                stroke={AMBER} strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray="276.5" transform="rotate(-90 50 50)"
                style={{
                  strokeDashoffset: 276.5,
                  animation: 'ws-draw-circle 0.55s cubic-bezier(0.4,0,0.2,1) 0.05s forwards',
                  filter: `drop-shadow(0 0 8px ${AMBER}99)`,
                }} />
              <path d="M28 50 L44 66 L72 34"
                stroke={AMBER} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="60"
                style={{
                  strokeDashoffset: 60,
                  animation: 'ws-draw-check 0.38s cubic-bezier(0.4,0,0.2,1) 0.48s forwards',
                  filter: `drop-shadow(0 0 6px ${AMBER}cc)`,
                }} />
            </svg>
          </div>

          <h2 style={{
            fontSize: 24, fontWeight: 900, color: textHi,
            marginBottom: 6, animation: 'ws-slide-up 0.5s ease 0.8s both',
          }}>
            Welcome back, {firstName}!
          </h2>
          <p style={{
            fontSize: 13, color: textLo,
            animation: 'ws-slide-up 0.5s ease 0.95s both',
          }}>
            You're live on the{' '}
            <span style={{ color: AMBER, fontWeight: 700 }}>MOTOFIX</span> network.
          </p>
          <p style={{
            fontSize: 11, color: textFaint, marginTop: 10,
            animation: 'ws-slide-up 0.5s ease 1.1s both',
          }}>
            Taking you to your dashboard…
          </p>
          <div style={{
            marginTop: 20, height: 2, width: 120, borderRadius: 99,
            background: `${AMBER}22`, overflow: 'hidden',
            animation: 'ws-slide-up 0.5s ease 1.4s both',
          }}>
            <div style={{
              height: '100%', background: AMBER, borderRadius: 99,
              animation: 'ws-progress 1.9s linear 1.5s both',
            }} />
          </div>
        </div>
      )}

      {/* ── LOADING: RINGS + STEPS ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 40,
      }}>

        {/* Concentric spinning rings + logo */}
        <div style={{ position: 'relative', width: 200, height: 200 }}>

          <div style={{ position: 'absolute', inset: 0, animation: 'ws-cw 10s linear infinite' }}>
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="96"
                stroke={`${AMBER}${r1}`} strokeWidth="1" strokeDasharray="8 6" />
            </svg>
          </div>

          <div style={{ position: 'absolute', inset: 0, animation: 'ws-cw 1.8s linear infinite' }}>
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="90"
                stroke={AMBER} strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray="120 446"
                style={{ filter: `drop-shadow(0 0 6px ${AMBER}99)` }} />
            </svg>
          </div>

          <div style={{ position: 'absolute', inset: 28, animation: 'ws-ccw 3s linear infinite' }}>
            <svg width="144" height="144" viewBox="0 0 144 144" fill="none">
              <circle cx="72" cy="72" r="68"
                stroke={`${AMBER}${r2}`} strokeWidth="1.5" strokeDasharray="5 9" />
            </svg>
          </div>

          <div style={{ position: 'absolute', inset: 48, animation: 'ws-cw 1.1s linear infinite' }}>
            <svg width="104" height="104" viewBox="0 0 104 104" fill="none">
              <circle cx="52" cy="52" r="48"
                stroke={`${AMBER}${r3}`} strokeWidth="2" strokeLinecap="round"
                strokeDasharray="48 254" />
            </svg>
          </div>

          {/* Logo badge */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', width: 100, height: 100, borderRadius: '50%',
              background: `${AMBER}1a`, filter: 'blur(16px)',
              animation: 'ws-pulse-badge 2s ease-in-out infinite',
            }} />
            <div style={{
              position: 'relative', width: 88, height: 88, borderRadius: 22,
              background: badgeBg,
              border: `2.5px solid ${AMBER}e6`,
              boxShadow: `0 0 0 1px ${AMBER}22, 0 0 24px ${AMBER}88, 0 0 52px ${AMBER}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'ws-pulse-badge 2s ease-in-out infinite',
            }}>
              <img src="/motofix-logo.png" alt="MOTOFIX"
                style={{ width: 72, height: 72, objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
          </div>
        </div>

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 240 }}>
          {MESSAGES.map((msg, i) => {
            const done    = i < msgIdx
            const current = i === msgIdx
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: i > msgIdx ? 0.25 : 1,
                transition: 'opacity 0.4s ease',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? `${AMBER}28` : current ? `${AMBER}18` : stepBg,
                  border: `1.5px solid ${done || current ? AMBER + '88' : stepBorder}`,
                  transition: 'background 0.3s ease, border-color 0.3s ease',
                  animation: current ? 'ws-ring-pulse 1.2s ease-in-out infinite' : undefined,
                }}>
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5 L4 7 L8 3"
                        stroke={AMBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="9" strokeDashoffset="9"
                        style={{ animation: 'ws-draw-tick 0.35s cubic-bezier(0.4,0,0.2,1) forwards' }} />
                    </svg>
                  ) : current ? (
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', background: AMBER,
                      animation: 'ws-dot-pulse 1s ease-in-out infinite',
                    }} />
                  ) : null}
                </div>

                <span style={{
                  fontSize: 13,
                  color: done ? `${AMBER}cc` : current ? textHi : textLo,
                  fontWeight: current ? 600 : 400,
                  animation: current ? 'ws-fade-in-up 0.35s ease' : undefined,
                }}>
                  {msg}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes ws-cw    { to { transform: rotate(360deg);  } }
        @keyframes ws-ccw   { to { transform: rotate(-360deg); } }
        @keyframes ws-pulse-badge {
          0%,100% { box-shadow: 0 0 0 1px ${AMBER}33, 0 0 24px ${AMBER}66; }
          50%     { box-shadow: 0 0 0 1px ${AMBER}55, 0 0 44px ${AMBER}99; }
        }
        @keyframes ws-ring-pulse {
          0%,100% { box-shadow: 0 0 0 0   ${AMBER}44; }
          50%     { box-shadow: 0 0 0 4px ${AMBER}18; }
        }
        @keyframes ws-dot-pulse {
          0%,100% { opacity: 1;   transform: scale(1);   }
          50%     { opacity: 0.4; transform: scale(0.6); }
        }
        @keyframes ws-draw-tick   { to { stroke-dashoffset: 0; } }
        @keyframes ws-draw-circle { to { stroke-dashoffset: 0; } }
        @keyframes ws-draw-check  { to { stroke-dashoffset: 0; } }
        @keyframes ws-fade-in     { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ws-fade-in-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes ws-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes ws-progress {
          from { width: 0%; } to { width: 100%; }
        }
      `}</style>
    </div>
  )
}
