// BeginJourneyModal.tsx — the popup the mechanic confirms when starting their trip to a
// job. Once confirmed, the job moves to "en route" and the live tracking/journey begins.

import { useState } from 'react'
import { Loader2, ChevronDown, X, MapPin, Wrench, CheckCircle2 } from 'lucide-react'
import { C } from '@/styles/tokens'
import { useReadableLocation } from '@/utils/geocode'
import type { ServiceRequest } from '@/types'

const CHECKLIST = [
  { icon: '🔧', text: 'Check that your tools and equipment are ready' },
  { icon: '📍', text: 'Note the driver\'s location — head there directly' },
  { icon: '🪪', text: 'Have your ID and MOTOFIX badge accessible' },
  { icon: '📱', text: 'Keep your phone charged and ringer on' },
  { icon: '💬', text: 'Greet the driver and assess the situation before starting work' },
]

interface Props {
  request: ServiceRequest
  onBeginJourney: () => Promise<void>
  onDismiss: () => void
}

export default function BeginJourneyModal({ request, onBeginJourney, onDismiss }: Props) {
  const [loading, setLoading] = useState(false)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const locationText = useReadableLocation(request)

  const handleBegin = async () => {
    setLoading(true)
    try {
      await onBeginJourney()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes bjm-pop-in {
          from { transform: translate(-50%, -50%) scale(0.88); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
        }
        @keyframes bjm-icon-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.15); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes bjm-ring {
          0%   { transform: translate(-50%,-50%) scale(0.85); opacity: 0.7; }
          80%  { transform: translate(-50%,-50%) scale(2.1);  opacity: 0;   }
          100% { opacity: 0; }
        }
        @keyframes bjm-checklist-open {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bjm-close:hover { background: rgba(255,255,255,0.1) !important; }
        .bjm-begin:hover:not(:disabled) {
          filter: brightness(1.12);
          box-shadow: 0 0 0 4px rgba(251,191,36,0.3), 0 8px 28px rgba(251,191,36,0.5) !important;
          transform: translateY(-1px);
        }
        .bjm-begin:active:not(:disabled) { transform: translateY(0); }
        .bjm-begin { transition: filter 0.15s, box-shadow 0.15s, transform 0.15s; }
        .bjm-close { transition: background 0.15s; }
      `}</style>

      {/* Backdrop — intentionally not dismissible; mechanic must explicitly close or begin */}
      <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.60)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      />

      {/* Centered card */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 1000,
        transform: 'translate(-50%, -50%)',
        width: 'calc(100% - 32px)', maxWidth: 420,
        borderRadius: 24,
        background: 'var(--surface-1)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06)',
        padding: '20px 20px 22px',
        animation: 'bjm-pop-in 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>

        {/* Close button — top-right with breathing room */}
        <button
          className="bjm-close"
          onClick={onDismiss}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X style={{ width: 15, height: 15, color: C.textFaint }} />
        </button>

        {/* Icon + title — centered */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 12px' }}>
            {/* Pulsing rings */}
            {[68, 48].map((size, i) => (
              <div key={size} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: size, height: size, borderRadius: '50%',
                border: `1.5px solid ${C.green}${i === 0 ? '20' : '38'}`,
                transform: 'translate(-50%,-50%)',
                animation: `bjm-ring ${1.8 + i * 0.5}s ease-out ${i * 0.35}s infinite`,
              }} />
            ))}
            {/* Icon circle */}
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: `${C.green}14`, border: `2px solid ${C.green}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 22px ${C.green}28`,
              animation: 'bjm-icon-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.1s both',
            }}>
              <CheckCircle2 style={{ width: 26, height: 26, color: C.green }} />
            </div>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: C.textHi, marginBottom: 4 }}>Job Accepted!</h2>
          <p style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.4 }}>You're assigned to this job</p>
        </div>

        {/* Job summary card */}
        <div style={{
          background: 'var(--surface-2)', borderRadius: 16, padding: '14px 16px', marginBottom: 14,
          border: `1px solid ${C.amber}28`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
              Your Assignment
            </p>
            <p style={{ fontSize: 15, fontWeight: 900, color: C.textHi }}>
              {request.issue_type ?? request.service_type ?? 'Service Request'}
            </p>
          </div>

          {request.description && (
            <>
              <div style={{ height: 1, background: 'var(--border-2)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Wrench style={{ width: 13, height: 13, color: C.amber, flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, whiteSpace: 'pre-wrap', flex: 1 }}>
                  {request.description}
                </p>
              </div>
            </>
          )}

          {locationText && (
            <>
              <div style={{ height: 1, background: 'var(--border-2)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <MapPin style={{ width: 13, height: 13, color: C.amber, flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12, color: C.textHi, lineHeight: 1.4 }}>
                  {locationText}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Collapsible checklist */}
        <button
          onClick={() => setChecklistOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface-2)', border: `1px solid var(--border-2)`,
            borderRadius: checklistOpen ? '12px 12px 0 0' : 12,
            padding: '11px 14px', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Before you begin</span>
          <ChevronDown style={{
            width: 16, height: 16, color: C.textFaint,
            transition: 'transform 0.2s ease',
            transform: checklistOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </button>

        {checklistOpen && (
          <div style={{
            background: 'var(--surface-2)',
            border: `1px solid var(--border-2)`, borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            animation: 'bjm-checklist-open 0.2s ease',
          }}>
            {CHECKLIST.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 14px',
                borderTop: i > 0 ? `1px solid var(--border-1)` : 'none',
              }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                <p style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>{item.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Begin Journey button */}
        <button
          className="bjm-begin"
          onClick={handleBegin}
          disabled={loading}
          style={{
            width: '100%', height: 52, borderRadius: 16, border: 'none',
            background: loading ? `${C.amber}80` : `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
            color: '#000', fontWeight: 900, fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading ? 'none' : `0 4px 20px ${C.amber}44`,
            marginTop: 14,
          }}
        >
          {loading
            ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Updating…</>
            : <><span style={{ fontSize: 18 }}>🚗</span> Begin Journey</>}
        </button>

      </div>
    </>
  )
}
