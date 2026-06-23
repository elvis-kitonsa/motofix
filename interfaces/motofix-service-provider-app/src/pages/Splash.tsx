// Splash.tsx — the very first intro screen ("/intro"): a brief branded animation that then
// continues into the welcome/entry flow. First step of the app's intro sequence.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'

type Phase = 'idle' | 'ring' | 'scan' | 'logo' | 'text' | 'ready' | 'caption' | 'exit'

const AMBER   = '#F59E0B'
const CHARS   = 'MOTOFIX'.split('')

const R        = 130
const R_OUTER  = 124
const R_DRAW   = 111
const R_ACCENT =  92
const CIRC     = 2 * Math.PI * R_DRAW  // ≈ 697.4

export default function Splash() {
  const [phase, setPhase] = useState<Phase>('idle')
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const badgeBg = isDark ? '#C47F09' : 'transparent'

  useEffect(() => {
    // Already signed in (and not expired by the 15-min inactivity guard) → skip the
    // splash and go straight to the dashboard, so the Back button never strands a
    // logged-in provider on the login flow.
    try {
      if (localStorage.getItem('motofix_sp_token')) {
        navigate('/dashboard', { replace: true })
        return
      }
    } catch { /* storage blocked */ }
    const schedule: [number, () => void][] = [
      [100,  () => setPhase('ring')],
      [900,  () => setPhase('scan')],
      [1400, () => setPhase('logo')],
      [2100, () => setPhase('text')],
      [3100, () => setPhase('ready')],
      [3900, () => setPhase('caption')],
      [6000, () => setPhase('exit')],
      [6650, () => navigate('/splash', { replace: true })],
    ]
    const timers = schedule.map(([ms, fn]) => setTimeout(fn, ms))
    return () => timers.forEach(clearTimeout)
  }, [navigate])

  const show = (from: Phase) => {
    const order: Phase[] = ['idle', 'ring', 'scan', 'logo', 'text', 'ready', 'caption', 'exit']
    return order.indexOf(phase) >= order.indexOf(from)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      background: 'var(--page-bg)',
      opacity: phase === 'exit' ? 0 : 1,
      transition: 'opacity 0.65s ease',
    }}>
      <GridBackground />

      {/* Corner brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((pos, i) => (
        <CornerBracket key={pos} pos={pos} visible={show('text')} delay={i * 80} />
      ))}

      {/* Scan line */}
      {show('scan') && (
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 1,
          pointerEvents: 'none', zIndex: 10,
          background: `linear-gradient(90deg, transparent, ${AMBER}cc, transparent)`,
          animation: 'sp-scan-line 1.2s ease forwards',
          boxShadow: `0 0 12px ${AMBER}99`,
        }} />
      )}

      {/* Main content column */}
      <div style={{ position: 'relative', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>

        {/* Ring + logo */}
        <div style={{ position: 'relative', flexShrink: 0, width: R * 2, height: R * 2 }}>

          <svg viewBox={`0 0 ${R * 2} ${R * 2}`} fill="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>

            {/* Faint static outer ring */}
            <circle cx={R} cy={R} r={R_OUTER} stroke={`${AMBER}33`} strokeWidth="1" />

            {/* Tick marks */}
            {show('ring') && Array.from({ length: 32 }).map((_, i) => {
              const angle = (i / 32) * 360
              const rad   = (angle * Math.PI) / 180
              const r2    = i % 4 === 0 ? R_OUTER - 9 : R_OUTER - 5
              return (
                <line key={i}
                  x1={R + R_OUTER * Math.cos(rad)} y1={R + R_OUTER * Math.sin(rad)}
                  x2={R + r2      * Math.cos(rad)} y2={R + r2      * Math.sin(rad)}
                  stroke={`${AMBER}${i % 4 === 0 ? 'a6' : '4d'}`}
                  strokeWidth={i % 4 === 0 ? 1.5 : 0.8}
                  style={{ opacity: 0, animation: `sp-tick-in 0.1s ease ${i * 18}ms forwards` }}
                />
              )
            })}

            {/* Animated drawing ring */}
            {show('ring') && (
              <circle cx={R} cy={R} r={R_DRAW}
                stroke={AMBER} strokeWidth="2" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC}
                transform={`rotate(-90 ${R} ${R})`}
                style={{
                  animation: 'sp-draw-ring 1.2s cubic-bezier(0.4,0,0.2,1) forwards',
                  filter: `drop-shadow(0 0 6px ${AMBER}b3)`,
                }}
              />
            )}

            {/* Inner dashed accent ring */}
            {show('logo') && (
              <circle cx={R} cy={R} r={R_ACCENT}
                stroke={`${AMBER}59`} strokeWidth="1" strokeDasharray="5 7"
                style={{ animation: 'sp-fade-in 0.4s ease forwards' }}
              />
            )}
          </svg>

          {/* Logo badge */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity:   show('logo') ? 1 : 0,
            transform: show('logo') ? 'scale(1)' : 'scale(0.3)',
            transition: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
          }}>
            <div style={{
              position: 'absolute', borderRadius: 24,
              width: 148, height: 148,
              background: `${AMBER}2e`, filter: 'blur(24px)',
              animation: show('logo') ? 'sp-pulse-halo 2.4s ease-in-out infinite' : undefined,
            }} />
            <div style={{
              position: 'relative', borderRadius: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 132, height: 132,
              background: badgeBg,
              border: `2.5px solid ${AMBER}e6`,
              boxShadow: show('logo')
                ? `0 0 0 1px ${AMBER}33, 0 0 32px ${AMBER}a6, 0 0 70px ${AMBER}40, inset 0 1px 0 ${AMBER}26`
                : 'none',
              animation: show('logo') ? 'sp-flicker 0.6s ease forwards' : undefined,
            }}>
              <img src="/motofix-logo.png" alt="MOTOFIX"
                style={{ width: 116, height: 116, objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
          </div>

          {/* Arc status labels */}
          {show('text') && (
            <>
              <div style={{ position: 'absolute', left: 0, right: 0, top: -22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, animation: 'sp-fade-in 0.4s ease 0.3s both' }}>
                <div style={{ height: 1, width: 20, background: `${AMBER}80` }} />
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: `${AMBER}b3`, textTransform: 'uppercase', letterSpacing: '0.32em', paddingLeft: '0.32em' }}>Mechanic · Towing</span>
                <div style={{ height: 1, width: 20, background: `${AMBER}80` }} />
              </div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: -22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, animation: 'sp-fade-in 0.4s ease 0.45s both' }}>
                <div style={{ height: 1, width: 20, background: `${AMBER}80` }} />
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: `${AMBER}b3`, textTransform: 'uppercase', letterSpacing: '0.32em', paddingLeft: '0.32em' }}>GPS Active</span>
                <div style={{ height: 1, width: 20, background: `${AMBER}80` }} />
              </div>
            </>
          )}
        </div>

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, overflow: 'hidden', height: 44, marginTop: 18 }}>
          {CHARS.map((char, i) => (
            <span key={i} style={{
              fontSize: '2.25rem', fontWeight: 900,
              letterSpacing: '0.15em', lineHeight: '2.5rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              color: isDark ? 'hsl(45,100%,95%)' : 'hsl(220,25%,6%)',
              display: 'inline-block',
              transform: show('text') ? 'translateY(0)' : 'translateY(48px)',
              opacity:   show('text') ? 1 : 0,
              transition: `transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 55}ms, opacity 0.25s ease ${i * 55}ms`,
            }}>
              {char}
            </span>
          ))}
        </div>

        {/* Sub-label */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          opacity:   show('text') ? 1 : 0,
          transform: show('text') ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s',
        }}>
          <div style={{ height: 1, width: 32, background: `${AMBER}99` }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.4em', textTransform: 'uppercase' as const, color: AMBER }}>Mechanic &amp; Towing</span>
          <div style={{ height: 1, width: 32, background: `${AMBER}99` }} />
        </div>

        {/* SYSTEM READY badge */}
        <div style={{
          opacity:   show('ready') ? 1 : 0,
          transform: show('ready') ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          marginTop: 4,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 9999,
            border: `1.5px solid ${AMBER}73`, background: `${AMBER}1f`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: AMBER, animation: 'sp-pulse-dot 1s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', color: AMBER }}>SYSTEM READY</span>
          </div>
        </div>

        {/* Caption */}
        <div style={{
          opacity:   show('caption') ? 1 : 0,
          transform: show('caption') ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
          marginTop: 6,
        }}>
          <p style={{ textAlign: 'center', lineHeight: 1.4, fontSize: 13 }}>
            <span style={{ color: 'var(--text-md)' }}>Every mechanic. Every road.</span>{' '}
            <span style={{ fontWeight: 700, color: AMBER, letterSpacing: '0.04em' }}>Every time.</span>
          </p>
        </div>

      </div>

      <style>{`
        @keyframes sp-draw-ring  { to { stroke-dashoffset: 0; } }
        @keyframes sp-tick-in    { to { opacity: 1; } }
        @keyframes sp-fade-in    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sp-scan-line {
          0%   { top: 15%; opacity: 0; }
          10%  { opacity: 1; }
          100% { top: 85%; opacity: 0; }
        }
        @keyframes sp-flicker {
          0%,19%,21%,23%,25%,54%,56%,100% { opacity: 1; }
          20%,22%,24%,55%                  { opacity: 0.35; }
        }
        @keyframes sp-pulse-dot {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.4; transform: scale(0.6); }
        }
        @keyframes sp-pulse-halo {
          0%,100% { opacity: 0.6; transform: scale(1);    }
          50%     { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes sp-bracket-tl { from { transform: translate(-12px,-12px); opacity: 0; } to { transform: translate(0,0); opacity: 1; } }
        @keyframes sp-bracket-tr { from { transform: translate(12px,-12px);  opacity: 0; } to { transform: translate(0,0); opacity: 1; } }
        @keyframes sp-bracket-bl { from { transform: translate(-12px,12px);  opacity: 0; } to { transform: translate(0,0); opacity: 1; } }
        @keyframes sp-bracket-br { from { transform: translate(12px,12px);   opacity: 0; } to { transform: translate(0,0); opacity: 1; } }
      `}</style>
    </div>
  )
}

