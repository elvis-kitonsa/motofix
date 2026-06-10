import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Crown, CheckCircle, Calendar, Briefcase,
  AlertTriangle, Clock, Shield, Bell, Zap, Star, X, Copy, Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { C } from '@/styles/tokens'
import { useTheme } from '@/contexts/ThemeContext'
import { mechanicService, jobService, subscriptionService } from '@/config/api'
import SkeletonCard from '@/components/SkeletonCard'
import type { MechanicProfile, ServiceRequest } from '@/types'

const SUB_PRICE = 20_000
const TRIAL_DAYS = 7
const GRACE_DAYS = 3
const Y = '#F59E0B'

type SubStatus = 'trial' | 'active' | 'grace' | 'expired'

interface SubState {
  status: SubStatus
  daysLeft: number
  expiresOn: string
}

function loadSubState(): SubState {
  try {
    const raw = localStorage.getItem('sub_state')
    if (raw) {
      const { status, expires } = JSON.parse(raw) as { status: SubStatus; expires: string }
      const now = Date.now()
      const expMs = new Date(expires).getTime()
      const diff = Math.ceil((expMs - now) / 86_400_000)
      if (status === 'trial') {
        return diff > 0
          ? { status: 'trial', daysLeft: diff, expiresOn: expires }
          : { status: 'expired', daysLeft: 0, expiresOn: expires }
      }
      if (status === 'active') {
        if (diff > 0) return { status: 'active', daysLeft: diff, expiresOn: expires }
        const grace = Math.ceil((expMs + GRACE_DAYS * 86_400_000 - now) / 86_400_000)
        return grace > 0
          ? { status: 'grace', daysLeft: Math.max(1, grace), expiresOn: expires }
          : { status: 'expired', daysLeft: 0, expiresOn: expires }
      }
    }
  } catch { /* ignore parse errors */ }
  const ends = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
  localStorage.setItem('sub_state', JSON.stringify({ status: 'trial', expires: ends }))
  return { status: 'trial', daysLeft: TRIAL_DAYS, expiresOn: ends }
}

function isThisMonth(d: Date) {
  const n = new Date()
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })
}

function fmtUGX(n: number) {
  return `UGX ${n.toLocaleString('en-UG')}`
}

const BENEFITS: { icon: LucideIcon; text: string }[] = [
  { icon: Bell,        text: 'Real-time job alerts in your area'     },
  { icon: CheckCircle, text: 'Accept and complete service requests'  },
  { icon: Shield,      text: 'Verified mechanic badge on profile'    },
  { icon: Star,        text: 'Priority listing in driver search'     },
  { icon: Zap,         text: 'Instant chat with drivers'             },
  { icon: Briefcase,   text: 'Monthly job activity summary'          },
]

const STATUS_CFG: Record<SubStatus, {
  label: string; color: string; bg: string; Icon: LucideIcon; tagline: string
}> = {
  trial:   { label: 'Free Trial',   color: Y,         bg: `${Y}18`,       Icon: Crown,         tagline: 'Enjoying your 7-day free trial'      },
  active:  { label: 'Active',       color: C.green,   bg: `${C.green}18`, Icon: CheckCircle,   tagline: 'Your subscription is active'         },
  grace:   { label: 'Grace Period', color: '#F97316', bg: '#F9731618',    Icon: Clock,         tagline: 'Renew now to keep accepting jobs'    },
  expired: { label: 'Expired',      color: '#F87171', bg: '#F8717118',    Icon: AlertTriangle, tagline: 'Subscribe to continue accepting jobs' },
}

