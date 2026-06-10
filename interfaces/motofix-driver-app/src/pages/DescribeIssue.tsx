import { useState, useLayoutEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, MapPin, Send, Sparkles } from 'lucide-react'
import { requestsService } from '@/config/api'
import { useAuth } from '@/hooks/useAuth'

/* ── Palette ─────────────────────────────────────────────────────────────── */
const SOS   = '#ff2d2d'
const SOSD  = '#cc1515'
const AMBER = '#F59E0B'
const AMBRD = '#D97706'

/* ── Issue lookup maps ───────────────────────────────────────────────────── */
const ISSUE_LABELS: Record<string, string> = {
  flat_tire: 'Flat Tyre',
  engine:    'Engine Fault',
  battery:   'Dead Battery',
  fuel:      'Out of Fuel',
  towing:    'Need Towing',
  other:     'Other Issue',
}

const ISSUE_DEFAULTS: Record<string, string> = {
  flat_tire: 'Flat tyre – needs roadside assistance',
  engine:    'Engine issue – needs mechanic',
  battery:   'Battery problem – needs jump start or replacement',
  fuel:      'Out of fuel – needs fuel delivery',
  towing:    'Vehicle needs towing',
  other:     'Needs roadside assistance',
}

/* ── Route state ─────────────────────────────────────────────────────────── */
interface RouteState {
  issueType?:   string
  serviceType?: string
  aiSummary?:   string
  aiDiagnosis?: { severity?: string; fault_category?: string } | null
  lat?:         number
  lng?:         number
  accuracy?:    number
  address?:     string
}

/* ── Dispatch overlay phases ─────────────────────────────────────────────── */
type DispatchPhase = 'idle' | 'searching' | 'found' | 'dispatched'

