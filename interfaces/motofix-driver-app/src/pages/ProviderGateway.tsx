import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, LogIn, ClipboardList, Wrench } from 'lucide-react'

const PROVIDER_URL = import.meta.env.VITE_PROVIDER_URL ||
  `${window.location.protocol}//${window.location.hostname}:8084`

const BG       = '#F7F5F1'
const SURFACE  = '#FFFFFF'
const BORDER   = 'rgba(0,0,0,0.08)'
const BORDER_S = 'rgba(0,0,0,0.11)'
const TEXT     = '#1C1917'
const MUTED    = '#78716C'
const FAINT    = '#A8A29E'
const AMBER    = '#D97706'
const TEAL     = '#0D9488'

export default function ProviderGateway() {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = BG
    return () => { document.body.style.background = prev }
  }, [])

  return (
    <>
      <style>{`
        @keyframes pg-fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes pg-fade-down {
          from{opacity:0;transform:translateY(-14px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes pg-card-in {
          0%  {opacity:0;transform:translateY(28px) scale(0.97)}
          55% {opacity:1;transform:translateY(-5px) scale(1.012)}
          75% {transform:translateY(2px) scale(0.995)}
          100%{transform:translateY(0) scale(1)}
        }
        .pg-card {
          transition:
            transform    0.45s cubic-bezier(0.34,1.56,0.64,1),
            border-color 0.25s ease,
            box-shadow   0.25s ease,
            background   0.25s ease;
        }
        .pg-card:nth-child(1):hover {
          transform: translateY(-5px) scale(1.015);
          border-color: rgba(245,158,11,0.38) !important;
          background: rgba(245,158,11,0.03) !important;
          box-shadow: 0 0 28px rgba(245,158,11,0.13), 0 8px 24px rgba(0,0,0,0.06) !important;
        }
        .pg-card:nth-child(2):hover {
          transform: translateY(-5px) scale(1.015);
          border-color: rgba(20,184,166,0.38) !important;
          background: rgba(20,184,166,0.03) !important;
          box-shadow: 0 0 28px rgba(20,184,166,0.12), 0 8px 24px rgba(0,0,0,0.06) !important;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Dot grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: `radial-gradient(circle, ${AMBER} 1px, transparent 1px)`, backgroundSize: '28px 28px', pointerEvents: 'none' }} />
        {/* Amber glow */}
        <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', width: 420, height: 320, borderRadius: '50%', background: 'rgba(245,158,11,0.06)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        {/* Teal glow */}
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(20,184,166,0.04)', filter: 'blur(70px)', pointerEvents: 'none' }} />

        {/* Back */}
        <button
          onClick={() => navigate('/welcome')}
          style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, color: MUTED, marginTop: 24, marginLeft: 20, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, animation: 'pg-fade-in 0.3s ease both' }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} /> Back
        </button>

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 28, paddingLeft: 24, paddingRight: 24, textAlign: 'center', animation: 'pg-fade-down 0.4s ease both' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', marginBottom: 18 }}>
            <Wrench style={{ width: 11, height: 11, color: AMBER }} />
            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: AMBER }}>Provider Network</span>
          </div>

          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(245,158,11,0.5)', marginBottom: 24 }}>
            <img src="/motofix-logo.png" alt="MOTOFIX" style={{ width: 32, height: 32, objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>

          <h1 style={{ color: TEXT, fontWeight: 900, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>
            Your tools are waiting.
          </h1>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 290 }}>
            Sign in to manage your jobs and earnings, or apply to join the MOTOFIX service provider network.
          </p>
        </div>

        {/* Cards */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 14, padding: '0 20px', maxWidth: 480, margin: '0 auto', width: '100%' }}>

          {/* Sign In */}
          <button
            onClick={() => { window.location.href = PROVIDER_URL + '/login' }}
            className="pg-card"
            style={{ textAlign: 'left', borderRadius: 20, padding: 22, cursor: 'pointer', border: '1.5px solid rgba(245,158,11,0.25)', background: SURFACE, boxShadow: '0 4px 20px rgba(245,158,11,0.10), 0 1px 6px rgba(0,0,0,0.08)', animation: 'pg-card-in 0.5s ease both' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)' }}>
                <LogIn style={{ width: 20, height: 20, color: AMBER }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 4 }}>I already have an account</p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>Sign in with your credentials to manage jobs, track earnings, and respond to service requests.</p>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)' }}>
                <ArrowRight style={{ width: 13, height: 13, color: AMBER }} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 1, flex: 1, background: BORDER }} />
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: AMBER }}>Sign In</span>
              <div style={{ height: 1, flex: 1, background: BORDER }} />
            </div>
          </button>

          {/* Apply */}
          <button
            onClick={() => { window.location.href = PROVIDER_URL + '/apply' }}
            className="pg-card"
            style={{ textAlign: 'left', borderRadius: 20, padding: 22, cursor: 'pointer', border: '1.5px solid rgba(20,184,166,0.25)', background: SURFACE, boxShadow: '0 4px 20px rgba(20,184,166,0.10), 0 1px 6px rgba(0,0,0,0.08)', animation: 'pg-card-in 0.5s ease 0.08s both' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.22)' }}>
                <ClipboardList style={{ width: 20, height: 20, color: TEAL }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 4 }}>I want to join as a provider</p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>Apply to become a verified MOTOFIX mechanic or towing operator and get connected to customers near you.</p>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.22)' }}>
                <ArrowRight style={{ width: 13, height: 13, color: TEAL }} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 1, flex: 1, background: BORDER }} />
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: TEAL }}>Apply Now</span>
              <div style={{ height: 1, flex: 1, background: BORDER }} />
            </div>
          </button>
        </div>

        <p style={{ position: 'relative', zIndex: 10, marginTop: 28, paddingBottom: 32, textAlign: 'center', fontSize: 12, color: MUTED }}>
          🔒 All provider accounts are verified by MOTOFIX administration.
        </p>

      </div>
    </>
  )
}
