// CancelJobModal.tsx — the confirmation popup when a mechanic cancels a job they accepted.
// Requires a reason and warns that cancelling counts against them (cancellation strikes).

import { useEffect, useState } from 'react'
import { X, AlertTriangle, Loader2, Ban } from 'lucide-react'
import { C } from '@/styles/tokens'
import { jobService } from '@/config/api'

const REASONS = [
  'Vehicle breakdown on my way',
  'Stuck in traffic — I won\'t arrive in time',
  'Personal emergency',
  'Job is outside my service area',
  'I can\'t handle this type of repair',
  'Driver is unreachable',
]

interface Props {
  requestId: string | number
  onClose: () => void
  // Called after a successful cancel with the strike/suspension outcome.
  onCancelled: (outcome: { strikes: number; suspended: boolean; limit: number; suspension_count?: number } | null) => void
}

export default function CancelJobModal({ requestId, onClose, onCancelled }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [strikes, setStrikes] = useState(0)
  const [limit, setLimit] = useState(3)

  // Pull the current strike count so the warning can escalate appropriately.
  useEffect(() => {
    jobService.getStrikes()
      .then(res => { setStrikes(res.data?.strikes ?? 0); setLimit(res.data?.limit ?? 3) })
      .catch(() => {})
  }, [])

  const isOther = selected === '__other__'
  const reason = isOther ? otherText.trim() : (selected ?? '')
  const canSubmit = !!reason && !submitting

  // After this cancellation, how many in a row? (Suspends at `limit`.)
  const willBe = strikes + 1
  const isFinal = willBe >= limit

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await jobService.cancel(requestId, reason)
      onCancelled(res.data?.cancellation ?? null)
    } catch {
      onCancelled(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1201,
        width: 'calc(100% - 32px)', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--surface-1)', borderRadius: 22, padding: '20px 20px 22px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ban style={{ width: 20, height: 20, color: '#EF4444' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 900, color: C.textHi }}>Cancel this job?</p>
            <p style={{ fontSize: 12, color: C.textFaint, marginTop: 1 }}>Let the driver know why you can't make it.</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 15, height: 15, color: C.textFaint }} />
          </button>
        </div>

        {/* Suspension warning — ALWAYS shown */}
        <div style={{
          display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, marginBottom: 16,
          background: isFinal ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.10)',
          border: `1px solid ${isFinal ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.35)'}`,
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: isFinal ? '#EF4444' : '#F59E0B', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>
            {isFinal ? (
              <>
                <strong style={{ color: '#EF4444' }}>Final warning.</strong> This would be your{' '}
                <strong>{willBe}{willBe === 3 ? 'rd' : 'th'} cancellation in a row</strong>. Confirming will{' '}
                <strong style={{ color: '#EF4444' }}>automatically suspend your account</strong> and may lead to closure.
              </>
            ) : (
              <>
                Cancelling on a driver after picking up their request <strong>{limit} times in a row</strong> can lead to{' '}
                <strong>automatic suspension or closure of your account</strong>. Repeated cancellations hurt MOTOFIX's reputation.
                {strikes > 0 && <> You've cancelled <strong>{strikes}</strong> time{strikes === 1 ? '' : 's'} in a row already.</>}
              </>
            )}
          </div>
        </div>

        {/* Reasons */}
        <p style={{ fontSize: 11, fontWeight: 800, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Reason
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
          {[...REASONS, '__other__'].map(r => {
            const active = selected === r
            const label = r === '__other__' ? 'Other (type below)' : r
            return (
              <button
                key={r}
                onClick={() => setSelected(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  padding: '11px 13px', borderRadius: 12, cursor: 'pointer',
                  background: active ? 'rgba(245,158,11,0.10)' : 'var(--surface-2)',
                  border: `1.5px solid ${active ? C.amber : 'var(--border-2)'}`,
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${active ? C.amber : 'var(--border-3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.amber }} />}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: active ? C.textHi : C.textMuted }}>{label}</span>
              </button>
            )
          })}
        </div>

        {isOther && (
          <textarea
            value={otherText}
            onChange={e => setOtherText(e.target.value)}
            placeholder="Tell the driver what's going on…"
            rows={2}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'none', marginBottom: 12,
              background: 'var(--surface-3)', border: '1.5px solid var(--border-3)', borderRadius: 12,
              padding: '10px 12px', color: C.textHi, fontSize: 13.5, lineHeight: 1.5, outline: 'none',
            }}
          />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 46, borderRadius: 13, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Keep job
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              flex: 1.4, height: 46, borderRadius: 13, border: 'none',
              background: canSubmit ? '#EF4444' : 'var(--surface-4)',
              color: canSubmit ? '#fff' : C.textFaint, fontWeight: 800, fontSize: 14,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {submitting ? <Loader2 style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> : <Ban style={{ width: 16, height: 16 }} />}
            {isFinal ? 'Cancel & suspend' : 'Cancel job'}
          </button>
        </div>
      </div>
    </>
  )
}