const DISPATCH_MSGS: Record<Exclude<DispatchPhase, 'idle'>, { title: string; sub: string }> = {
  searching:  { title: 'Searching Nearby',   sub: 'Finding available service providers in your area…' },
  found:      { title: 'Providers Found!',   sub: 'Alerting mechanics near your location…' },
  dispatched: { title: 'Request Dispatched!', sub: 'A provider will confirm shortly. Stand by.' },
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Dispatch animation overlay                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
function DispatchOverlay({ phase, issueType }: { phase: Exclude<DispatchPhase, 'idle'>; issueType?: string }) {
  const isDispatched = phase === 'dispatched'
  const msg = DISPATCH_MSGS[phase]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.90)',
      backdropFilter: 'blur(24px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 28, padding: 32,
      animation: 'di-fade-in 0.4s ease both',
    }}>

      {/* Radar / checkmark graphic */}
      <div style={{ position: 'relative', width: 130, height: 130 }}>

        {!isDispatched ? (
          <>
            {/* Expanding rings */}
            {[130, 96, 62].map((size, i) => (
              <div key={size} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: size, height: size, borderRadius: '50%',
                border: `1.5px solid ${AMBER}${['20', '38', '60'][i]}`,
                transform: 'translate(-50%,-50%)',
                animation: `di-ring ${2 + i * 0.45}s ease-out ${i * 0.4}s infinite`,
              }} />
            ))}

            {/* Rotating sweep line */}
            <div style={{ position: 'absolute', inset: 0, animation: 'di-spin 2s linear infinite' }}>
              <svg width="130" height="130" viewBox="0 0 130 130" fill="none">
                <defs>
                  <linearGradient id="radarG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER} stopOpacity="0" />
                    <stop offset="100%" stopColor={AMBER} stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                {/* Sweep wedge */}
                <path
                  d={`M65 65 L65 8 A57 57 0 0 1 ${65 + 57 * Math.sin(Math.PI / 6)} ${65 - 57 * Math.cos(Math.PI / 6)} Z`}
                  fill={`${AMBER}18`}
                />
                <line x1="65" y1="65" x2="65" y2="8" stroke={`url(#radarG)`} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Centre dot */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 22, height: 22, borderRadius: '50%',
              background: AMBER,
              boxShadow: `0 0 0 4px ${AMBER}40, 0 0 20px ${AMBER}cc`,
              animation: 'di-pulse 1.4s ease-in-out infinite',
            }} />
          </>
        ) : (
          /* Checkmark when dispatched */
          <svg width="130" height="130" viewBox="0 0 130 130" fill="none">
            <circle cx="65" cy="65" r="58" stroke={`${AMBER}25`} strokeWidth="2" />
            <circle cx="65" cy="65" r="58"
              stroke={AMBER} strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="364" strokeDashoffset="364"
              transform="rotate(-90 65 65)"
              style={{ animation: 'di-draw-circle 0.7s cubic-bezier(0.4,0,0.2,1) forwards', filter: `drop-shadow(0 0 10px ${AMBER})` }} />
            <path d="M40 65 L56 81 L90 47"
              stroke={AMBER} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="80" strokeDashoffset="80"
              style={{ animation: 'di-draw-check 0.5s ease 0.65s forwards', filter: `drop-shadow(0 0 8px ${AMBER})` }} />
          </svg>
        )}
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center', animation: 'di-slide-up 0.4s ease both' }}>
        <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 24, marginBottom: 10, letterSpacing: '-0.02em' }}>
          {msg.title}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>
          {msg.sub}
        </p>
      </div>

      {/* Progress pills */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {(['searching', 'found', 'dispatched'] as const).map((p, i) => {
          const phaseOrder = ['searching', 'found', 'dispatched']
          const done = phaseOrder.indexOf(phase) >= i
          return (
            <div key={p} style={{
              width: done ? 28 : 8, height: 8, borderRadius: 4,
              background: done ? AMBER : 'rgba(255,255,255,0.18)',
              transition: 'all 0.35s ease',
            }} />
          )
        })}
      </div>

      {/* Monospace tag */}
      <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
        {issueType ? `ISSUE: ${ISSUE_LABELS[issueType]?.toUpperCase() ?? 'OTHER'}` : 'REQUEST PROCESSING'}
      </p>

      <style>{`
        @keyframes di-fade-in       { from { opacity: 0; } to { opacity: 1; } }
        @keyframes di-slide-up      { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes di-spin          { to   { transform: rotate(360deg); } }
        @keyframes di-pulse         { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.2); } }
        @keyframes di-ring          { 0% { transform: translate(-50%,-50%) scale(0.7); opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; } }
        @keyframes di-draw-circle   { to { stroke-dashoffset: 0; } }
        @keyframes di-draw-check    { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main page                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
function getComp(components: any[], type: string): string | null {
  return components.find((c: any) => c.types.includes(type))?.long_name ?? null
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`
    )
    const d = await r.json()
    if (d.status !== 'OK' || !d.results?.length) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`

    // Filter out any result that embeds phone numbers in its address text
    const results: any[] = d.results.filter((r: any) => !/\d{8,}/.test(r.formatted_address ?? ''))
    if (!results.length) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`

    // Build a short "Area, City" label from address components
    let route = null, sub2 = null, neighborhood = null, sub1 = null, locality = null
    for (const result of results) {
      const c = result.address_components
      route        = route        || getComp(c, 'route')
      sub2         = sub2         || getComp(c, 'sublocality_level_2')
      neighborhood = neighborhood || getComp(c, 'neighborhood')
      sub1         = sub1         || getComp(c, 'sublocality_level_1')
      locality     = locality     || getComp(c, 'locality')
    }
    const area = sub2 || neighborhood || sub1
    // Strip trailing numeric road codes Google assigns in Uganda (e.g. "Kabowa 14782" → "Kabowa")
    const cleanRoute = route ? route.replace(/\s+\d+$/, '').trim() : null
    if (cleanRoute && area)     return `${cleanRoute}, ${area}`
    if (cleanRoute && locality) return `${cleanRoute}, ${locality}`
    if (area && locality)  return `${area}, ${locality}`
    return area || locality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

export default function DescribeIssue() {
  const navigate    = useNavigate()
  const routeState  = useLocation().state as RouteState | null
  const { user }    = useAuth()

  const issueType  = routeState?.issueType
  const aiSummary  = routeState?.aiSummary
  const lat        = routeState?.lat
  const lng        = routeState?.lng
  const accuracy   = routeState?.accuracy   // metres; undefined = fallback / unknown
  const isApprox   = accuracy == null || accuracy > 500

  const [description,    setDescription]    = useState('')
  const [dispatchPhase,  setDispatchPhase]  = useState<DispatchPhase>('idle')
  const [submitError,    setSubmitError]    = useState('')
  const [displayAddress, setDisplayAddress] = useState<string | null>(null)

  useLayoutEffect(() => {
    document.body.style.background = 'var(--page-bg)'
    return () => { document.body.style.background = '' }
  }, [])

  // Geocode actual GPS coords on mount — ignore any address string from route state
  useLayoutEffect(() => {
    if (lat == null || lng == null) return
    setDisplayAddress('Locating…')
    reverseGeocode(lat, lng).then(setDisplayAddress)
  }, [lat, lng])

  const handleSubmit = async (customDesc?: string) => {
    if (dispatchPhase !== 'idle') return
    setSubmitError('')
    setDispatchPhase('searching')

    /* Staggered dispatch messages */
    const t1 = setTimeout(() => setDispatchPhase('found'),      2000)
    const t2 = setTimeout(() => setDispatchPhase('dispatched'), 3600)

    try {
      const notes = (customDesc ?? description).trim()
      const finalDescription = aiSummary
        ? aiSummary + (notes ? `\n\nAdditional notes from driver: ${notes}` : '')
        : (notes || ISSUE_DEFAULTS[issueType ?? ''] || 'Needs roadside assistance')
      const res = await requestsService.create({
        customer_name: user?.full_name || 'Driver',
        service_type:  ISSUE_LABELS[issueType ?? ''] ?? 'Other',
        location:      lat != null && lng != null ? `${lat},${lng}` : '0,0',
        description:   finalDescription,
      })
      const newId = String(res.data?.id ?? '')
      setTimeout(() => {
        clearTimeout(t1); clearTimeout(t2)
        navigate(newId ? `/requests/${newId}` : '/requests', { replace: true })
      }, 4800)
    } catch {
      clearTimeout(t1); clearTimeout(t2)
      setDispatchPhase('idle')
      setSubmitError('Failed to submit. Please try again.')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      background: 'var(--page-bg)', overflow: 'hidden',
    }}>

      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 340, height: 340, borderRadius: '50%', background: `${SOS}08`, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -50, right: -40, width: 280, height: 280, borderRadius: '50%', background: `${AMBER}0a`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      {/* ── Header ── */}
      <div style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-3)', border: '1px solid var(--border-3)', cursor: 'pointer' }}
        >
          <ArrowLeft style={{ width: 17, height: 17, color: 'var(--text-md)' }} />
        </button>
        <span style={{ color: AMBER, fontSize: 13, fontWeight: 900, letterSpacing: '0.12em', textShadow: `0 0 20px ${AMBER}55` }}>
          MOTOFIX
        </span>
        <div style={{ width: 38 }} />
      </div>

      {/* ── SOS status banner ── */}
      <div style={{
        marginLeft: 14, marginRight: 14, marginBottom: 14,
        borderRadius: 14,
        background: `linear-gradient(135deg, ${SOS}18 0%, rgba(10,10,18,0.85) 100%)`,
        border: `1.5px solid ${SOS}40`,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        flexShrink: 0, position: 'relative', zIndex: 1,
        boxShadow: `0 0 28px ${SOS}14`,
      }}>
        <div style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: SOS, opacity: 0.35, animation: 'sos-ring 1.4s ease-out infinite' }} />
          <div style={{ position: 'absolute', inset: '3px', borderRadius: '50%', background: SOS, boxShadow: `0 0 8px ${SOS}` }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: SOS, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 3 }}>
            Emergency Dispatch Active
          </p>
          <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
            {ISSUE_LABELS[issueType ?? ''] ?? 'Service Request'}
          </p>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px', position: 'relative', zIndex: 1 }}>

        {/* Location confirmed — always shown when we have GPS coords */}
        {lat != null && lng != null && (
          <div style={{
            borderRadius: 14, padding: '13px 16px',
            background: `${AMBER}0e`, border: `1.5px solid ${AMBER}33`,
            marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 12,
            animation: 'card-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${AMBER}20`, border: `1px solid ${AMBER}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <MapPin style={{ width: 16, height: 16, color: AMBER }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <p style={{ color: AMBER, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  Your Location
                </p>
                {isApprox && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: AMBER, background: `${AMBER}18`, border: `1px solid ${AMBER}40`, borderRadius: 6, padding: '1px 6px', letterSpacing: '0.06em' }}>
                    APPROXIMATE
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>
                {displayAddress ?? 'Getting location…'}
              </p>
              {accuracy != null && accuracy <= 500 && (
                <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3 }}>
                  Accurate to ~{Math.round(accuracy)} m
                </p>
              )}
            </div>
          </div>
        )}

        {/* AI diagnosis summary — shown when arriving from the guided AI flow */}
        {aiSummary && (
          <div style={{
            borderRadius: 18, padding: '16px 18px',
            background: `${AMBER}0c`, border: `1.5px solid ${AMBER}40`,
            marginBottom: 14,
            animation: 'card-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.06s both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(135deg, ${AMBER}, ${AMBRD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles style={{ width: 14, height: 14, color: '#000' }} />
              </div>
              <p style={{ color: AMBER, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                AI Diagnosis Summary
              </p>
            </div>
            <p style={{ color: 'var(--text-hi)', fontSize: 12.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {aiSummary}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
              This summary is sent to your mechanic so they understand the problem before they arrive.
            </p>
          </div>
        )}

        {/* Describe issue card */}
        <div style={{
          borderRadius: 20, padding: '20px',
          background: 'var(--surface-2)', border: '1.5px solid var(--border-2)',
          marginBottom: 14,
          animation: 'card-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.08s both',
        }}>
          <h2 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 20, marginBottom: 6 }}>
            {aiSummary ? 'Anything to add?' : 'Tell us more'}
          </h2>
          <p style={{ color: 'var(--text-lo)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
            {aiSummary
              ? <>The AI summary above is already attached. Add anything else the mechanic should know, or just tap <strong style={{ color: 'var(--text-md)' }}>Submit</strong>.</>
              : <>Help our providers understand your situation. This is optional — you can also just tap <strong style={{ color: 'var(--text-md)' }}>I Don't Know</strong>.</>}
          </p>

          <div style={{ position: 'relative' }}>
            <textarea
              value={description}
              onChange={e => { if (e.target.value.length <= 300) setDescription(e.target.value) }}
              placeholder="e.g. My car stalled after hitting a pothole and won't start…"
              rows={5}
              disabled={dispatchPhase !== 'idle'}
              style={{
                width: '100%', borderRadius: 14, padding: '14px 16px 28px',
                background: 'var(--input-bg)', border: '1.5px solid var(--border-3)',
                color: 'var(--text-hi)', fontSize: 14, lineHeight: 1.55,
                outline: 'none', resize: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box', transition: 'border-color 0.2s ease',
              }}
              onFocus={e  => { e.currentTarget.style.borderColor = `${AMBER}70` }}
              onBlur={e   => { e.currentTarget.style.borderColor = 'var(--border-3)' }}
            />
            <span style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 10, color: 'var(--text-faint)' }}>
              {description.length}/300
            </span>
          </div>

          {submitError && (
            <p style={{ color: SOS, fontSize: 12, marginTop: 10, fontWeight: 600 }}>{submitError}</p>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
          <button
            onClick={() => handleSubmit()}
            disabled={dispatchPhase !== 'idle'}
            style={{
              width: '100%', height: 56, borderRadius: 16, border: 'none',
              background: `linear-gradient(135deg, ${AMBER}, ${AMBRD})`,
              cursor: dispatchPhase !== 'idle' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 0 0 3px ${AMBER}22, 0 8px 28px ${AMBER}35`,
              opacity: dispatchPhase !== 'idle' ? 0.6 : 1,
              animation: 'card-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.16s both',
            }}
          >
            <Send style={{ width: 18, height: 18, color: '#000' }} />
            <span style={{ color: '#000', fontWeight: 800, fontSize: 15 }}>Submit Request</span>
          </button>

          <button
            onClick={() => handleSubmit('')}
            disabled={dispatchPhase !== 'idle'}
            style={{
              width: '100%', height: 50, borderRadius: 14,
              background: 'var(--surface-3)', border: '1.5px solid var(--border-3)',
              cursor: dispatchPhase !== 'idle' ? 'not-allowed' : 'pointer',
              color: 'var(--text-md)', fontWeight: 700, fontSize: 14,
              opacity: dispatchPhase !== 'idle' ? 0.5 : 1,
              animation: 'card-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.24s both',
            }}
          >
            {aiSummary ? 'Send AI summary as is' : "I Don't Know — Submit Anyway"}
          </button>
        </div>
      </div>

      {/* ── Dispatch overlay ── */}
      {dispatchPhase !== 'idle' && (
        <DispatchOverlay phase={dispatchPhase as Exclude<DispatchPhase, 'idle'>} issueType={issueType} />
      )}

      <style>{`
        @keyframes sos-ring {
          0%   { transform: scale(1);   opacity: 0.35; }
          70%  { transform: scale(2.6); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes card-pop {
          0%   { opacity: 0; transform: translateY(14px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(-2px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  )
}
