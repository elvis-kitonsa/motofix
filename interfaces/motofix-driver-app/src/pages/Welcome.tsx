// Welcome.tsx — the intro screen after the splash, introducing MOTOFIX before the user
// chooses to continue as a driver (or head to the provider app).

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const BLUE = '#3B82F6';

function DriverSpinner() {
  return (
    <div className="relative" style={{ width: 200, height: 200 }}>
      <div className="absolute inset-0" style={{ animation: 'spin-cw 10s linear infinite' }}>
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="96" stroke={`${BLUE}33`} strokeWidth="1" strokeDasharray="8 6" />
        </svg>
      </div>
      <div className="absolute inset-0" style={{ animation: 'spin-cw 1.8s linear infinite' }}>
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="90"
            stroke={BLUE} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="120 446"
            style={{ filter: `drop-shadow(0 0 6px ${BLUE}99)` }} />
        </svg>
      </div>
      <div className="absolute inset-7" style={{ animation: 'spin-ccw 3s linear infinite' }}>
        <svg width="144" height="144" viewBox="0 0 144 144" fill="none">
          <circle cx="72" cy="72" r="68" stroke={`${BLUE}55`} strokeWidth="1.5" strokeDasharray="5 9" />
        </svg>
      </div>
      <div className="absolute inset-12" style={{ animation: 'spin-cw 1.1s linear infinite' }}>
        <svg width="104" height="104" viewBox="0 0 104 104" fill="none">
          <circle cx="52" cy="52" r="48"
            stroke={`${BLUE}66`} strokeWidth="2" strokeLinecap="round"
            strokeDasharray="48 254" />
        </svg>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute rounded-3xl"
          style={{ width: 100, height: 100, background: `${BLUE}1a`, filter: 'blur(16px)', animation: 'splash-pulse-blue 2s ease-in-out infinite' }} />
        <div className="relative rounded-2xl flex items-center justify-center"
          style={{
            width: 88, height: 88,
            background: '#F59E0B',
            border: `2.5px solid ${BLUE}cc`,
            animation: 'splash-pulse-blue 2s ease-in-out infinite',
          }}>
          <img src="/motofix-logo.png" alt="MOTOFIX"
            style={{ width: 72, height: 72 }} className="object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      </div>
    </div>
  );
}

function splashDisabled(): boolean {
  try { return JSON.parse(localStorage.getItem('motofix_settings') ?? '{}').disableSplash === true; }
  catch { return false; }
}

export default function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    if (splashDisabled()) { navigate('/driver-entry', { replace: true }); return; }
    const t = setTimeout(() => navigate('/driver-entry'), 2200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 px-6"
      style={{ background: 'var(--page-bg)', animation: 'splash-fade-in 0.3s ease both' }}
    >
      <div style={{ textAlign: 'center', animation: 'splash-slide-up 0.4s ease 0.08s both' }}>
        <p style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.2em', marginBottom: 10, color: BLUE,
        }}>
          MOTOFIX
        </p>
        <h1 style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em',
          lineHeight: 1.25, color: 'var(--text-hi)',
        }}>
          Welcome to Driver View
          <br />
          <span style={{ color: BLUE }}>of MOTOFIX</span>
        </h1>
      </div>
      <div style={{ animation: 'splash-slide-up 0.4s ease 0.18s both' }}>
        <DriverSpinner />
      </div>

      <style>{`
        @keyframes splash-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes splash-slide-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-cw  { to { transform: rotate(360deg);  } }
        @keyframes spin-ccw { to { transform: rotate(-360deg); } }
        @keyframes splash-pulse-blue {
          0%,100% { box-shadow: 0 0 0 1px rgba(59,130,246,0.3), 0 0 28px rgba(59,130,246,0.45); }
          50%     { box-shadow: 0 0 0 1px rgba(59,130,246,0.5), 0 0 44px rgba(59,130,246,0.65); }
        }
      `}</style>
    </div>
  );
}
