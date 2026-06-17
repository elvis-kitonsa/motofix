import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, AlertTriangle, CheckCircle, Lock, Sparkles, X, Loader2, Info, ShieldCheck, Wrench,
} from 'lucide-react'
import { C } from '@/styles/tokens'
import { useTheme } from '@/contexts/ThemeContext'
import { mechanicService, feesService } from '@/config/api'
import type { PlatformFeeState } from '@/config/api'
import SkeletonCard from '@/components/SkeletonCard'

// MOTOFIX's revenue is a flat per-job platform fee (this screen replaced the old
// monthly subscription). The mechanic settles their owed balance here; the payment is
// AI-verified from the MoMo confirmation, after which the platform un-gates them.
const MOTOFIX_MOMO = '0770 000 000'
const Y = '#F59E0B'

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
  const [showPay, setShowPay] = useState(false)

  // Simulated MoMo payment flow: idle → sending → ai-verifying → done
  const [payPhase, setPayPhase] = useState<'idle' | 'sending' | 'verifying' | 'done'>('idle')
  const [payResult, setPayResult] = useState<{ amount: number; cleared: number } | null>(null)

  const loadFees = useCallback(async (id: string) => {
    try {
      const res = await feesService.getFees(id)
      setFees(res.data)
    } catch { /* keep prior state */ }
  }, [])

  useEffect(() => {
    mechanicService.getProfile()
      .then(async (res) => {
        const id = String(res.data.id)
        setMechId(id)
        await loadFees(id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [loadFees])

  const owed     = fees?.owed_amount ?? 0
  const owedJobs = fees?.owed_count ?? 0
  const cap      = fees?.gate_jobs ?? 3
  const perJob   = fees?.fee_per_job ?? 10000
  const gated    = !!fees?.gated
  const locked   = !!fees?.locked
  const pct      = Math.min(100, Math.round((owedJobs / cap) * 100))

  // Status colour + headline for the balance hero.
  const tone = locked ? '#F87171' : gated ? '#F97316' : owed > 0 ? Y : C.green

  const runSimulatedPayment = async () => {
    if (!mechId || owed <= 0) return
    const ref = `MTX${Date.now().toString().slice(-6)}`
    setPayPhase('sending')
    // 1) Mechanic "sends" the MoMo payment.
    await new Promise(r => setTimeout(r, 1100))
    setPayPhase('verifying')
    // 2) AI reads the MoMo confirmation message and matches it to the balance.
    const smsText = `MTN MoMo: You have sent ${fmtUGX(owed)} to MOTOFIX LTD (${MOTOFIX_MOMO}). Ref ${ref}. Thank you.`
    try {
      const res = await feesService.pay(mechId, { sms_text: smsText, reference: ref })
      const data = res.data as { amount?: number; cleared_jobs?: number }
      setPayResult({ amount: data.amount ?? owed, cleared: data.cleared_jobs ?? owedJobs })
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
              {fmtUGX(owed)}
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
        {locked ? (
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

        <button
          onClick={() => setShowPay(true)}
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

                <div style={{ borderRadius: 14, padding: '14px 16px', marginBottom: 16, background: `${Y}0E`, border: `1px solid ${Y}28` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.textFaint }}>Pay to (MOTOFIX MoMo)</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.textHi }}>{MOTOFIX_MOMO}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.textFaint }}>Amount</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: Y }}>{fmtUGX(owed)}</span>
                  </div>
                </div>

                <p style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.6, marginBottom: 16, display: 'flex', gap: 7 }}>
                  <Sparkles style={{ width: 13, height: 13, color: Y, flexShrink: 0, marginTop: 1 }} />
                  <span>This is a demo. Tapping below simulates the MoMo charge; our AI then reads the confirmation message and verifies the amount — exactly as it would in production (where the MoMo gateway also confirms automatically).</span>
                </p>

                <button
                  onClick={runSimulatedPayment}
                  disabled={payPhase !== 'idle'}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                    cursor: payPhase === 'idle' ? 'pointer' : 'default', fontFamily: 'inherit',
                    background: `linear-gradient(135deg,${Y},#D97706)`, color: '#000',
                    fontSize: 14.5, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    opacity: payPhase !== 'idle' ? 0.85 : 1,
                  }}
                >
                  {payPhase === 'sending' && <><Loader2 style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> Sending MoMo payment…</>}
                  {payPhase === 'verifying' && <><Sparkles style={{ width: 17, height: 17 }} /> AI verifying payment…</>}
                  {payPhase === 'idle' && <>Pay {fmtUGX(owed)} via MoMo</>}
                </button>
              </>
            )}
          </div>
        </>
      )}

    </div>
  )
}
