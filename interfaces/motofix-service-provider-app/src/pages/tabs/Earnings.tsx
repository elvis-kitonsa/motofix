// tabs/Earnings.tsx — the Earnings tab: shows what the mechanic has earned and the platform
// fees they owe (the 10k-per-job fee). Also handles paying off outstanding fees, which is what
// can gate going online (see the platform-fee logic in the dispatch service).

import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, AlertTriangle, CheckCircle, Lock, Sparkles, X, Loader2, Info, ShieldCheck, Wrench, Smartphone,
} from 'lucide-react'
import { C } from '@/styles/tokens'
import { useTheme } from '@/contexts/ThemeContext'
import { mechanicService, feesService } from '@/config/api'
import type { PlatformFeeState } from '@/config/api'
import SkeletonCard from '@/components/SkeletonCard'

// MOTOFIX's revenue is a flat per-job platform fee (this screen replaced the old
// monthly subscription). The mechanic settles their owed balance here; the payment is
// AI-verified from the MoMo confirmation, after which the platform un-gates them.
// MOTOFIX's collection line — the mechanic sends their platform fees here. Fixed and
// non-editable on the pay sheet (you can't change who you're paying).
const MOTOFIX_MOMO = '0700 454 171'
const Y = '#F59E0B'
const MTN_YELLOW = '#FFCC00'
const AIRTEL_RED = '#E40000'

function fmtUGX(n: number) {
  return `UGX ${n.toLocaleString('en-UG')}`
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

// Date + time of completion in Kampala time, so the mechanic can match the fee to a real job.
function fmtWhen(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'recently'
  return d.toLocaleString('en-UG', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    timeZone: 'Africa/Kampala',
  })
}

