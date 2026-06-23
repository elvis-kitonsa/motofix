// BackLogoutGuard.tsx — traps the browser Back button so an admin doesn't accidentally
// leave the portal; instead it asks whether they want to log out. Staying keeps the session.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthToken } from '@/lib/api';

/**
 * Traps the browser Back button on the dashboard so an admin isn't bounced to the
 * login screen. Re-arms history and asks whether to log out; staying keeps the session.
 */
export default function BackLogoutGuard() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      window.history.pushState(null, '', window.location.href);
      setShow(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (!show) return null;

  const logout = () => { clearAuthToken(); navigate('/login', { replace: true }); };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <h2 className="text-lg font-extrabold text-foreground mb-1.5">Log out of MOTOFIX?</h2>
        <p className="text-sm text-muted-foreground mb-5">You're still signed in. Stay on the portal, or log out?</p>
        <button onClick={() => setShow(false)} className="w-full h-12 rounded-xl font-bold text-sm mb-2.5" style={{ background: 'var(--adm-amber)', color: 'var(--adm-invert-text)', border: '1.5px solid rgba(0,0,0,0.5)' }}>
          Stay logged in
        </button>
        <button onClick={logout} className="w-full h-11 rounded-xl font-semibold text-sm" style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#dc2626' }}>
          Log out
        </button>
      </div>
    </div>
  );
}
