// tabs/Profile.tsx — the Profile tab: the mechanic's own account info (name, verification
// status, specialties, contact) plus settings and links (change password, support, logout).

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, AlertTriangle, BadgeCheck,
  Bell, MapPin, Lock, Phone, LogOut,
  ChevronRight, Building2, Eye, EyeOff,
  User, HelpCircle, FileText, X, Check,
  Wrench, Truck, Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { C } from '@/styles/tokens'
import { useTheme } from '@/contexts/ThemeContext'
import { mechanicService } from '@/config/api'
import { useAuth } from '@/contexts/AuthContext'

import type { MechanicProfile } from '@/types'

const Y  = '#F59E0B'
const YD = '#D97706'

/* ── Helpers ───────────────────────────────────────────────── */
function initials(name?: string) {
  if (!name) return 'SP'
  const p = name.trim().split(' ')
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

/* ── Profile row ───────────────────────────────────────────── */
function PRow({
  icon: Icon, accent, label, children, last,
}: {
  icon: React.ElementType; accent: string; label: string; children: React.ReactNode; last?: boolean
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', borderBottom: last ? 'none' : '1px solid var(--border-1)', transition: 'background 0.15s ease' }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${accent}0D`
        const lbl = e.currentTarget.querySelector('.prow-label') as HTMLElement | null
        if (lbl) lbl.style.color = 'var(--text-md)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        const lbl = e.currentTarget.querySelector('.prow-label') as HTMLElement | null
        if (lbl) lbl.style.color = 'var(--text-dim)'
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `${accent}14`, border: `1.5px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 16, height: 16, color: accent }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="prow-label" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 4, transition: 'color 0.15s ease' }}>
          {label}
        </p>
        {children}
      </div>
    </div>
  )
}

/* ── Quick link row ────────────────────────────────────────── */
function QLink({
  icon: Icon, accent, label, sub, onClick, last,
}: {
  icon: React.ElementType; accent: string; label: string; sub: string; onClick: () => void; last?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', cursor: 'pointer', textAlign: 'left', borderBottom: last ? 'none' : '1px solid var(--border-1)', transition: 'background 0.15s ease' }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${accent}0D`
        const lbl = e.currentTarget.querySelector('.qlink-label') as HTMLElement | null
        const sub_ = e.currentTarget.querySelector('.qlink-sub') as HTMLElement | null
        const arr = e.currentTarget.querySelector('.qlink-arrow') as HTMLElement | null
        if (lbl) lbl.style.color = 'var(--text-hi)'
        if (sub_) sub_.style.color = 'var(--text-md)'
        if (arr) arr.style.color = `${accent}90`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        const lbl = e.currentTarget.querySelector('.qlink-label') as HTMLElement | null
        const sub_ = e.currentTarget.querySelector('.qlink-sub') as HTMLElement | null
        const arr = e.currentTarget.querySelector('.qlink-arrow') as HTMLElement | null
        if (lbl) lbl.style.color = 'var(--text-hi)'
        if (sub_) sub_.style.color = 'var(--text-dim)'
        if (arr) arr.style.color = 'var(--text-ghost)'
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `${accent}14`, border: `1.5px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 16, height: 16, color: accent }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="qlink-label" style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 700, lineHeight: 1, transition: 'color 0.15s ease' }}>{label}</p>
        <p className="qlink-sub"   style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3, transition: 'color 0.15s ease' }}>{sub}</p>
      </div>
      <ChevronRight className="qlink-arrow" style={{ width: 15, height: 15, color: 'var(--text-faint)', flexShrink: 0, transition: 'color 0.15s ease' }} />
    </button>
  )
}

/* ── Section label ─────────────────────────────────────────── */
function SLabel({ children }: { children: string }) {
  return (
    <p className="pf-section-label" style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 10 }}>
      {children}
    </p>
  )
}

function isCoords(s: string) {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s.trim())
}

/* ── Main ──────────────────────────────────────────────────── */
export default function Profile() {
  const navigate  = useNavigate()
  const { user, logout } = useAuth()
  const { isDark } = useTheme()

  const cardBorder = isDark ? '1px solid var(--border-2)' : '1.5px solid rgba(0,0,0,0.65)'

  const [profile,          setProfile]          = useState<MechanicProfile | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [resolvedLocation, setResolvedLocation] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [showSusp, setShowSusp] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showVerified, setShowVerified] = useState(false)
  const [showLic,  setShowLic]  = useState(false)

  const [curPass,  setCurPass]  = useState(''); const [showCur,  setShowCur]  = useState(false)
  const [newPass,  setNewPass]  = useState(''); const [showNew,  setShowNew]  = useState(false)
  const [confPass, setConfPass] = useState(''); const [showConf, setShowConf] = useState(false)

  useEffect(() => {
    mechanicService.getProfile()
      .then(r => setProfile(r.data))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  const name        = profile?.full_name ?? user?.full_name ?? 'Provider'
  const phone       = profile?.phone ?? user?.phone ?? '—'
  const spn         = (profile as unknown as { spn?: string })?.spn ?? (user as unknown as { spn?: string })?.spn
  const isMechanic  = (profile?.provider_type ?? user?.provider_type) !== 'towing_provider'
  const specs       = profile?.specializations ?? (profile?.specialty ? profile.specialty.split(',') : [])

  const rawServiceArea = profile?.service_area ?? ''
  const rawLocation    = profile?.current_location ?? ''

  // Reverse-geocode stored coordinates into a readable place name
  useEffect(() => {
    const coordStr = (isCoords(rawServiceArea) ? rawServiceArea : null)
      ?? (isCoords(rawLocation) ? rawLocation : null)
    if (!coordStr) return
    const [lat, lng] = coordStr.split(',').map(Number)
    if (isNaN(lat) || isNaN(lng)) return
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`)
      .then(r => r.json())
      .then(data => {
        const a = data.address ?? {}
        const label = a.suburb ?? a.neighbourhood ?? a.city_district ?? a.city ?? a.town ?? data.display_name
        if (label) setResolvedLocation(label)
      })
      .catch(() => {})
  }, [rawServiceArea, rawLocation])

  const serviceArea =
    (rawServiceArea && !isCoords(rawServiceArea) ? rawServiceArea : null)
    ?? (rawLocation && !isCoords(rawLocation) ? rawLocation : null)
    ?? resolvedLocation
    ?? '—'
  const license     = profile?.license_number ?? null
  const maskedLic   = license ? license.slice(-4).padStart(license.length, '•') : null

  return (
    <>
      <style>{`
        @keyframes slideUp  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes spin     { to { transform: rotate(360deg); } }
        .pf-pass-input {
          width:100%; height:44px; border-radius:10px; padding:0 40px 0 12px;
          background:var(--input-bg); border:1.5px solid var(--border-2);
          color:var(--text-hi); font-size:14px; outline:none; box-sizing:border-box; font-family:inherit;
        }
        .pf-pass-input:focus { border-color:${Y}; box-shadow:0 0 0 3px ${Y}22; }
        .pf-section-label { transition: color 0.18s ease; cursor: default; }
        .pf-section-label:hover { color: var(--text-md) !important; }
      `}</style>

      <div style={{ padding: '16px 16px 88px' }}>

        {/* ── Page header ──────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <p className="pf-brand" style={{ color: `${Y}99`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 4, transition: 'color 0.18s ease, text-shadow 0.18s ease', cursor: 'default' }}
            onMouseEnter={e => { e.currentTarget.style.color = Y; e.currentTarget.style.textShadow = `0 0 16px ${Y}55, 0 0 32px ${Y}22` }}
            onMouseLeave={e => { e.currentTarget.style.color = `${Y}99`; e.currentTarget.style.textShadow = 'none' }}
          >
            MOTOFIX · Service Provider
          </p>
          <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1 }}>
            My Profile
          </h1>
        </div>

        {/* ── Hero card ────────────────────────────────────── */}
        <div
          style={{
            borderRadius: 24, padding: '22px 20px',
            background: `linear-gradient(135deg, ${Y}14 0%, ${Y}05 100%)`,
            border: isDark ? `1px solid ${Y}30` : '1.5px solid #000',
            display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20,
            boxShadow: isDark ? `0 4px 24px ${Y}0F` : '0 2px 8px rgba(0,0,0,0.06)',
            position: 'relative', overflow: 'hidden',
            transition: 'border-color 0.2s ease, background 0.2s ease', cursor: 'default',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = isDark ? `${Y}50` : '#000'
            e.currentTarget.style.background = `linear-gradient(135deg, ${Y}1E 0%, ${Y}0A 100%)`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = isDark ? `${Y}30` : '#000'
            e.currentTarget.style.background = `linear-gradient(135deg, ${Y}14 0%, ${Y}05 100%)`
          }}
        >
          <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: `${Y}07`, pointerEvents: 'none' }} />

          {/* Avatar */}
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${Y}, ${YD})`,
              border: `3px solid ${Y}55`,
              boxShadow: `0 0 0 5px ${Y}14, 0 0 28px ${Y}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 900, color: '#000', letterSpacing: '0.04em',
              transition: 'box-shadow 0.2s ease, transform 0.15s ease', cursor: 'default',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = `0 0 0 6px ${Y}22, 0 0 36px ${Y}45`
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = `0 0 0 5px ${Y}14, 0 0 28px ${Y}28`
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {initials(name)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {loading ? '…' : name}
              </span>
              {/* Verified accounts get an amber badge with a white tick beside the name
                  (X / WhatsApp style); tapping it explains the verified status. */}
              {profile?.is_verified && (
                <button
                  onClick={() => setShowVerified(true)}
                  aria-label="Verified — tap for details"
                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}
                >
                  <BadgeCheck style={{ width: 20, height: 20, color: '#fff', fill: '#F59E0B', flexShrink: 0 }} />
                </button>
              )}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: `${Y}15`, border: `1px solid ${Y}30`, color: Y, fontSize: 11, fontWeight: 700 }}>
                {isMechanic
                  ? <Wrench style={{ width: 10, height: 10 }} />
                  : <Truck  style={{ width: 10, height: 10 }} />}
                {isMechanic ? 'Mechanic' : 'Towing'}
              </span>
              {/* "Verified" pill removed — the inline check by the name now conveys it.
                  Unverified providers still show a pending indicator. */}
              {!profile?.is_verified && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: `${Y}12`, border: `1px solid ${Y}28`, color: Y, fontSize: 11, fontWeight: 700 }}>
                  Pending Review
                </span>
              )}
              {spn && (
                <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 7, background: Y, color: '#000', fontSize: 11, fontWeight: 900, letterSpacing: '0.07em' }}>
                  {spn}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Specializations ──────────────────────────────── */}
        {specs.length > 0 && (
          <>
            <SLabel>Specializations</SLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
              {specs.map(s => (
                <span key={s} style={{ fontSize: 12, fontWeight: 700, color: Y, background: `${Y}14`, border: `1px solid ${Y}28`, borderRadius: 20, padding: '5px 12px' }}>
                  {s.trim()}
                </span>
              ))}
            </div>
          </>
        )}

        {/* ── Provider details ─────────────────────────────── */}
        <SLabel>Provider Details</SLabel>
        <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--surface-1)', border: cardBorder, marginBottom: 20 }}>
          <PRow icon={User} accent={Y} label="Full Name">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-hi)' }}>{loading ? '…' : name}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, background: `${Y}0E`, border: `1px solid ${Y}25`, color: Y, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', flexShrink: 0 }}>
                <Lock style={{ width: 9, height: 9 }} /> ID-VERIFIED
              </span>
            </div>
          </PRow>

          <PRow icon={Phone} accent={C.blue} label="Phone Number">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-hi)' }}>{phone}</span>
              <span style={{ padding: '1px 7px', borderRadius: 8, background: `${C.blue}12`, border: `1px solid ${C.blue}22`, color: C.blue, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em' }}>VERIFIED</span>
            </div>
          </PRow>

          {profile?.garage_name && (
            <PRow icon={Building2} accent={C.purple} label="Garage / Business">
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-hi)' }}>{profile.garage_name}</span>
            </PRow>
          )}

          {license && (
            <PRow icon={FileText} accent={C.green} label="License Number">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '0.04em' }}>
                  {showLic ? license : maskedLic}
                </span>
                <button onClick={() => setShowLic(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  {showLic
                    ? <EyeOff style={{ width: 14, height: 14, color: C.textFaint }} />
                    : <Eye    style={{ width: 14, height: 14, color: C.textFaint }} />}
                </button>
              </div>
            </PRow>
          )}

          <PRow icon={MapPin} accent={C.green} label="Service Area" last>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-hi)' }}>
              {serviceArea}
            </span>
          </PRow>
        </div>

        {/* ── Supplies ──────────────────────────────────────── */}
        <SLabel>Supplies</SLabel>
        <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--surface-1)', border: cardBorder, marginBottom: 20 }}>
          <QLink icon={Package} accent={C.purple} label="Spare Parts & Tools" sub="Browse & order genuine car parts" onClick={() => navigate('/spare-parts')} last />
        </div>

        {/* ── Settings & Support ────────────────────────────── */}
        <SLabel>Settings & Support</SLabel>
        <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--surface-1)', border: cardBorder, marginBottom: 20 }}>
          <QLink icon={Bell}       accent={Y}            label="Notifications"         sub="Manage job alerts and reminders"    onClick={() => navigate('/notifications')} />
          <QLink icon={Lock}       accent={C.blue}       label="Change Password"        sub="Update your account password"       onClick={() => setShowPass(true)} />
          <QLink icon={HelpCircle} accent={C.purple}     label="Contact Support"        sub="Get help from the MOTOFIX team"     onClick={() => navigate('/contact-support', { state: { returnTab: 'profile' } })} />
          <QLink icon={FileText}   accent={C.textMuted}  label="Terms & Conditions"     sub="Read our usage policies"            onClick={() => navigate('/terms', { state: { returnTab: 'profile' } })} last />
        </div>

        {/* ── App version ──────────────────────────────────── */}
        <div
          style={{ borderRadius: 18, padding: '13px 18px', marginBottom: 16, background: 'var(--surface-1)', border: cardBorder, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s ease, border-color 0.15s ease', cursor: 'default' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-1)' }}
        >
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: 3 }}>App Version</p>
            <p style={{ color: 'var(--text-md)', fontSize: 13, fontWeight: 700 }}>MOTOFIX Provider v1.0.1 · fees-map-build</p>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 20, background: `${C.green}14`, border: `1px solid ${C.green}28`, color: C.green, fontSize: 10, fontWeight: 800 }}>
            Up to date
          </span>
        </div>

        {/* ── Logout ───────────────────────────────────────── */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            width: '100%', border: 'none',
            borderRadius: 18, padding: '16px 20px',
            background: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
            boxShadow: '0 4px 20px rgba(220,38,38,0.35)',
            transition: 'background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#b91c1c'
            e.currentTarget.style.transform = 'scale(1.012)'
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(220,38,38,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#dc2626'
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(220,38,38,0.35)'
          }}
        >
          <LogOut style={{ width: 16, height: 16, color: '#fff' }} />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>Logout</span>
        </button>

        {/* ── Danger zone ──────────────────────────────────── */}
        <button
          onClick={() => setShowSusp(true)}
          style={{
            width: '100%', border: 'none',
            borderRadius: 18, padding: '16px 20px',
            background: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(220,38,38,0.35)',
            transition: 'background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#b91c1c'
            e.currentTarget.style.transform = 'scale(1.012)'
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(220,38,38,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#dc2626'
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(220,38,38,0.35)'
          }}
        >
          <AlertTriangle style={{ width: 16, height: 16, color: '#fff' }} />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>Request Account Suspension</span>
        </button>

      </div>

      {/* ── Change password sheet ──────────────────────────── */}
      {showPass && (
        <>
          <div onClick={() => setShowPass(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301, background: 'var(--sheet-bg)', borderRadius: '22px 22px 0 0', padding: '0 20px 40px', animation: 'slideUp 0.3s ease', boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '14px 0 4px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--surface-5)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-hi)' }}>Change Password</p>
              <button onClick={() => setShowPass(false)} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 15, height: 15, color: 'var(--text-md)' }} />
              </button>
            </div>
            {[
              { label: 'Current Password', val: curPass, set: setCurPass, show: showCur, toggle: () => setShowCur(p => !p) },
              { label: 'New Password',     val: newPass, set: setNewPass, show: showNew, toggle: () => setShowNew(p => !p) },
              { label: 'Confirm Password', val: confPass, set: setConfPass, show: showConf, toggle: () => setShowConf(p => !p) },
            ].map(({ label, val, set, show, toggle }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>{label}</p>
                <div style={{ position: 'relative' }}>
                  <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)} className="pf-pass-input" />
                  <button type="button" onClick={toggle} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {show ? <EyeOff style={{ width: 15, height: 15, color: C.textFaint }} /> : <Eye style={{ width: 15, height: 15, color: C.textFaint }} />}
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => { toast.success('Password updated'); setShowPass(false) }}
              style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', background: `linear-gradient(135deg,${Y},${YD})`, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 }}>
              Update Password
            </button>
          </div>
        </>
      )}

      {/* ── Suspend modal ──────────────────────────────────── */}
      {showSusp && (
        <>
          <div onClick={() => setShowSusp(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 301, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
            <div style={{ background: 'var(--sheet-bg)', borderRadius: 24, padding: 28, maxWidth: 360, width: '100%', border: `1.5px solid rgba(239,68,68,0.30)`, pointerEvents: 'auto' }}>
              <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-hi)', marginBottom: 10 }}>Suspend Account?</p>
              <p style={{ fontSize: 13, color: 'var(--text-md)', lineHeight: 1.65, marginBottom: 22 }}>
                This will temporarily disable your account and stop incoming job requests. Our team will contact you to confirm before any changes are made.
              </p>
              <button onClick={() => { toast.success('Suspension request sent. Our team will contact you.'); setShowSusp(false) }}
                style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(220,38,38,0.35)' }}>
                <Check style={{ width: 15, height: 15 }} /> Yes, Request Suspension
              </button>
              <button onClick={() => setShowSusp(false)}
                style={{ width: '100%', height: 44, borderRadius: 14, border: 'none', background: 'var(--live-bg)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {showVerified && (
        <>
          <div onClick={() => setShowVerified(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 301, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
            <div style={{ background: 'var(--sheet-bg)', borderRadius: 24, padding: '28px 24px', maxWidth: 340, width: '100%', border: `1.5px solid ${Y}40`, pointerEvents: 'auto', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(245,158,11,0.4)' }}>
                <BadgeCheck style={{ width: 34, height: 34, color: '#fff' }} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-hi)', marginBottom: 8 }}>Verified Provider</p>
              <p style={{ fontSize: 13, color: 'var(--text-md)', lineHeight: 1.65, marginBottom: 22 }}>
                {name}'s identity and documents have been reviewed and approved by MOTOFIX. This badge tells drivers you're a vetted, trusted provider on the platform.
              </p>
              <button onClick={() => setShowVerified(false)}
                style={{ width: '100%', height: 46, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {showLogoutConfirm && (
        <>
          <div onClick={() => setShowLogoutConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 301, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
            <div style={{ background: 'var(--sheet-bg)', borderRadius: 24, padding: 28, maxWidth: 360, width: '100%', border: `1.5px solid rgba(239,68,68,0.30)`, pointerEvents: 'auto' }}>
              <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-hi)', marginBottom: 10 }}>Log out?</p>
              <p style={{ fontSize: 13, color: 'var(--text-md)', lineHeight: 1.65, marginBottom: 22 }}>
                You'll need to sign in again with your SPN and password to get back in.
              </p>
              <button onClick={handleLogout}
                style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(220,38,38,0.35)' }}>
                <LogOut style={{ width: 15, height: 15 }} /> Yes, Log out
              </button>
              <button onClick={() => setShowLogoutConfirm(false)}
                style={{ width: '100%', height: 44, borderRadius: 14, border: 'none', background: 'var(--live-bg)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
