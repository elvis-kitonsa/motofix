// ChangePassword.tsx — lets a logged-in provider set a new password (e.g. after first login
// with a temporary one). Validates the new password and saves it via mechanicService.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { mechanicService } from '@/config/api'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

const AMBER = '#F59E0B'

export default function ChangePassword() {
  const navigate  = useNavigate()
  const { user, login, token } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showCur,    setShowCur]    = useState(false)
  const [showNew,    setShowNew]    = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [curFocused, setCurFocused] = useState(false)
  const [newFocused, setNewFocused] = useState(false)
  const [conFocused, setConFocused] = useState(false)

  const strength = (() => {
    if (newPw.length === 0) return 0
    let s = 0
    if (newPw.length >= 8)                        s++
    if (/[A-Z]/.test(newPw))                      s++
    if (/[0-9]/.test(newPw))                      s++
    if (/[^A-Za-z0-9]/.test(newPw))               s++
    return s
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', '#ef4444', '#f59e0b', '#22c55e', '#22c55e'][strength]

  const canSubmit =
    currentPw.length >= 4 &&
    newPw.length >= 8 &&
    newPw === confirmPw &&
    !loading

  const inputBorder = (focused: boolean) =>
    isDark
      ? (focused ? AMBER : 'rgba(255,255,255,0.10)')
      : (focused ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.25)')

  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    if (newPw !== confirmPw) {
      toast.error('Passwords do not match')
      return
    }
    if (newPw === currentPw) {
      toast.error('New password must be different from your current password')
      return
    }

    setLoading(true)
    try {
      await mechanicService.changePassword(currentPw, newPw)

      // Update stored user so password_changed = true — prevents redirect loop on refresh
      if (user && token) {
        login(token, { ...user, password_changed: true })
      }

      toast.success('Password changed successfully')
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = e?.response?.data?.detail
      const msg = typeof detail === 'object' && detail !== null
        ? detail.message ?? 'Failed to change password'
        : typeof detail === 'string' ? detail : 'Failed to change password'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes sp-fade-up { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sp-spin     { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

        {/* Dot texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: isDark ? 0.025 : 0.055, backgroundImage: `radial-gradient(circle, ${AMBER} 1px, transparent 1px)`, backgroundSize: '28px 28px', pointerEvents: 'none' }} />
        {/* Warm glow */}
        <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 320, borderRadius: '50%', background: isDark ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.09)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px 48px', maxWidth: 440, margin: '0 auto', width: '100%', animation: 'sp-fade-up 0.45s ease 0.08s both' }}>

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', marginBottom: 18 }}>
              <ShieldCheck style={{ width: 11, height: 11, color: AMBER }} />
              <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: AMBER }}>Security Setup</span>
            </div>

            <div style={{ width: 60, height: 60, borderRadius: 16, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(245,158,11,0.35)', marginBottom: 20 }}>
              <KeyRound style={{ width: 28, height: 28, color: '#fff' }} />
            </div>

            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 22, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Set your password
            </h1>
            <p style={{ color: 'var(--text-md)', fontSize: 13, textAlign: 'center', lineHeight: 1.65, maxWidth: 300 }}>
              You were given a temporary password when your account was approved. Set a permanent one to continue.
            </p>
          </div>

          {/* Notice banner */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', marginBottom: 20 }}>
            <ShieldCheck style={{ width: 15, height: 15, color: AMBER, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: isDark ? 'rgba(253,211,77,0.88)' : 'rgba(146,98,10,0.9)', lineHeight: 1.6, margin: 0 }}>
              This step is required before you can access the dashboard. You cannot skip it.
            </p>
          </div>

          {/* Form card */}
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            border: isDark ? '1.5px solid rgba(255,255,255,0.10)' : '1.5px solid #000',
            boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.45)' : 'var(--card-shadow)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          }}>
            {isDark && (
              <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${AMBER}bb, #F59E0B, ${AMBER}bb, transparent)` }} />
            )}

            <div style={{ padding: '24px 24px 28px', background: 'var(--surface-1)' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Current (temporary) password */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>
                    Temporary Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: curFocused ? (isDark ? AMBER : 'var(--text-hi)') : 'var(--text-lo)', transition: 'color 0.2s', pointerEvents: 'none' }} />
                    <input
                      type={showCur ? 'text' : 'password'}
                      placeholder="Enter the password from SMS"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      onFocus={() => setCurFocused(true)}
                      onBlur={() => setCurFocused(false)}
                      autoComplete="current-password"
                      style={{ width: '100%', height: 50, paddingLeft: 42, paddingRight: 48, borderRadius: 12, background: inputBg, border: `1.5px solid ${inputBorder(curFocused)}`, color: 'var(--text-hi)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
                    />
                    <button type="button" onClick={() => setShowCur(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-lo)' }}>
                      {showCur ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: newFocused ? (isDark ? AMBER : 'var(--text-hi)') : 'var(--text-lo)', transition: 'color 0.2s', pointerEvents: 'none' }} />
                    <input
                      type={showNew ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      onFocus={() => setNewFocused(true)}
                      onBlur={() => setNewFocused(false)}
                      autoComplete="new-password"
                      style={{ width: '100%', height: 50, paddingLeft: 42, paddingRight: 48, borderRadius: 12, background: inputBg, border: `1.5px solid ${inputBorder(newFocused)}`, color: 'var(--text-hi)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
                    />
                    <button type="button" onClick={() => setShowNew(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-lo)' }}>
                      {showNew ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                  {/* Strength meter */}
                  {newPw.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColor : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'), transition: 'background 0.3s' }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: strengthColor, margin: 0, fontWeight: 700 }}>{strengthLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirm new password */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: conFocused ? (isDark ? AMBER : 'var(--text-hi)') : 'var(--text-lo)', transition: 'color 0.2s', pointerEvents: 'none' }} />
                    <input
                      type={showConf ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      onFocus={() => setConFocused(true)}
                      onBlur={() => setConFocused(false)}
                      autoComplete="new-password"
                      style={{ width: '100%', height: 50, paddingLeft: 42, paddingRight: 48, borderRadius: 12, background: inputBg, border: `1.5px solid ${confirmPw.length > 0 && confirmPw !== newPw ? '#ef4444' : inputBorder(conFocused)}`, color: 'var(--text-hi)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
                    />
                    <button type="button" onClick={() => setShowConf(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-lo)' }}>
                      {showConf ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                  {confirmPw.length > 0 && confirmPw !== newPw && (
                    <p style={{ fontSize: 11, color: '#ef4444', marginTop: 5, paddingLeft: 2 }}>Passwords do not match</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    width: '100%', height: 50, borderRadius: 12, border: 'none', marginTop: 2,
                    background: canSubmit ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--surface-3)',
                    color: canSubmit ? '#fff' : 'var(--text-lo)',
                    fontWeight: 800, fontSize: 15,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: canSubmit ? '0 4px 16px rgba(217,119,6,0.30)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading
                    ? <><Loader2 style={{ width: 17, height: 17, animation: 'sp-spin 0.8s linear infinite' }} /> Saving…</>
                    : 'Set Password & Continue'}
                </button>

              </form>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