export default function Earnings() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const cardBorder = isDark ? '1.5px solid rgba(255,255,255,0.18)' : '1.5px solid rgba(0,0,0,0.65)'

  const [mechId, setMechId]   = useState<string | null>(null)
  const [fees,   setFees]     = useState<PlatformFeeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)  // true when we couldn't reach the server
  const [showPay, setShowPay] = useState(false)

  // Simulated MoMo payment flow: idle → sending → ai-verifying → done
  const [payPhase, setPayPhase] = useState<'idle' | 'sending' | 'verifying' | 'done'>('idle')
  const [payResult, setPayResult] = useState<{ amount: number; cleared: number } | null>(null)
  const [network, setNetwork] = useState<'mtn' | 'airtel'>('mtn')
  const [payAmount, setPayAmount] = useState('')   // "Enter amount to pay" — defaults to the owed balance

  const loadFees = useCallback(async (id: string) => {
    try {
      const res = await feesService.getFees(id)
      const d = res.data
      // Guard against a non-JSON reply (e.g. an SPA index.html fallback when /fees isn't
      // routed): if it isn't a real fee payload, treat it as a load error — never as 0 owed.
      if (!d || typeof d !== 'object' || typeof d.owed_amount !== 'number') {
        setLoadError(true)
        return
      }
      setFees(d)
      setLoadError(false)   // got a real answer from the server
    } catch {
      // Important: a failed request must NOT look like "owed 0" / "Nothing to pay".
      // Flag the error so the UI can say so and offer a retry instead.
      setLoadError(true)
    }
  }, [])

  // Look up the mechanic's id, then their fee balance. Wrapped so the "Retry" button
  // can re-run the whole thing if the first attempt couldn't reach the server.
  const init = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await mechanicService.getProfile()
      const id = String(res.data.id)
      setMechId(id)
      await loadFees(id)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [loadFees])

  useEffect(() => { init() }, [init])

  // True only when we genuinely couldn't load the balance — used so we never render a
  // misleading "Nothing to pay" / UGX 0 when the real cause is a failed request.
  const failed   = loadError && !fees
  const owed     = fees?.owed_amount ?? 0
  const owedJobs = fees?.owed_count ?? 0
  const cap      = fees?.gate_jobs ?? 3
  const perJob   = fees?.fee_per_job ?? 10000
  const gated    = !!fees?.gated
  const locked   = !!fees?.locked
  const pct      = Math.min(100, Math.round((owedJobs / cap) * 100))

  // Status colour + headline for the balance hero.
  const tone = failed ? C.textFaint : locked ? '#F87171' : gated ? '#F97316' : owed > 0 ? Y : C.green

  const amountNum = Math.round(Number(payAmount) || 0)
  const amountValid = amountNum > 0 && amountNum <= owed

  const runSimulatedPayment = async () => {
    if (!mechId || !amountValid) return
    const net = network === 'mtn' ? 'MTN' : 'Airtel'
    const ref = `MTX${Date.now().toString().slice(-6)}`
    setPayPhase('sending')
    // 1) Mechanic "sends" the Mobile Money payment from the chosen network.
    await new Promise(r => setTimeout(r, 1100))
    setPayPhase('verifying')
    // 2) AI reads the MoMo confirmation message and matches it to the balance.
    await new Promise(r => setTimeout(r, 800))
    const smsText = `${net} MoMo: You have sent ${fmtUGX(amountNum)} to MOTOFIX LTD (${MOTOFIX_MOMO}). Ref ${ref}. Thank you.`
    try {
      const res = await feesService.pay(mechId, { amount: amountNum, sms_text: smsText, reference: ref })
      const data = res.data as { amount?: number; cleared_jobs?: number }
      setPayResult({ amount: data.amount ?? amountNum, cleared: data.cleared_jobs ?? 0 })
      await loadFees(mechId)
      setPayPhase('done')
    } catch {
      setPayPhase('idle')
    }
  }

  const closePay = () => {
    setShowPay(false)
    setTimeout(() => { setPayPhase('idle'); setPayResult(null) }, 250)
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 16px 88px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2].map(i => <SkeletonCard key={i} lines={2} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 16px 88px' }}>

      {/* ── Owed-balance hero ─────────────────────────────────── */}
      <div style={{
        borderRadius: 20, padding: '20px 18px', marginBottom: 12,
        background: 'var(--surface-1)', border: cardBorder,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: `${tone}1A`, border: `1px solid ${tone}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Wallet style={{ width: 18, height: 18, color: tone }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Platform fees owed
            </p>
            <p style={{ fontSize: 26, fontWeight: 900, color: C.textHi, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
              {failed ? '—' : fmtUGX(owed)}
            </p>
          </div>
        </div>

        {/* Progress toward the gate */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
              {owedJobs} of {cap} unpaid jobs
            </span>
            <span style={{ fontSize: 11, color: tone, fontWeight: 800 }}>
              {fmtUGX(perJob)} / job
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 6, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: tone, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* State banner */}
        {failed ? (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: '#F8717112', border: '1px solid #F8717133', marginBottom: 14 }}>
            <AlertTriangle style={{ width: 15, height: 15, color: '#F87171', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              <strong style={{ color: '#F87171' }}>Couldn't load your fees.</strong> We couldn't reach the server — check your connection and tap Retry below.
            </p>
          </div>
        ) : locked ? (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: '#F8717114', border: '1px solid #F8717133', marginBottom: 14 }}>
            <Lock style={{ width: 15, height: 15, color: '#F87171', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              <strong style={{ color: '#F87171' }}>Account locked.</strong> Your fees are overdue — settle the balance to restore access to the platform.
            </p>
          </div>
        ) : gated ? (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: '#F9731614', border: '1px solid #F9731633', marginBottom: 14 }}>
            <AlertTriangle style={{ width: 15, height: 15, color: '#F97316', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              <strong style={{ color: '#F97316' }}>New jobs paused.</strong> You've reached {cap} unpaid jobs. Settle your balance to start accepting requests again.
            </p>
          </div>
        ) : owed > 0 ? (
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: `${Y}10`, border: `1px solid ${Y}28`, marginBottom: 14 }}>
            <Info style={{ width: 15, height: 15, color: Y, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              Settle before <strong style={{ color: Y }}>{cap} unpaid jobs</strong> to keep accepting work without interruption.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: `${C.green}12`, border: `1px solid ${C.green}28`, marginBottom: 14 }}>
            <CheckCircle style={{ width: 15, height: 15, color: C.green, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              You're all settled — no platform fees owed. Nice work.
            </p>
          </div>
        )}

        {failed ? (
          /* Couldn't load — let the mechanic retry rather than show a misleading button. */
          <button
            onClick={() => init()}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              background: `linear-gradient(135deg, ${tone}, ${tone}CC)`, color: '#fff',
              fontSize: 14.5, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <AlertTriangle style={{ width: 17, height: 17 }} />
            Retry
          </button>
        ) : (
          <button
            onClick={() => { setShowPay(true); setPayAmount(String(owed)); setNetwork('mtn') }}
            disabled={owed <= 0}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              cursor: owed > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              background: owed > 0 ? `linear-gradient(135deg, ${tone}, ${tone}CC)` : 'var(--surface-3)',
              color: owed > 0 ? '#fff' : C.textFaint,
              fontSize: 14.5, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Wallet style={{ width: 17, height: 17 }} />
            {owed > 0 ? `Settle ${fmtUGX(owed)}` : 'Nothing to pay'}
          </button>
        )}
      </div>

      {/* ── How the fee works ─────────────────────────────────── */}
      <div style={{ borderRadius: 16, padding: '14px 16px', marginBottom: 12, background: 'var(--surface-1)', border: cardBorder }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles style={{ width: 14, height: 14, color: Y }} />
          <p style={{ fontSize: 13, fontWeight: 800, color: C.textHi }}>How MOTOFIX charges</p>
        </div>
        <p style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
          A flat <strong style={{ color: Y }}>{fmtUGX(perJob)}</strong> is added <strong style={{ color: C.textHi }}>only after a job is completed</strong> — never upfront and never while you're working. It's the same whether the job is small or large, so the platform never profits from a bigger bill, and never touches how the driver pays you (cash or MoMo). No monthly subscription; you only pay for jobs you actually earn through MOTOFIX.
        </p>
      </div>

      {/* ── Billed jobs ───────────────────────────────────────── */}
      <p style={{ fontSize: 14, fontWeight: 800, color: C.textHi, marginBottom: 8 }}>Unpaid jobs</p>
      {(!fees || (fees.jobs?.length ?? 0) === 0) ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--surface-1)', borderRadius: 16, border: cardBorder }}>
          <CheckCircle style={{ width: 30, height: 30, color: C.green, margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: C.textHi }}>No outstanding fees</p>
          <p style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>Completed jobs that incur a fee will show here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(fees.jobs ?? []).map(j => {
            const svc = titleCase((j.service_type || 'Service').replace(/_/g, ' '))
            const when = j.completed_at || j.created_at
            const hasDetail = j.job_fee != null || !!j.service_note
            return (
              <div key={j.request_id} style={{
                padding: '12px 14px', background: 'var(--surface-1)', borderRadius: 14, border: cardBorder,
              }}>
                {/* Header: which job + the flat fee it incurred */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${Y}14`, border: `1px solid ${Y}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wrench style={{ width: 16, height: 16, color: Y }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.textHi }}>
                      {svc} · Job #{String(j.request_id).padStart(6, '0')}
                    </p>
                    <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                      {j.customer_name ? `For ${j.customer_name}` : 'Completed job'}
                    </p>
                    <p style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
                      {when ? `Completed ${fmtWhen(when)}` : 'Completed'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: Y }}>{fmtUGX(j.amount)}</span>
                    <p style={{ fontSize: 9.5, color: C.textFaint, marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>fee owed</p>
                  </div>
                </div>

                {/* Why this 10k: tie it to what the mechanic actually earned + work note */}
                {hasDetail && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {j.job_fee != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, color: C.textMuted }}>You charged this job</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.textHi }}>{fmtUGX(j.job_fee)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: C.textMuted }}>MOTOFIX platform fee</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: Y }}>{fmtUGX(j.amount)}</span>
                    </div>
                    {j.service_note && (
                      <p style={{ fontSize: 11, color: C.textFaint, lineHeight: 1.5, marginTop: 2 }}>
                        Work done: {j.service_note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pay sheet (simulated MoMo + AI verification) ──────── */}
      {showPay && (
        <>
          <style>{`@keyframes feeSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          <div onClick={payPhase === 'idle' ? closePay : undefined} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401, maxWidth: 480, margin: '0 auto',
            background: 'var(--sheet-bg, var(--surface-1))', borderRadius: '22px 22px 0 0', padding: '0 20px 40px',
            animation: 'feeSlideUp 0.3s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--surface-5, var(--border-3))' }} />
            </div>

            {payPhase === 'done' ? (
              /* Success — AI confirmed the payment */
              <div style={{ textAlign: 'center', padding: '14px 4px 6px' }}>
                <div style={{ width: 66, height: 66, borderRadius: '50%', margin: '0 auto 14px', background: `${C.green}1A`, border: `2px solid ${C.green}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck style={{ width: 32, height: 32, color: C.green }} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 900, color: C.textHi, marginBottom: 6 }}>Payment verified by AI</p>
                <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 18 }}>
                  We detected your {fmtUGX(payResult?.amount ?? 0)} MoMo payment and cleared{' '}
                  <strong style={{ color: C.green }}>{payResult?.cleared ?? 0} job{(payResult?.cleared ?? 0) !== 1 ? 's' : ''}</strong>.
                  Your account is active and the admin team has been notified.
                </p>
                <button onClick={closePay} style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${C.green},#16a34a)`, color: '#fff', fontSize: 14.5, fontWeight: 800 }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 900, color: C.textHi }}>Settle platform fees</p>
                    <p style={{ fontSize: 12, color: C.textFaint, marginTop: 3 }}>Mobile Money · {fmtUGX(owed)}</p>
                  </div>
                  {payPhase === 'idle' && (
                    <button onClick={closePay} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X style={{ width: 15, height: 15, color: C.textMuted }} />
                    </button>
                  )}
                </div>

                {/* Network — MTN or Airtel Mobile Money only (no cash for platform fees) */}
                <p style={{ fontSize: 11.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Pay with
                </p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {([
                    { id: 'mtn'    as const, label: 'MTN MoMo',    color: MTN_YELLOW, fg: '#000' },
                    { id: 'airtel' as const, label: 'Airtel Money', color: AIRTEL_RED, fg: '#fff' },
                  ]).map(opt => {
                    const sel = network === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setNetwork(opt.id)}
                        disabled={payPhase !== 'idle'}
                        style={{
                          flex: 1, padding: '13px 10px', borderRadius: 14, cursor: payPhase === 'idle' ? 'pointer' : 'default',
                          fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
                          background: sel ? opt.color : 'var(--surface-2)',
                          color: sel ? opt.fg : C.textMuted,
                          border: sel ? `2px solid ${opt.color}` : '1.5px solid var(--border-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Smartphone style={{ width: 15, height: 15 }} />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {/* Non-editable MOTOFIX collection number */}
                <p style={{ fontSize: 11.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Send to (MOTOFIX number)
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderRadius: 14, padding: '13px 16px', marginBottom: 16,
                  background: 'var(--surface-2)', border: '1.5px solid var(--border-2)',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: C.textHi, letterSpacing: '0.04em' }}>{MOTOFIX_MOMO}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: C.textFaint }}>
                    <Lock style={{ width: 12, height: 12 }} /> Locked
                  </span>
                </div>

                {/* Enter amount to pay */}
                <p style={{ fontSize: 11.5, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Amount to pay
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderRadius: 14, padding: '4px 16px', marginBottom: 8,
                  background: 'var(--surface-2)', border: `1.5px solid ${amountValid ? `${Y}55` : 'var(--border-2)'}`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.textFaint }}>UGX</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    disabled={payPhase !== 'idle'}
                    placeholder={String(owed)}
                    style={{
                      flex: 1, padding: '12px 0', border: 'none', outline: 'none', background: 'transparent',
                      fontFamily: 'inherit', fontSize: 18, fontWeight: 900, color: C.textHi,
                    }}
                  />
                </div>
                <p style={{ fontSize: 11, color: C.textFaint, marginBottom: 16 }}>
                  You owe <strong style={{ color: Y }}>{fmtUGX(owed)}</strong>.{' '}
                  {amountNum > owed ? <span style={{ color: '#F87171' }}>That's more than you owe.</span> : 'You can settle all of it at once.'}
                </p>

                <button
                  onClick={runSimulatedPayment}
                  disabled={payPhase !== 'idle' || !amountValid}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                    cursor: payPhase === 'idle' && amountValid ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                    background: amountValid ? `linear-gradient(135deg,${Y},#D97706)` : 'var(--surface-3)',
                    color: amountValid ? '#000' : C.textFaint,
                    fontSize: 14.5, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    opacity: payPhase !== 'idle' ? 0.85 : 1,
                  }}
                >
                  {payPhase === 'sending' && <><Loader2 style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> Sending payment…</>}
                  {payPhase === 'verifying' && <><Sparkles style={{ width: 17, height: 17 }} /> AI verifying payment…</>}
                  {payPhase === 'idle' && <>Complete Payment{amountValid ? ` · ${fmtUGX(amountNum)}` : ''}</>}
                </button>
              </>
            )}
          </div>
        </>
      )}

    </div>
  )
}
