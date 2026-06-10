import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, IdCard, Lock, Eye, EyeOff, ShieldCheck,
  Loader2, MessageSquare, Phone, X, KeyRound, ChevronLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { authService } from '@/config/api'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { User } from '@/types'

const AMBER = '#F59E0B'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [spnNumber, setSpnNumber] = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [idFocused, setIdFocused] = useState(false)
  const [pwFocused, setPwFocused] = useState(false)

  // Password reset modal (3 steps: phone → otp → new password)
  const [showResetModal,  setShowResetModal]  = useState(false)
  const [resetStep,       setResetStep]       = useState<'phone' | 'otp' | 'password'>('phone')
  const [resetPhone,      setResetPhone]      = useState('')
  const [resetOtp,        setResetOtp]        = useState('')
  const [resetNewPw,      setResetNewPw]      = useState('')
  const [resetConfirmPw,  setResetConfirmPw]  = useState('')
  const [resetLoading,    setResetLoading]    = useState(false)
  const [resetPhFocused,  setResetPhFocused]  = useState(false)
  const [resetOtpFocused, setResetOtpFocused] = useState(false)
  const [resetPwFocused,  setResetPwFocused]  = useState(false)
  const [resetCfFocused,  setResetCfFocused]  = useState(false)
  const [showResetPw,     setShowResetPw]     = useState(false)
  const [showResetCf,     setShowResetCf]     = useState(false)
  const [resetDevHint,    setResetDevHint]    = useState('')

  const closeResetModal = () => {
    setShowResetModal(false)
    setResetStep('phone')
    setResetPhone('')
    setResetOtp('')
    setResetNewPw('')
    setResetConfirmPw('')
    setResetDevHint('')
  }

  const handleResetSendOTP = async () => {
    const phone = normalisePhone(resetPhone)
    if (phone.length < 13) { toast.error('Enter a valid Ugandan phone number'); return }
    setResetLoading(true)
    try {
      const res = await authService.requestResetOTP(phone)
      const msg = (res.data as { message?: string })?.message ?? 'Code sent'
      toast.success(msg)
      setResetDevHint(msg.includes('DEV') ? msg : '')
      setResetStep('otp')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = e?.response?.data?.detail
      const msg = typeof detail === 'object' && detail !== null
        ? detail.message ?? 'Failed to send code'
        : typeof detail === 'string' ? detail : 'Failed to send code'
      toast.error(msg)
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetVerifyOTP = async () => {
    if (resetOtp.trim().length < 4) { toast.error('Enter the code sent to your phone'); return }
    setResetLoading(true)
    try {
      // Just move to password step — OTP will be verified server-side with the password
      setResetStep('password')
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetConfirm = async () => {
    if (resetNewPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (resetNewPw !== resetConfirmPw) { toast.error('Passwords do not match'); return }
    const phone = normalisePhone(resetPhone)
    setResetLoading(true)
    try {
      await authService.confirmResetPassword(phone, resetOtp.trim(), resetNewPw)
      toast.success('Password reset successfully — please log in')
      closeResetModal()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = e?.response?.data?.detail
      const msg = typeof detail === 'object' && detail !== null
        ? detail.message ?? 'Reset failed'
        : typeof detail === 'string' ? detail : 'Reset failed'
      toast.error(msg)
      // If OTP expired/invalid, send them back to OTP step
      if (typeof detail === 'object' && detail !== null &&
          ['OTP_EXPIRED', 'OTP_NOT_FOUND', 'OTP_MAX_ATTEMPTS', 'INVALID_OTP'].includes((detail as {code?: string}).code ?? '')) {
        setResetStep('otp')
      }
    } finally {
      setResetLoading(false)
    }
  }

  const resetStrength = (() => {
    if (resetNewPw.length === 0) return 0
    let s = 0
    if (resetNewPw.length >= 8)           s++
    if (/[A-Z]/.test(resetNewPw))         s++
    if (/[0-9]/.test(resetNewPw))         s++
    if (/[^A-Za-z0-9]/.test(resetNewPw)) s++
    return s
  })()
  const resetStrengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][resetStrength]
  const resetStrengthColor = ['', '#ef4444', '#f59e0b', '#22c55e', '#22c55e'][resetStrength]

  // Phone OTP fallback
  const [showPhoneModal, setShowPhoneModal]   = useState(false)
  const [phoneStep,      setPhoneStep]        = useState<'phone' | 'otp'>('phone')
  const [phoneValue,     setPhoneValue]       = useState('')
  const [otpValue,       setOtpValue]         = useState('')
  const [phoneLoading,   setPhoneLoading]     = useState(false)
  const [phoneFocused,   setPhoneFocused]     = useState(false)
  const [otpFocused,     setOtpFocused]       = useState(false)
  const [devOtpHint,     setDevOtpHint]       = useState('')

  const normalisePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('256')) return `+${digits}`
    if (digits.startsWith('0'))   return `+256${digits.slice(1)}`
    return `+256${digits}`
  }

  const closePhoneModal = () => {
    setShowPhoneModal(false)
    setPhoneStep('phone')
    setPhoneValue('')
    setOtpValue('')
    setDevOtpHint('')
  }

  const handleSendOTP = async () => {
    const phone = normalisePhone(phoneValue)
    if (phone.length < 13) { toast.error('Enter a valid Ugandan phone number'); return }
    setPhoneLoading(true)
    try {
      const res = await authService.requestPhoneOTP(phone)
      const msg = (res.data as { message?: string })?.message ?? 'OTP sent'
      toast.success(msg)
      setDevOtpHint(msg.includes('DEV') ? msg : '')
      setPhoneStep('otp')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = e?.response?.data?.detail
      const msg = typeof detail === 'object' && detail !== null
        ? detail.message ?? 'Failed to send OTP'
        : typeof detail === 'string' ? detail : 'Failed to send OTP'
      toast.error(msg)
    } finally {
      setPhoneLoading(false)
    }
  }

  const handleVerifyOTP = async (code?: string) => {
    const otp = code ?? otpValue.trim()
    if (otp.length < 4) { toast.error('Enter the OTP sent to your phone'); return }
    const phone = normalisePhone(phoneValue)
    setPhoneLoading(true)
    try {
      const res = await authService.verifyPhoneOTP(phone, otp)
      const { access_token, provider } = res.data as { access_token: string; provider: User }
      login(access_token, provider)
      closePhoneModal()
      if (!provider.is_verified) {
        navigate('/pending-review', { replace: true })
      } else if (!provider.password_changed) {
        navigate('/change-password', { replace: true })
      } else {
        navigate('/welcome', { replace: true })
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = e?.response?.data?.detail
      const msg = typeof detail === 'object' && detail !== null
        ? detail.message ?? 'Verification failed'
        : typeof detail === 'string' ? detail : 'Verification failed'
      toast.error(msg)
    } finally {
      setPhoneLoading(false)
    }
  }

  const spnValid  = /^\d+$/.test(spnNumber.trim()) && spnNumber.trim().length > 0
  const canSubmit = spnValid && password.length >= 4

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || loading) return
    setLoading(true)
    try {
      const res = await authService.login(`SPN-${spnNumber.trim()}`, password)
      const { access_token, provider } = res.data as { access_token: string; provider: User }
      login(access_token, provider)
      if (!provider.is_verified) {
        navigate('/pending-review', { replace: true })
      } else if (!provider.password_changed) {
        navigate('/change-password', { replace: true })
      } else {
        navigate('/welcome', { replace: true })
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string }; status?: number }; message?: string; code?: string }
      const detail = e?.response?.data?.detail
      let msg: string
      if (!e?.response) {
        msg = `Network error — cannot reach server (${e?.message ?? e?.code ?? 'ERR_NETWORK'})`
      } else if (typeof detail === 'object' && detail !== null) {
        msg = (detail as { message?: string }).message ?? 'Invalid credentials.'
      } else if (typeof detail === 'string') {
        msg = detail
      } else {
        msg = `Server error ${e.response.status}`
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputBorder = (focused: boolean) =>
    isDark
      ? (focused ? AMBER : 'rgba(255,255,255,0.10)')
      : (focused ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.25)')

  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'

  return (
    <>
      <style>{`
        @keyframes sp-fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes sp-fade-up  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sp-modal-in { from{opacity:0;transform:scale(0.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes sp-spin     { to{transform:rotate(360deg)} }
        @keyframes dot-blink   { 0%,100%{opacity:1} 50%{opacity:0.2} }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px ${isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'} inset !important;
          -webkit-text-fill-color: var(--text-hi) !important;
          caret-color: var(--text-hi);
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

        {/* Subtle dot texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: isDark ? 0.025 : 0.055, backgroundImage: `radial-gradient(circle, ${AMBER} 1px, transparent 1px)`, backgroundSize: '28px 28px', pointerEvents: 'none' }} />
        {/* Warm glow */}
        <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 320, borderRadius: '50%', background: isDark ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.09)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        {/* Back */}
        <button
          onClick={() => navigate('/entry')}
          style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-md)', marginTop: 24, marginLeft: 20, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, animation: 'sp-fade-in 0.3s ease both' }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} /> Back
        </button>

        {/* Main content */}
        <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px 48px', maxWidth: 440, margin: '0 auto', width: '100%', animation: 'sp-fade-up 0.45s ease 0.08s both' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>

            {/* Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', marginBottom: 18 }}>
              <ShieldCheck style={{ width: 11, height: 11, color: AMBER }} />
              <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: AMBER }}>Provider Network</span>
            </div>

            {/* Logo */}
            <div style={{ width: 60, height: 60, borderRadius: 16, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(245,158,11,0.35)', marginBottom: 20 }}>
              <img
                src="/motofix-logo.png"
                alt="MOTOFIX"
                style={{ width: 44, height: 44, objectFit: 'contain' }}
                onError={e => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  const span = document.createElement('span')
                  span.textContent = 'M'
                  span.style.cssText = 'font-size:26px;font-weight:900;color:#fff'
                  el.parentElement?.appendChild(span)
                }}
              />
            </div>

            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 24, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Sign in to your account
            </h1>
            <p style={{ color: 'var(--text-md)', fontSize: 13, textAlign: 'center', lineHeight: 1.65, maxWidth: 290 }}>
              Use the Service Provider ID and password sent to you via SMS when your account was approved.
            </p>
          </div>

          {/* ── SMS credentials info banner ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', marginBottom: 20 }}>
            <MessageSquare style={{ width: 16, height: 16, color: AMBER, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: isDark ? 'rgba(253,211,77,0.88)' : 'rgba(146,98,10,0.9)', lineHeight: 1.6, margin: 0 }}>
              Your <strong>Service Provider ID</strong> (e.g.{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>SPN-0042</span>) and <strong>password</strong> were sent to your registered phone number via SMS when your account was approved.
            </p>
          </div>

          {/* ── Form card ── */}
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            border: isDark ? '1.5px solid rgba(255,255,255,0.10)' : '1.5px solid #000',
            boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.20)' : 'var(--card-shadow)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          }}>
            {/* Amber top accent bar — dark mode only */}
            {isDark && (
              <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${AMBER}bb, #F59E0B, ${AMBER}bb, transparent)` }} />
            )}

            <div style={{ padding: '24px 24px 28px', background: 'var(--surface-1)' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Service Provider ID */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>
                    Service Provider ID
                  </label>
                  <div style={{
                    display: 'flex', alignItems: 'center', height: 50,
                    borderRadius: 12, background: inputBg,
                    border: `1.5px solid ${inputBorder(idFocused)}`,
                    boxShadow: idFocused && isDark ? '0 0 0 3px rgba(217,119,6,0.12)' : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    overflow: 'hidden',
                  }}>
                    <div style={{ paddingLeft: 13, paddingRight: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <IdCard style={{ width: 17, height: 17, color: idFocused ? (isDark ? AMBER : 'var(--text-hi)') : 'var(--text-lo)', transition: 'color 0.2s' }} />
                    </div>
                    <span style={{
                      fontFamily: 'monospace', fontWeight: 800, fontSize: 15,
                      color: AMBER, letterSpacing: '0.06em',
                      paddingRight: 2, userSelect: 'none' as const, flexShrink: 0,
                    }}>SPN-</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0042"
                      value={spnNumber}
                      onChange={e => setSpnNumber(e.target.value.replace(/\D/g, ''))}
                      onFocus={() => setIdFocused(true)}
                      onBlur={() => setIdFocused(false)}
                      autoComplete="username"
                      spellCheck={false}
                      style={{
                        flex: 1, height: '100%', border: 'none', outline: 'none',
                        background: 'transparent', color: 'var(--text-hi)',
                        fontSize: 15, fontFamily: 'monospace', letterSpacing: '0.06em',
                        paddingRight: 12,
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-lo)', marginTop: 5, paddingLeft: 2 }}>
                    Issued by MOTOFIX admin — enter the number after{' '}
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-md)' }}>SPN-</span>
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: pwFocused ? (isDark ? AMBER : 'var(--text-hi)') : 'var(--text-lo)', transition: 'color 0.2s', pointerEvents: 'none' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPwFocused(true)}
                      onBlur={() => setPwFocused(false)}
                      autoComplete="current-password"
                      style={{
                        width: '100%', height: 50, paddingLeft: 42, paddingRight: 48,
                        borderRadius: 12, background: inputBg,
                        border: `1.5px solid ${inputBorder(pwFocused)}`,
                        boxShadow: pwFocused && isDark ? '0 0 0 3px rgba(217,119,6,0.12)' : 'none',
                        color: 'var(--text-hi)', fontSize: 15, outline: 'none',
                        boxSizing: 'border-box' as const,
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-lo)' }}
                    >
                      {showPass
                        ? <EyeOff style={{ width: 17, height: 17 }} />
                        : <Eye    style={{ width: 17, height: 17 }} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  style={{
                    width: '100%', height: 50, borderRadius: 12, border: 'none', marginTop: 2,
                    background: canSubmit
                      ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                      : 'var(--surface-3)',
                    color: canSubmit ? '#fff' : 'var(--text-lo)',
                    fontWeight: 800, fontSize: 15, letterSpacing: '0.01em',
                    cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: canSubmit ? '0 4px 16px rgba(217,119,6,0.30)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading
                    ? <><Loader2 style={{ width: 17, height: 17, animation: 'sp-spin 0.8s linear infinite' }} /> Signing in…</>
                    : 'Sign In'}
                </button>

                {/* Forgot password */}
                <button
                  type="button"
                  onClick={() => { setShowResetModal(true); setResetStep('phone') }}
                  style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700, textAlign: 'center' as const, marginTop: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  Forgot password? →
                </button>

                {/* Phone OTP fallback link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-lo)', whiteSpace: 'nowrap' }}>can't access your SPN?</span>
                  <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
                </div>
                <button
                  type="button"
                  onClick={() => { setShowPhoneModal(true); setPhoneStep('phone') }}
                  style={{
                    width: '100%', height: 46, borderRadius: 12, marginTop: -4,
                    border: `1.5px solid ${isDark ? 'rgba(245,158,11,0.45)' : 'rgba(245,158,11,0.60)'}`,
                    background: isDark ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.06)',
                    color: AMBER, fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <Phone style={{ width: 15, height: 15 }} />
                  Use phone number instead
                </button>

              </form>
            </div>
          </div>

          {/* ── Bottom links ── */}
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-lo)' }}>Not yet a provider?</span>
              <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
            </div>
            <button
              onClick={() => navigate('/apply')}
              style={{ fontSize: 13, fontWeight: 700, color: AMBER, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Apply to join the network →
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <ShieldCheck style={{ width: 12, height: 12, color: 'var(--text-lo)' }} />
              <p style={{ fontSize: 11, color: 'var(--text-lo)', margin: 0 }}>
                Credentials are issued by MOTOFIX administration only.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Phone OTP — full-page overlay matching driver app layout ── */}
      {showPhoneModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'var(--page-bg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'sp-fade-in 0.25s ease both',
        }}>
          {/* Subtle dot texture */}
          <div style={{ position: 'absolute', inset: 0, opacity: isDark ? 0.025 : 0.055, backgroundImage: `radial-gradient(circle, ${AMBER} 1px, transparent 1px)`, backgroundSize: '28px 28px', pointerEvents: 'none' }} />
          {/* Warm glow */}
          <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 420, height: 260, borderRadius: '50%', background: isDark ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.08)', filter: 'blur(80px)', pointerEvents: 'none' }} />

          {/* Back button — top left, same style as main login page */}
          <button
            onClick={phoneStep === 'otp' ? () => { setPhoneStep('phone'); setOtpValue('') } : closePhoneModal}
            style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-md)', marginTop: 24, marginLeft: 20, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {phoneStep === 'otp' ? 'Change number' : 'Back'}
          </button>

          {/* Main content */}
          <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px 60px', maxWidth: 440, margin: '0 auto', width: '100%' }}>

            {/* Logo + heading */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 8px 32px rgba(245,158,11,0.40)' }}>
                <img src="/motofix-logo.png" alt="MOTOFIX" style={{ width: 54, height: 54, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-hi)', letterSpacing: '-0.02em', margin: 0 }}>
                {phoneStep === 'phone' ? 'Welcome back.' : 'Check your phone.'}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-md)', marginTop: 10, lineHeight: 1.65, maxWidth: 300 }}>
                {phoneStep === 'phone'
                  ? "Enter your phone number and we'll send you a one-time login code."
                  : <>Code sent to <span style={{ color: 'var(--text-hi)', fontWeight: 700 }}>{normalisePhone(phoneValue)}</span>. Enter it below.</>}
              </p>
            </div>

            {/* Form panel */}
            <div style={{
              borderRadius: 20, padding: '24px 24px 28px',
              background: 'var(--surface-1)',
              border: isDark ? `1.5px solid rgba(245,158,11,0.18)` : `1.5px solid rgba(245,158,11,0.28)`,
              boxShadow: isDark ? '0 0 40px rgba(245,158,11,0.06)' : '0 0 32px rgba(245,158,11,0.05)',
            }}>
              {phoneStep === 'phone' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.18em', color: AMBER, marginBottom: 8 }}>
                      Phone Number
                    </label>
                    <div style={{
                      display: 'flex', alignItems: 'center', height: 52,
                      borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1.5px solid ${phoneFocused ? AMBER : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)')}`,
                      boxShadow: phoneFocused ? `0 0 0 3px rgba(245,158,11,${isDark ? '0.14' : '0.10'})` : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s', overflow: 'hidden',
                    }}>
                      <div style={{ paddingLeft: 14, paddingRight: 8, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <Phone style={{ width: 16, height: 16, color: phoneFocused ? AMBER : 'var(--text-lo)', transition: 'color 0.2s' }} />
                      </div>
                      <input
                        type="tel" inputMode="numeric" placeholder="0712 345 678"
                        value={phoneValue.replace(/^\+?256/, '').replace(/^0/, '')}
                        onChange={e => setPhoneValue(e.target.value.replace(/\D/g, ''))}
                        onFocus={() => setPhoneFocused(true)}
                        onBlur={() => setPhoneFocused(false)}
                        onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                        autoFocus
                        style={{
                          flex: 1, height: '100%', border: 'none', outline: 'none',
                          background: 'transparent', color: 'var(--text-hi)',
                          fontSize: 15, paddingRight: 14,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSendOTP}
                    disabled={phoneLoading || phoneValue.replace(/\D/g, '').length < 9}
                    style={{
                      width: '100%', height: 52, borderRadius: 12, border: 'none',
                      background: phoneValue.replace(/\D/g, '').length >= 9
                        ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                        : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
                      color: phoneValue.replace(/\D/g, '').length >= 9 ? '#fff' : 'var(--text-lo)',
                      fontWeight: 700, fontSize: 15,
                      cursor: phoneLoading || phoneValue.replace(/\D/g, '').length < 9 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: phoneValue.replace(/\D/g, '').length >= 9 ? '0 4px 20px rgba(217,119,6,0.35)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {phoneLoading
                      ? <><Loader2 style={{ width: 16, height: 16, animation: 'sp-spin 0.8s linear infinite' }} /> Sending code…</>
                      : <>Send login code <ArrowLeft style={{ width: 15, height: 15, transform: 'rotate(180deg)' }} /></>}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {devOtpHint && (
                    <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.40)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🔑</span>
                      <p style={{ color: AMBER, fontSize: 13, fontWeight: 700, margin: 0 }}>{devOtpHint}</p>
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.18em', color: AMBER, marginBottom: 8 }}>
                      Verification Code
                    </label>
                    <div style={{
                      position: 'relative', height: 56, borderRadius: 12,
                      background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                      border: `1.5px solid ${otpFocused ? AMBER : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)')}`,
                      boxShadow: otpFocused ? `0 0 0 3px rgba(245,158,11,${isDark ? '0.14' : '0.10'})` : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}>
                      <KeyRound style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: otpFocused ? AMBER : 'var(--text-lo)', transition: 'color 0.2s', pointerEvents: 'none' }} />
                      <input
                        type="text" inputMode="numeric" placeholder="· · · · · ·" maxLength={6}
                        value={otpValue}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                          setOtpValue(val)
                          if (val.length === 6 && !phoneLoading) handleVerifyOTP(val)
                        }}
                        onFocus={() => setOtpFocused(true)}
                        onBlur={() => setOtpFocused(false)}
                        disabled={phoneLoading}
                        autoFocus
                        style={{
                          position: 'absolute', inset: 0, paddingLeft: 42, paddingRight: 14,
                          border: 'none', outline: 'none', background: 'transparent',
                          color: 'var(--text-hi)', fontSize: 20, fontFamily: 'monospace',
                          letterSpacing: '0.6em', textAlign: 'center', borderRadius: 12,
                        }}
                      />
                      {phoneLoading && (
                        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                          <Loader2 style={{ width: 18, height: 18, color: AMBER, animation: 'sp-spin 0.8s linear infinite' }} />
                        </div>
                      )}
                    </div>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--text-lo)' }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: AMBER, flexShrink: 0, animation: 'dot-blink 1.4s ease-in-out infinite' }} />
                      Verifies automatically once all 6 digits are entered
                    </p>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => { setOtpValue(''); handleSendOTP() }}
                      disabled={phoneLoading}
                      style={{ fontSize: 13, color: phoneLoading ? 'var(--text-lo)' : AMBER, background: 'none', border: 'none', cursor: phoneLoading ? 'default' : 'pointer', fontWeight: 600, transition: 'color 0.2s' }}
                    >
                      {phoneLoading ? 'Verifying…' : "Didn't receive a code? Resend"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom — back to SPN login */}
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-lo)' }}>Have your Provider ID?</span>
                <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
              </div>
              <button
                onClick={closePhoneModal}
                style={{ fontSize: 13, fontWeight: 700, color: AMBER, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Sign in with SPN instead →
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Forgot password reset modal (3 steps) ── */}
      {showResetModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) closeResetModal() }}
        >
          <div style={{
            background: 'var(--overlay-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 20, padding: 28, maxWidth: 360, width: '100%',
            border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1.5px solid #000',
            boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
            animation: 'sp-modal-in 0.22s ease both',
          }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              {resetStep !== 'phone' && (
                <button
                  onClick={() => setResetStep(resetStep === 'password' ? 'otp' : 'phone')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-md)', display: 'flex' }}
                >
                  <ChevronLeft style={{ width: 18, height: 18 }} />
                </button>
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-hi)', margin: 0 }}>
                  {resetStep === 'phone' ? 'Reset Password' : resetStep === 'otp' ? 'Enter Code' : 'New Password'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '3px 0 0' }}>
                  {resetStep === 'phone' && 'Enter your registered phone number'}
                  {resetStep === 'otp'   && `Code sent to ${normalisePhone(resetPhone)}`}
                  {resetStep === 'password' && 'Choose a strong new password'}
                </p>
              </div>
              {/* Step dots */}
              <div style={{ display: 'flex', gap: 5, marginRight: 4 }}>
                {(['phone', 'otp', 'password'] as const).map(s => (
                  <div key={s} style={{ width: 6, height: 6, borderRadius: '50%', background: s === resetStep ? AMBER : (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)'), transition: 'background 0.2s' }} />
                ))}
              </div>
              <button onClick={closeResetModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-md)' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Step 1 — Phone */}
            {resetStep === 'phone' && (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>Phone Number</label>
                  <div style={{ display: 'flex', alignItems: 'center', height: 50, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1.5px solid ${resetPhFocused ? AMBER : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)')}`, transition: 'border-color 0.2s', overflow: 'hidden' }}>
                    <div style={{ paddingLeft: 12, paddingRight: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <Phone style={{ width: 16, height: 16, color: resetPhFocused ? AMBER : 'var(--text-lo)' }} />
                    </div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: AMBER, paddingRight: 6, flexShrink: 0, letterSpacing: '0.04em' }}>+256</span>
                    <div style={{ width: 1, height: 22, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', flexShrink: 0, marginRight: 10 }} />
                    <input
                      type="tel" inputMode="numeric" placeholder="712345678"
                      value={resetPhone.replace(/^\+?256/, '').replace(/^0/, '')}
                      onChange={e => setResetPhone(e.target.value.replace(/\D/g, ''))}
                      onFocus={() => setResetPhFocused(true)}
                      onBlur={() => setResetPhFocused(false)}
                      onKeyDown={e => e.key === 'Enter' && handleResetSendOTP()}
                      autoFocus
                      style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-hi)', fontSize: 15, fontFamily: 'monospace', letterSpacing: '0.08em', paddingRight: 12 }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-lo)', marginTop: 5, paddingLeft: 2 }}>Must match the number used when you registered</p>
                </div>
                <button
                  onClick={handleResetSendOTP}
                  disabled={resetLoading || resetPhone.replace(/\D/g, '').length < 9}
                  style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: resetPhone.replace(/\D/g, '').length >= 9 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--surface-3)', color: resetPhone.replace(/\D/g, '').length >= 9 ? '#fff' : 'var(--text-lo)', fontWeight: 800, fontSize: 14, cursor: resetLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {resetLoading ? <><Loader2 style={{ width: 16, height: 16, animation: 'sp-spin 0.8s linear infinite' }} /> Sending…</> : 'Send Reset Code'}
                </button>
              </>
            )}

            {/* Step 2 — OTP */}
            {resetStep === 'otp' && (
              <>
                {resetDevHint && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.40)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🔑</span>
                    <p style={{ color: AMBER, fontSize: 13, fontWeight: 700, margin: 0 }}>{resetDevHint}</p>
                  </div>
                )}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>Reset Code</label>
                  <div style={{ display: 'flex', alignItems: 'center', height: 50, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1.5px solid ${resetOtpFocused ? AMBER : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)')}`, transition: 'border-color 0.2s', overflow: 'hidden' }}>
                    <div style={{ paddingLeft: 13, paddingRight: 10, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <KeyRound style={{ width: 16, height: 16, color: resetOtpFocused ? AMBER : 'var(--text-lo)' }} />
                    </div>
                    <input
                      type="text" inputMode="numeric" placeholder="• • • • • •" maxLength={6}
                      value={resetOtp}
                      onChange={e => setResetOtp(e.target.value.replace(/\D/g, ''))}
                      onFocus={() => setResetOtpFocused(true)}
                      onBlur={() => setResetOtpFocused(false)}
                      onKeyDown={e => e.key === 'Enter' && handleResetVerifyOTP()}
                      autoFocus
                      style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-hi)', fontSize: 22, fontFamily: 'monospace', letterSpacing: '0.35em', paddingRight: 12 }}
                    />
                  </div>
                  <button type="button" onClick={() => { setResetOtp(''); handleResetSendOTP() }} style={{ fontSize: 12, color: AMBER, background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, paddingLeft: 2, fontWeight: 600 }}>Resend code</button>
                </div>
                <button
                  onClick={handleResetVerifyOTP}
                  disabled={resetLoading || resetOtp.length < 4}
                  style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: resetOtp.length >= 4 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--surface-3)', color: resetOtp.length >= 4 ? '#fff' : 'var(--text-lo)', fontWeight: 800, fontSize: 14, cursor: resetLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {resetLoading ? <><Loader2 style={{ width: 16, height: 16, animation: 'sp-spin 0.8s linear infinite' }} /> Verifying…</> : 'Continue'}
                </button>
              </>
            )}

            {/* Step 3 — New password */}
            {resetStep === 'password' && (
              <>
                {/* New password */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: resetPwFocused ? (isDark ? AMBER : 'var(--text-hi)') : 'var(--text-lo)', pointerEvents: 'none' }} />
                    <input
                      type={showResetPw ? 'text' : 'password'} placeholder="At least 8 characters"
                      value={resetNewPw} onChange={e => setResetNewPw(e.target.value)}
                      onFocus={() => setResetPwFocused(true)} onBlur={() => setResetPwFocused(false)}
                      autoFocus autoComplete="new-password"
                      style={{ width: '100%', height: 50, paddingLeft: 42, paddingRight: 48, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1.5px solid ${resetPwFocused ? AMBER : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)')}`, color: 'var(--text-hi)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
                    />
                    <button type="button" onClick={() => setShowResetPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-lo)' }}>
                      {showResetPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                  {resetNewPw.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= resetStrength ? resetStrengthColor : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'), transition: 'background 0.3s' }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: resetStrengthColor, margin: 0, fontWeight: 700 }}>{resetStrengthLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', color: AMBER, marginBottom: 7 }}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: resetCfFocused ? (isDark ? AMBER : 'var(--text-hi)') : 'var(--text-lo)', pointerEvents: 'none' }} />
                    <input
                      type={showResetCf ? 'text' : 'password'} placeholder="Repeat new password"
                      value={resetConfirmPw} onChange={e => setResetConfirmPw(e.target.value)}
                      onFocus={() => setResetCfFocused(true)} onBlur={() => setResetCfFocused(false)}
                      onKeyDown={e => e.key === 'Enter' && handleResetConfirm()}
                      autoComplete="new-password"
                      style={{ width: '100%', height: 50, paddingLeft: 42, paddingRight: 48, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1.5px solid ${resetConfirmPw.length > 0 && resetConfirmPw !== resetNewPw ? '#ef4444' : (resetCfFocused ? AMBER : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)'))}`, color: 'var(--text-hi)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
                    />
                    <button type="button" onClick={() => setShowResetCf(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-lo)' }}>
                      {showResetCf ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                  {resetConfirmPw.length > 0 && resetConfirmPw !== resetNewPw && (
                    <p style={{ fontSize: 11, color: '#ef4444', marginTop: 5, paddingLeft: 2 }}>Passwords do not match</p>
                  )}
                </div>

                <button
                  onClick={handleResetConfirm}
                  disabled={resetLoading || resetNewPw.length < 8 || resetNewPw !== resetConfirmPw}
                  style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: resetNewPw.length >= 8 && resetNewPw === resetConfirmPw ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--surface-3)', color: resetNewPw.length >= 8 && resetNewPw === resetConfirmPw ? '#fff' : 'var(--text-lo)', fontWeight: 800, fontSize: 14, cursor: resetLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {resetLoading ? <><Loader2 style={{ width: 16, height: 16, animation: 'sp-spin 0.8s linear infinite' }} /> Saving…</> : 'Reset Password'}
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