function GridBackground() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0.4 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="sp-hud-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(245,158,11,0.18)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sp-hud-grid)" />
        </svg>
      </div>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 30%, var(--page-bg) 75%)',
      }} />
    </>
  )
}

function CornerBracket({ pos, visible, delay }: {
  pos: 'tl' | 'tr' | 'bl' | 'br'
  visible: boolean
  delay: number
}) {
  const size   = 20
  const stroke = 'rgba(245,158,11,0.75)'
  const paths: Record<typeof pos, string> = {
    tl: `M ${size} 0 L 0 0 L 0 ${size}`,
    tr: `M 0 0 L ${size} 0 L ${size} ${size}`,
    bl: `M 0 0 L 0 ${size} L ${size} ${size}`,
    br: `M 0 ${size} L ${size} ${size} L ${size} 0`,
  }
  const positions: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 28, left: 28 },
    tr: { top: 28, right: 28 },
    bl: { bottom: 28, left: 28 },
    br: { bottom: 28, right: 28 },
  }
  return (
    <div style={{
      position: 'absolute', zIndex: 30,
      ...positions[pos],
      opacity: visible ? 1 : 0,
      animation: visible ? `sp-bracket-${pos} 0.4s ease ${delay}ms both` : undefined,
    }}>
      <svg width={size} height={size} fill="none">
        <path d={paths[pos]} stroke={stroke} strokeWidth="2" strokeLinecap="square" />
      </svg>
    </div>
  )
}