export default function Earnings() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const cardBorder = isDark ? '1.5px solid rgba(255,255,255,0.18)' : '1.5px solid rgba(0,0,0,0.65)'

  const [sub,       setSub]       = useState<SubState>(() => loadSubState())
  const [profile,   setProfile]   = useState<MechanicProfile | null>(null)
  const [monthJobs, setMonthJobs] = useState<ServiceRequest[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showPay,   setShowPay]   = useState(false)
  const [copied,    setCopied]    = useState<string | null>(null)
  const [sent,      setSent]      = useState(false)

  const sheetRef   = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragDelta  = useRef(0)

  useEffect(() => {
    subscriptionService.getMySubscription()
      .then(res => {
        const d = res.data
        const expiresOn =
          d.trial_ends_at ?? d.current_period_end ?? d.grace_ends_at ??
          new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
        setSub({ status: d.status, daysLeft: d.days_left, expiresOn })
        localStorage.setItem('sub_state', JSON.stringify({ status: d.status, expires: expiresOn }))
      })
      .catch(() => { /* keep localStorage-derived state already in useState */ })

    Promise.allSettled([mechanicService.getProfile(), jobService.getActive()])
      .then(([pR, jR]) => {
        if (pR.status === 'fulfilled') setProfile(pR.value.data)
        if (jR.status === 'fulfilled') {
          const all: ServiceRequest[] = jR.value.data ?? []
          setMonthJobs(
            all.filter(j =>
              j.status === 'completed' &&
              isThisMonth(new Date(j.completed_at ?? j.completed_time ?? j.created_at))
            )
          )
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const cfg     = STATUS_CFG[sub.status]
  const CfgIcon = cfg.Icon
  const payRef  = `MTX-${profile?.spn ?? 'SPN'}`

  const onSheetDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    dragDelta.current  = 0
    if (sheetRef.current) sheetRef.current.style.transition = 'none'
    const onMove = (ev: PointerEvent) => {
      const d = Math.max(0, ev.clientY - dragStartY.current)
      dragDelta.current = d
      if (sheetRef.current) sheetRef.current.style.transform = `translateY(${d}px)`
    }
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      if (!sheetRef.current) return
      sheetRef.current.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1)'
      if (dragDelta.current > 110) {
        sheetRef.current.style.transform = 'translateY(110%)'
        setTimeout(() => setShowPay(false), 280)
      } else {
        sheetRef.current.style.transform = 'translateY(0)'
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
  }, [])

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  return (
    <div style={{ padding: '16px 16px 88px' }}>

      {/* ── Subscription Status Card ─────────────────────────── */}
      <div style={{
        borderRadius: 20, padding: '18px 16px', marginBottom: 12,
        background: 'var(--surface-1)',
        borderTop: cardBorder, borderRight: cardBorder,
        borderBottom: cardBorder, borderLeft: cardBorder,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20,
            background: cfg.bg, color: cfg.color,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
          }}>
            <CfgIcon style={{ width: 11, height: 11 }} />
            {cfg.label}
          </span>

          {sub.status === 'active' ? (
            <span style={{ fontSize: 11, color: C.textFaint }}>
              Renews {fmtShortDate(sub.expiresOn)}
            </span>
          ) : sub.daysLeft > 0 ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
              {sub.daysLeft} day{sub.daysLeft !== 1 ? 's' : ''} left
            </span>
          ) : null}
        </div>

        <p style={{ fontSize: 18, fontWeight: 900, color: C.textHi, letterSpacing: '-0.02em', marginBottom: 2 }}>
          MOTOFIX Subscription
        </p>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: sub.status !== 'active' ? 16 : 0 }}>
          {cfg.tagline}
        </p>

        {sub.status !== 'active' && (
          <button
            onClick={() => setShowPay(true)}
            style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              background: sub.status === 'expired' || sub.status === 'grace'
                ? 'linear-gradient(135deg,#F87171,#EF4444)'
                : `linear-gradient(135deg,${Y},#D97706)`,
              color: sub.status === 'expired' || sub.status === 'grace' ? '#fff' : '#000',
              fontSize: 14, fontWeight: 800,
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            }}
          >
            {sub.status === 'trial'
              ? `Subscribe · ${fmtUGX(SUB_PRICE)}/month`
              : `Renew Now · ${fmtUGX(SUB_PRICE)}/month`}
          </button>
        )}
      </div>

      {/* ── What's Included ───────────────────────────────────── */}
      <div style={{
        borderRadius: 18, padding: '16px', marginBottom: 12,
        background: 'var(--surface-1)', border: cardBorder,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: `${Y}18`, border: `1px solid ${Y}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Crown style={{ width: 15, height: 15, color: Y }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: C.textHi, lineHeight: 1 }}>What's Included</p>
            <p style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>{fmtUGX(SUB_PRICE)} / month</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {BENEFITS.map(({ icon: BIcon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `${C.green}14`, border: `1px solid ${C.green}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BIcon style={{ width: 13, height: 13, color: C.green }} />
              </div>
              <p style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── This Month's Activity ─────────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.textHi }}>This Month's Activity</p>
        <p style={{ fontSize: 11, color: C.textFaint, marginTop: 1 }}>
          {loading ? '—' : `${monthJobs.length} job${monthJobs.length !== 1 ? 's' : ''} completed`}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => <SkeletonCard key={i} lines={2} />)}
        </div>
      ) : monthJobs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '30px 16px',
          background: 'var(--surface-1)', borderRadius: 16, border: cardBorder,
        }}>
          <Calendar style={{ width: 32, height: 32, color: C.textFaint, margin: '0 auto 10px' }} />
          <p style={{ fontSize: 14, fontWeight: 800, color: C.textHi, marginBottom: 5 }}>
            No jobs yet this month
          </p>
          <p style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.6, maxWidth: 200, margin: '0 auto' }}>
            Completed jobs will appear here so you can track the value you're getting from your subscription.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {monthJobs.map(j => (
            <div key={j.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', background: 'var(--surface-1)',
              borderRadius: 14, border: cardBorder,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: `${C.green}14`, border: `1px solid ${C.green}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle style={{ width: 17, height: 17, color: C.green }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.textHi, lineHeight: 1 }}>
                  {j.issue_type ?? j.service_type ?? 'Service Request'}
                </p>
                <p style={{ fontSize: 11, color: C.textFaint, marginTop: 3 }}>
                  {j.driver_name ? `${j.driver_name} · ` : ''}
                  {fmtShortDate(j.completed_at ?? j.completed_time ?? j.created_at)}
                </p>
              </div>
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}25`,
                flexShrink: 0,
              }}>
                Done
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Bank Transfer Modal ───────────────────────────────── */}
      {showPay && (
        <>
          <style>{`
            @keyframes subSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          `}</style>

          <div
            onClick={() => setShowPay(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)' }}
          />

          <div
            ref={sheetRef}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
              background: 'var(--sheet-bg)', borderRadius: '22px 22px 0 0',
              padding: '0 20px 44px',
              animation: 'subSlideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
              maxHeight: '85vh', overflowY: 'auto',
            }}
          >
            {/* Drag handle */}
            <div
              onPointerDown={onSheetDragStart}
              style={{ padding: '14px 0 6px', display: 'flex', justifyContent: 'center', cursor: 'grab', touchAction: 'none' }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--surface-5)' }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-hi)' }}>
                  {sub.status === 'trial' ? 'Subscribe to MOTOFIX' : 'Renew Your Subscription'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
                  Bank transfer · {fmtUGX(SUB_PRICE)}/month
                </p>
              </div>
              <button
                onClick={() => setShowPay(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: 'none',
                  cursor: 'pointer', background: 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X style={{ width: 15, height: 15, color: 'var(--text-md)' }} />
              </button>
            </div>

            {/* Instructions banner */}
            <div style={{
              borderRadius: 14, padding: '12px 14px', marginBottom: 16,
              background: `${Y}0E`, border: `1px solid ${Y}28`,
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                Transfer <strong style={{ color: Y }}>{fmtUGX(SUB_PRICE)}</strong> to the account below.
                Include your <strong style={{ color: Y }}>Payment Reference</strong> in the transfer description
                so we can verify and activate your subscription automatically.
              </p>
            </div>

            {/* Bank details */}
            {([
              { label: 'Bank Name',        value: 'Equity Bank Uganda',  key: 'bank'   },
              { label: 'Account Name',     value: 'MOTOFIX Ltd',         key: 'name'   },
              { label: 'Account Number',   value: '4000XXXXXXXXXXXX',    key: 'acct'   },
              { label: 'Amount',           value: fmtUGX(SUB_PRICE),     key: 'amount' },
              { label: 'Payment Reference',value: payRef,                 key: 'ref'    },
            ]).map(({ label, value, key }, idx, arr) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 0',
                borderBottom: idx < arr.length - 1 ? '1px solid var(--border-1)' : 'none',
              }}>
                <div>
                  <p style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--text-faint)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {label}
                  </p>
                  <p style={{
                    fontSize: 14, fontWeight: 700, marginTop: 2,
                    color: key === 'ref' ? Y : 'var(--text-hi)',
                  }}>
                    {value}
                  </p>
                </div>
                <button
                  onClick={() => copyText(value, key)}
                  style={{
                    padding: '6px 10px', borderRadius: 10, border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: copied === key ? `${C.green}18` : 'var(--surface-3)',
                    color: copied === key ? C.green : 'var(--text-md)',
                    fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copied === key
                    ? <><Check style={{ width: 11, height: 11 }} /> Copied</>
                    : <><Copy style={{ width: 11, height: 11 }} /> Copy</>
                  }
                </button>
              </div>
            ))}

            {/* Submit */}
            <button
              onClick={() => {
                setSent(true)
                setTimeout(() => { setSent(false); setShowPay(false) }, 2000)
              }}
              style={{
                width: '100%', marginTop: 22, padding: '15px', borderRadius: 16,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: sent
                  ? `linear-gradient(135deg,${C.green},#16a34a)`
                  : `linear-gradient(135deg,${Y},#D97706)`,
                color: sent ? '#fff' : '#000',
                fontSize: 15, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s ease',
              }}
            >
              {sent
                ? <><Check style={{ width: 18, height: 18 }} /> Payment Submitted</>
                : "I've Made This Transfer"
              }
            </button>

            <p style={{
              fontSize: 11, color: 'var(--text-faint)', textAlign: 'center',
              marginTop: 10, lineHeight: 1.65,
            }}>
              Your subscription activates once payment is verified.
              This typically takes a few minutes during business hours.
            </p>
          </div>
        </>
      )}

    </div>
  )
}
