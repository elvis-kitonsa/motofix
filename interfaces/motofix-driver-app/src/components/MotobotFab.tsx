import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MotobotFace } from '@/components/MotobotFace'

const SIZE = 60
const POS_KEY = 'motofix_fab_pos'

/**
 * Floating MOTOBOT launcher — a round button with MOTOBOT's face, bottom-right on
 * the main logged-in screens. Tapping opens the chat (/fault-chat). Draggable:
 * drag it anywhere; the position is remembered. A tap (no drag) navigates.
 */
export function MotobotFab() {
  const navigate = useNavigate()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try { const r = localStorage.getItem(POS_KEY); return r ? JSON.parse(r) : null } catch { return null }
  })
  const drag = useRef({ active: false, moved: false, dx: 0, dy: 0, sx: 0, sy: 0 })

  const clamp = (v: number, max: number) => Math.min(Math.max(8, v), max)

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    drag.current = { active: true, moved: false, dx: e.clientX - rect.left, dy: e.clientY - rect.top, sx: e.clientX, sy: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return
    if (Math.hypot(e.clientX - drag.current.sx, e.clientY - drag.current.sy) > 6) drag.current.moved = true
    setPos({
      x: clamp(e.clientX - drag.current.dx, window.innerWidth - SIZE - 8),
      y: clamp(e.clientY - drag.current.dy, window.innerHeight - SIZE - 8),
    })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return
    drag.current.active = false
    if (drag.current.moved) {
      const r = e.currentTarget.getBoundingClientRect()
      try { localStorage.setItem(POS_KEY, JSON.stringify({ x: r.left, y: r.top })) } catch { /* ignore */ }
    } else {
      navigate('/fault-chat')
    }
  }

  const placement: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label="Ask MOTOBOT"
      title="Ask MOTOBOT — drag to move"
      style={{
        position: 'fixed',
        ...placement,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #F8B62B, #D97706)',
        border: '2px solid rgba(255,255,255,0.22)',
        boxShadow: '0 8px 26px rgba(245,158,11,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        cursor: 'pointer',
        touchAction: 'none',
        animation: pos ? 'motobot-pop 0.3s ease both' : 'motobot-pop 0.3s ease both, motobot-float 3.6s ease-in-out infinite',
      }}
    >
      <MotobotFace size={46} />
      <span
        style={{
          position: 'absolute',
          top: 3,
          right: 3,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#34D399',
          border: '2px solid #1a1206',
          boxShadow: '0 0 6px #34D399',
        }}
      />
      <style>{`
        @keyframes motobot-pop  { from { transform: scale(0); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes motobot-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
      `}</style>
    </button>
  )
}
