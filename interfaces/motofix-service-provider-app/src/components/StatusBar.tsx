import { CheckCircle2, Circle, Phone, MessageCircle, Navigation2 } from 'lucide-react'
import { C } from '@/styles/tokens'

// Mirrors the driver app's STATUS_STEPS so both screens show the same detailed
// 7-stage journey — just worded from the mechanic's point of view.
const STEPS = [
  { key: 'pending',               label: 'New Request Received',       desc: 'A driver nearby has requested assistance' },
  { key: 'accepted',              label: 'Job Accepted',               desc: 'You accepted the job — get ready to head out' },
  { key: 'en_route',              label: 'On the Way',                 desc: "You're on the way to the driver's location" },
  { key: 'arrived',               label: 'Arrived at Location',        desc: "You've reached the driver — assess the situation" },
  { key: 'service_started',       label: 'Service in Progress',        desc: 'Service work is underway' },
  { key: 'awaiting_confirmation', label: 'Awaiting Driver Confirmation', desc: 'Driver is confirming the work is complete' },
  { key: 'completed',             label: 'Job Completed',              desc: 'All done — great work!' },
]

const STEP_COLOR: Record<string, string> = {
  pending:               '#F59E0B',
  accepted:              '#3B82F6',
  en_route:              '#F59E0B',
  arrived:               '#8B5CF6',
  service_started:       '#F97316',
  awaiting_confirmation: '#A78BFA',
  completed:             '#22C55E',
}

// The mechanic app uses 'in_progress' locally for 'service_started'
function normalizeStatus(s: string) {
  return s === 'in_progress' ? 'service_started' : s
}

function statusIndex(s: string) {
  const idx = STEPS.findIndex(step => step.key === normalizeStatus(s))
  return idx >= 0 ? idx : 0
}

interface StatusBarActions {
  onCall: () => void
  onChat: () => void
  onNavigate: () => void
  chatUnread?: number
}

// Steps during which the driver can still be contacted / navigated to — the
// compact Call/Chat/Navigate buttons ride alongside the current step on these.
const CONTACTABLE = ['accepted', 'en_route', 'arrived', 'service_started', 'awaiting_confirmation']

export default function StatusBar({ status, actions, serviceDesc }: { status: string; actions?: StatusBarActions; serviceDesc?: string }) {
  const norm = normalizeStatus(status)
  const current = statusIndex(status)
  const color = STEP_COLOR[norm] ?? C.amber
  const currentStep = STEPS[current]

  return (
    <div style={{ marginBottom: 18 }}>
      <style>{`@keyframes sb-step-pulse{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}`}</style>

      {/* Header: label + active status pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: C.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>
          Job Progress
        </span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: color + '18',
          border: `1.5px solid ${color}45`,
          borderRadius: 20,
          padding: '4px 12px 4px 8px',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }} />
          <span style={{ fontSize: 12, fontWeight: 800, color }}>
            {currentStep?.label ?? status}
          </span>
        </div>
      </div>

      {/* Vertical timeline */}
      <div>
        {STEPS.map((step, i) => {
          const isCompleted = norm === 'completed'
          // A step's milestone is "reached" (ticked) the moment the status arrives
          // AT it — so the step matching the current status ticks immediately, in
          // sync with the option just triggered, instead of lagging one behind. The
          // current step gets a distinct coloured, pulsing check ("you are here").
          const reached   = isCompleted || i <= current
          const isCurrent = !isCompleted && i === current
          const isLast = i === STEPS.length - 1

          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

              {/* Icon + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                {reached ? (
                  <div style={{ position: 'relative', width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isCurrent && (
                      <span style={{
                        position: 'absolute', inset: -4, borderRadius: '50%',
                        border: `2px solid ${color}`,
                        animation: 'sb-step-pulse 1.8s ease-in-out infinite',
                      }} />
                    )}
                    <CheckCircle2 style={{ width: 20, height: 20, flexShrink: 0, color: isCurrent ? color : C.green }} />
                  </div>
                ) : (
                  <Circle style={{ width: 20, height: 20, flexShrink: 0, color: 'rgba(255,255,255,0.18)' }} />
                )}
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 24,
                    margin: '4px 0',
                    borderRadius: 1,
                    // Green only between two reached steps; the segment leaving the
                    // current step stays dim until the next milestone is hit.
                    background: (isCompleted || i < current) ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.10)',
                  }} />
                )}
              </div>

              {/* Label + description (description only on the current step) */}
              <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13,
                  fontWeight: isCurrent ? 800 : reached ? 600 : 500,
                  lineHeight: 1.3,
                  color: isCurrent ? color : reached ? C.textHi : C.textFaint,
                }}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p style={{
                    fontSize: 12, color: C.textFaint,
                    marginTop: 3, lineHeight: 1.5,
                  }}>
                    {/* The in-progress step shows what's actually being worked on. */}
                    {step.key === 'service_started' && serviceDesc ? serviceDesc : step.desc}
                  </p>
                )}
              </div>

              {/* Contact / navigate actions — ride alongside the current step */}
              {isCurrent && actions && CONTACTABLE.includes(step.key) && (
                <div style={{ display: 'flex', gap: 7, flexShrink: 0, marginLeft: 8 }}>
                  <SbActionBtn color={C.amber} onClick={actions.onCall} ariaLabel="Call driver">
                    <Phone style={{ width: 16, height: 16 }} />
                  </SbActionBtn>
                  <SbActionBtn color={C.blue} onClick={actions.onChat} ariaLabel="Chat with driver" badge={actions.chatUnread}>
                    <MessageCircle style={{ width: 16, height: 16 }} />
                  </SbActionBtn>
                  <SbActionBtn color={C.green} onClick={actions.onNavigate} ariaLabel="Navigate to driver">
                    <Navigation2 style={{ width: 16, height: 16 }} />
                  </SbActionBtn>
                </div>
              )}

            </div>
          )
        })}
      </div>

    </div>
  )
}

// Compact, coloured icon button used beside the active step.
function SbActionBtn({
  color, onClick, ariaLabel, badge = 0, children,
}: {
  color: string
  onClick: () => void
  ariaLabel: string
  badge?: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        position: 'relative', width: 36, height: 36, borderRadius: 11,
        border: `1.5px solid ${color}55`, background: color + '14', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9,
          background: '#EF4444', color: '#fff', fontSize: 9.5, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--surface-2, #14182a)',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}
