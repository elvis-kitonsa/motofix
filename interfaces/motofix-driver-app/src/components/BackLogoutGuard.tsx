import { useEffect, useState } from 'react';

/**
 * Traps the browser Back button on the Home screen. Instead of leaving the app
 * (which would land on the splash/login flow), it re-arms history and asks the
 * user whether they want to log out. Staying keeps the session intact.
 */
export default function BackLogoutGuard({ onLogout }: { onLogout: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Push a sentinel entry so the first Back press fires popstate here instead
    // of navigating away.
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      window.history.pushState(null, '', window.location.href); // re-arm for next press
      setShow(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (!show) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 360, borderRadius: 22, background: 'var(--overlay-bg)', border: '1px solid var(--border-2)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', padding: '24px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-hi)', marginBottom: 6 }}>Log out of MOTOFIX?</h2>
        <p style={{ fontSize: 13, color: 'var(--text-lo)', lineHeight: 1.55, marginBottom: 20 }}>You're still signed in. Stay on MOTOFIX, or log out?</p>
        <button onClick={() => setShow(false)} style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#111', fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Stay logged in</button>
        <button onClick={onLogout} style={{ width: '100%', height: 46, borderRadius: 14, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444', fontWeight: 700, fontSize: 14 }}>Log out</button>
      </div>
    </div>
  );
}
