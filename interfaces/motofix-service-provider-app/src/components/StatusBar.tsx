import { CheckCircle2, Circle } from 'lucide-react'
import { C } from '@/styles/tokens'

// Mirrors the driver app's STATUS_STEPS so both screens show the same detailed
// 7-stage journey — just worded from the mechanic's point of view.
const STEPS = [
  { key: 'pending',               label: 'New Request Received',       desc: 'A driver nearby has requested assistance' },
  { key: 'accepted',              label: 'Job Accepted',               desc: 'You accepted the job — get ready to head out' },
  { key: 'en_route',              label: 'En Route to Driver',         desc: "You're on the way to the driver's location" },
  { key: 'arrived',               label: 'Arrived at Location',        desc: "You've reached the driver — assess the situation" },
  { key: 'service_started',       label: 'Service in Progress',        desc: 'Repair / refuel work is underway' },
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

export default function StatusBar({ status }: { status: string }) {
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
          const serviceIdx = STEPS.findIndex(s => s.key === 'service_started')
          const isCompleted = norm === 'completed'
          // Everything ticks once completed; service auto-checks on arrival
          const done   = isCompleted || i < current || (i === serviceIdx && current >= serviceIdx)
          const active = i === current && !done
          const isLast = i === STEPS.length - 1

          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

              {/* Icon + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                {done ? (
                  <CheckCircle2 style={{ width: 20, height: 20, flexShrink: 0, color: C.green }} />
                ) : active ? (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2.5px solid ${color}`,
                    background: color + '20',
                    animation: 'sb-step-pulse 1.8s ease-in-out infinite',
                  }} />
                ) : (
                  <Circle style={{ width: 20, height: 20, flexShrink: 0, color: 'rgba(255,255,255,0.18)' }} />
                )}
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 24,
                    margin: '4px 0',
                    borderRadius: 1,
                    background: done ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.10)',
                  }} />
                )}
              </div>

              {/* Label + description (description only on the active step) */}
              <div style={{ paddingBottom: isLast ? 0 : 16 }}>
                <p style={{
                  fontSize: 13,
                  fontWeight: active ? 700 : done ? 600 : 500,
                  lineHeight: 1.3,
                  color: (done || active) ? C.textHi : C.textFaint,
                }}>
                  {step.label}
                </p>
                {(active || (i === serviceIdx && current === serviceIdx)) && (
                  <p style={{
                    fontSize: 12, color: C.textFaint,
                    marginTop: 3, lineHeight: 1.5,
                  }}>
                    {step.desc}
                  </p>
                )}
              </div>

            </div>
          )
        })}
      </div>

    </div>
  )
}
