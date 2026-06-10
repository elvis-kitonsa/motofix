import { useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn, ClipboardList, Wrench } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

const AMBER = '#F59E0B'
const TEAL  = '#5EEAD4'

export default function ProviderEntry() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <>
      <style>{`
        @keyframes sp-fade-in { from{opacity:0} to{opacity:1} }
        @keyframes sp-fade-down {
          from{opacity:0;transform:translateY(-14px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes sp-card-in {
          0%  {opacity:0;transform:translateY(28px) scale(0.97)}
          55% {opacity:1;transform:translateY(-5px) scale(1.012)}
          75% {transform:translateY(2px) scale(0.995)}
          100%{transform:translateY(0) scale(1)}
        }
        .sp-card {
          transition:
            transform    0.45s cubic-bezier(0.34,1.56,0.64,1),
            border-color 0.25s ease,
            box-shadow   0.25s ease,
            background   0.25s ease;
        }
        html.dark .sp-card:nth-child(1):hover {
          transform: translateY(-5px) scale(1.015);
          border-color: rgba(245,158,11,0.38) !important;
          background: rgba(245,158,11,0.03) !important;
          box-shadow: 0 0 28px rgba(245,158,11,0.13), 0 8px 24px rgba(0,0,0,0.06) !important;
        }
        html.dark .sp-card:nth-child(2):hover {
          transform: translateY(-5px) scale(1.015);
          border-color: rgba(20,184,166,0.38) !important;
          background: rgba(20,184,166,0.03) !important;
          box-shadow: 0 0 28px rgba(20,184,166,0.12), 0 8px 24px rgba(0,0,0,0.06) !important;
        }
        html.light .sp-card:nth-child(1):hover {
          transform: translateY(-5px) scale(1.015);
          border-color: #000 !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important;
        }
        html.light .sp-card:nth-child(2):hover {
          transform: translateY(-5px) scale(1.015);
          border-color: #000 !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Subtle dot grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: isDark ? 0.03 : 0.06, backgroundImage: `radial-gradient(circle, ${AMBER} 1px, transparent 1px)`, backgroundSize: '28px 28px', pointerEvents: 'none' }} />
        {/* Amber glow */}
        <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', width: 420, height: 320, borderRadius: '50%', background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.08)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        {/* Teal glow */}
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 280, height: 280, borderRadius: '50%', background: isDark ? 'rgba(20,184,166,0.04)' : 'rgba(20,184,166,0.05)', filter: 'blur(70px)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 56, paddingBottom: 28, paddingLeft: 24, paddingRight: 24, textAlign: 'center', animation: 'sp-fade-down 0.4s ease both' }}>

          {/* Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', marginBottom: 18 }}>
            <Wrench style={{ width: 11, height: 11, color: AMBER }} />
            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: AMBER }}>Provider Network</span>
          </div>

          {/* Logo */}
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(245,158,11,0.5)', marginBottom: 24 }}>
            <img
              src="/motofix-logo.png"
              alt="MOTOFIX"
              style={{ width: 32, height: 32, objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>

          <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>
            Your tools are waiting.
          </h1>
          <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.7, maxWidth: 290 }}>
            Sign in to manage your jobs and earnings, or apply to join the MOTOFIX service provider network.
          </p>
        </div>

        {/* Cards */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 14, padding: '0 20px', maxWidth: 480, margin: '0 auto', width: '100%' }}>

          {/* Sign In */}
          <button
            onClick={() => navigate('/login')}
            className="sp-card"
            style={{
              textAlign: 'left', borderRadius: 20, padding: 22, cursor: 'pointer',
              border: isDark ? '1.5px solid rgba(245,158,11,0.25)' : '1.5px solid #000',
              background: 'var(--surface-1)',
              boxShadow: isDark ? '0 4px 20px rgba(245,158,11,0.10), 0 1px 6px rgba(0,0,0,0.08)' : 'var(--card-shadow)',
              animation: 'sp-card-in 0.5s ease both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)' }}>
                <LogIn style={{ width: 20, height: 20, color: AMBER }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-hi)', marginBottom: 4 }}>I already have an account</p>
                <p style={{ fontSize: 13, color: 'var(--text-md)', lineHeight: 1.65 }}>Sign in with your credentials to manage jobs, track earnings, and respond to service requests.</p>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.26)' }}>
                <ArrowRight style={{ width: 13, height: 13, color: AMBER }} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: AMBER }}>Sign In</span>
              <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
            </div>
          </button>

          {/* Apply */}
          <button
            onClick={() => navigate('/apply')}
            className="sp-card"
            style={{
              textAlign: 'left', borderRadius: 20, padding: 22, cursor: 'pointer',
              border: isDark ? '1.5px solid rgba(20,184,166,0.25)' : '1.5px solid #000',
              background: 'var(--surface-1)',
              boxShadow: isDark ? '0 4px 20px rgba(20,184,166,0.10), 0 1px 6px rgba(0,0,0,0.08)' : 'var(--card-shadow)',
              animation: 'sp-card-in 0.5s ease 0.08s both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.22)' }}>
                <ClipboardList style={{ width: 20, height: 20, color: TEAL }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-hi)', marginBottom: 4 }}>I want to join as a provider</p>
                <p style={{ fontSize: 13, color: 'var(--text-md)', lineHeight: 1.65 }}>Apply to become a verified MOTOFIX mechanic or towing operator and get connected to customers near you.</p>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.22)' }}>
                <ArrowRight style={{ width: 13, height: 13, color: TEAL }} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: TEAL }}>Apply Now</span>
              <div style={{ height: 1, flex: 1, background: 'var(--border-1)' }} />
            </div>
          </button>
        </div>

        {/* Footer */}
        <p style={{ position: 'relative', zIndex: 10, marginTop: 28, paddingBottom: 32, textAlign: 'center', fontSize: 12, color: 'var(--text-md)' }}>
          🔒 All provider accounts are verified by MOTOFIX administration.
        </p>

      </div>
    </>
  )
}
