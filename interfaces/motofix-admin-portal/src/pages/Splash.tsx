// Splash.tsx — a brief branded intro animation, then routes the admin onward (to the
// dashboard if logged in, otherwise to login).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, getAdminInfo } from '@/lib/api';

const STEPS = [
  "Verifying admin credentials",
  "Confirming account in database",
  "Loading access permissions",
  "Preparing your workspace",
] as const;

// ms when each step flips to "done"
const TIMINGS = [700, 1400, 2050, 2700];
const FADE_AT = 3050;
const NAV_AT  = 3500;

export default function Splash() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  const admin = getAdminInfo();
  const name  = admin?.full_name ?? 'Admin';

  useEffect(() => {
    if (!isAuthenticated()) { navigate('/login', { replace: true }); return; }

    const ids = TIMINGS.map((ms, i) => setTimeout(() => setChecked(i + 1), ms));
    const fo  = setTimeout(() => setFadeOut(true), FADE_AT);
    const nav = setTimeout(() => navigate('/dashboard', { replace: true }), NAV_AT);
    return () => { [...ids, fo, nav].forEach(clearTimeout); };
  }, [navigate]);

  const progress = (checked / STEPS.length) * 100;
  const allDone  = checked === STEPS.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(135deg, hsl(43 60% 97%) 0%, hsl(38 80% 95%) 50%, hsl(43 60% 97%) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.5s ease',
      zIndex: 9999,
    }}>

      <style>{`
        @keyframes sp-spin      { to { transform: rotate(360deg); } }
        @keyframes sp-check-in  { from { transform: scale(0) rotate(-45deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes sp-step-in   { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes sp-fade-in   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sp-float-sway  { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(7deg)} }
        @keyframes sp-float-drift { 0%{transform:translate(0,0) rotate(0deg)} 33%{transform:translate(16px,-20px) rotate(120deg)} 66%{transform:translate(-12px,-38px) rotate(240deg)} 100%{transform:translate(0,0) rotate(360deg)} }
        @keyframes sp-float-orb   { 0%,100%{transform:translate(0,0) scale(1);opacity:0.18} 50%{transform:translate(10px,-14px) scale(1.1);opacity:0.28} }
      `}</style>

      {/* Subtle grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none' }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="spg" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(120,80,0,0.08)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(spg)" />
        </svg>
      </div>

      {/* Radial vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, hsl(var(--background)) 75%)', pointerEvents: 'none' }} />

      {/* Ambient glow */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'hsl(var(--primary)/0.10)', filter: 'blur(120px)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />

      {/* Floating shapes */}
      <SplashShapes />

      {/* ── Main card ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'hsl(43 60% 98% / 0.9)',
        border: '1.5px solid hsl(38 70% 70%)',
        boxShadow: '0 8px 48px hsl(38 75% 50% / 0.13), 0 2px 10px hsl(38 75% 50% / 0.08)',
        borderRadius: 22,
        padding: '36px 44px 32px',
        width: 'min(420px, 90vw)',
        backdropFilter: 'blur(8px)',
        animation: 'sp-fade-in 0.4s ease both',
      }}>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 13,
            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px hsl(38 75% 52% / 0.38)',
            flexShrink: 0,
          }}>
            <img
              src="/favicon.png" alt="MOTOFIX"
              style={{ width: 36, height: 36, objectFit: 'contain', filter: 'brightness(0)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.02em', color: 'hsl(32 80% 22%)' }}>MOTOFIX</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'hsl(var(--primary))', opacity: 0.75 }}>Admin Control Room</div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'hsl(32 80% 20%)', marginBottom: 4 }}>Initializing your session</div>
          <div style={{ fontSize: 12.5, color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>Welcome back, {name} — just a moment.</div>
        </div>

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 26 }}>
          {STEPS.map((label, i) => {
            const isDone   = i < checked;
            const isActive = i === checked && !allDone;
            const isPending = i > checked;
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13,
                  opacity: isPending ? 0.32 : 1,
                  transition: 'opacity 0.35s ease',
                }}
              >
                {/* Status icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone
                    ? 'hsl(142 65% 42%)'
                    : isActive
                    ? 'hsl(38 90% 52%)'
                    : 'hsl(43 30% 90%)',
                  border: isDone
                    ? '2px solid hsl(142 65% 35%)'
                    : isActive
                    ? '2px solid hsl(32 88% 42%)'
                    : '2px solid hsl(43 25% 80%)',
                  boxShadow: isDone
                    ? '0 2px 10px hsl(142 65% 42% / 0.30)'
                    : isActive
                    ? '0 2px 10px hsl(38 90% 52% / 0.35)'
                    : 'none',
                  transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                }}>
                  {isDone && (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                      style={{ animation: 'sp-check-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                      <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isActive && (
                    <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', animation: 'sp-spin 0.7s linear infinite' }} />
                  )}
                  {isPending && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'hsl(43 25% 65%)' }} />
                  )}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: 13.5,
                  fontWeight: isDone ? 600 : isActive ? 700 : 500,
                  color: isDone
                    ? 'hsl(142 55% 28%)'
                    : isActive
                    ? 'hsl(32 80% 20%)'
                    : 'hsl(var(--muted-foreground))',
                  transition: 'color 0.3s ease',
                  flex: 1,
                }}>
                  {label}
                </span>

                {isDone && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
                    color: 'hsl(142 55% 34%)',
                    animation: 'sp-fade-in 0.3s ease both',
                  }}>
                    Done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, borderRadius: 99, background: 'hsl(43 30% 88%)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: allDone
              ? 'linear-gradient(90deg, hsl(142 65% 42%), hsl(142 65% 58%))'
              : 'linear-gradient(90deg, #d97706, #fbbf24)',
            width: `${progress}%`,
            transition: 'width 0.55s cubic-bezier(0.4,0,0.2,1), background 0.5s ease',
            boxShadow: allDone
              ? '0 0 8px hsl(142 65% 42% / 0.5)'
              : '0 0 8px rgba(251,191,36,0.55)',
          }} />
        </div>
      </div>
    </div>
  );
}

function SplashShapes() {
  type S = { left: string; top: string; size: number; anim: string; dur: string; delay: string; opacity: number; shape: 'hex' | 'diamond' | 'circle' | 'ring' | 'wrench' | 'gear'; color: string };
  const wrenchPath = "M17.27 6.73a4 4 0 0 0-5.54 5.54L3 21l3 3 9.73-8.73a4 4 0 0 0 5.54-5.54l-2.73 2.73-2-2 2.73-2.73z";
  const gearPath   = "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.07-2.14a7 7 0 0 0 .07-1 7 7 0 0 0-.07-.93l2-1.56a.5.5 0 0 0 .12-.63l-1.9-3.28a.5.5 0 0 0-.6-.22l-2.35.95a6.9 6.9 0 0 0-1.6-.93l-.36-2.5A.49.49 0 0 0 14 3h-3.8a.49.49 0 0 0-.49.42l-.36 2.5a6.9 6.9 0 0 0-1.6.93l-2.35-.95a.48.48 0 0 0-.6.22L3 9.4a.47.47 0 0 0 .12.63l2 1.56A7.2 7.2 0 0 0 5 12a7.2 7.2 0 0 0 .07.93l-2 1.56a.5.5 0 0 0-.12.63l1.9 3.28c.12.22.37.3.6.22l2.35-.95c.5.36 1.03.66 1.6.93l.36 2.5c.06.24.27.42.49.42H14c.22 0 .43-.18.49-.42l.36-2.5a6.9 6.9 0 0 0 1.6-.93l2.35.95c.23.08.48 0 .6-.22l1.9-3.28a.47.47 0 0 0-.12-.63l-2.11-1.56z";

  const shapes: S[] = [
    { left:"5%",  top:"12%", size:34, anim:"sp-float-sway",  dur:"8s",  delay:"0s",    opacity:0.38, shape:"hex",     color:"#d97706" },
    { left:"88%", top:"8%",  size:26, anim:"sp-float-drift", dur:"11s", delay:"1.3s",  opacity:0.35, shape:"wrench",  color:"#b45309" },
    { left:"15%", top:"72%", size:28, anim:"sp-float-drift", dur:"12s", delay:"0.7s",  opacity:0.36, shape:"diamond", color:"#f59e0b" },
    { left:"80%", top:"65%", size:30, anim:"sp-float-sway",  dur:"9s",  delay:"2s",    opacity:0.38, shape:"gear",    color:"#d97706" },
    { left:"3%",  top:"45%", size:22, anim:"sp-float-drift", dur:"14s", delay:"0.4s",  opacity:0.32, shape:"ring",    color:"#f59e0b" },
    { left:"92%", top:"42%", size:24, anim:"sp-float-sway",  dur:"10s", delay:"1.8s",  opacity:0.34, shape:"circle",  color:"#d97706" },
    { left:"40%", top:"5%",  size:20, anim:"sp-float-drift", dur:"9s",  delay:"3.1s",  opacity:0.36, shape:"hex",     color:"#f59e0b" },
    { left:"55%", top:"88%", size:26, anim:"sp-float-sway",  dur:"11s", delay:"0.9s",  opacity:0.34, shape:"diamond", color:"#b45309" },
    { left:"72%", top:"22%", size:22, anim:"sp-float-drift", dur:"10s", delay:"2.5s",  opacity:0.40, shape:"wrench",  color:"#d97706" },
    { left:"25%", top:"35%", size:38, anim:"sp-float-orb",   dur:"6s",  delay:"0s",    opacity:0.20, shape:"ring",    color:"#fbbf24" },
    { left:"70%", top:"50%", size:20, anim:"sp-float-sway",  dur:"7s",  delay:"4s",    opacity:0.36, shape:"gear",    color:"#f59e0b" },
    { left:"48%", top:"78%", size:24, anim:"sp-float-drift", dur:"13s", delay:"1.5s",  opacity:0.34, shape:"circle",  color:"#d97706" },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {shapes.map((s, i) => {
        const common: React.CSSProperties = {
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size,
          opacity: s.opacity,
          animation: `${s.anim} ${s.dur} ${s.delay} ease-in-out infinite`,
        };
        if (s.shape === 'circle') return <div key={i} style={{ ...common, borderRadius: '50%', border: `1.5px solid ${s.color}`, background: 'transparent' }} />;
        if (s.shape === 'ring')   return <div key={i} style={{ ...common, borderRadius: '50%', border: `2px solid ${s.color}`, background: 'transparent' }} />;
        if (s.shape === 'diamond') return <div key={i} style={{ ...common, transform: 'rotate(45deg)', border: `1.5px solid ${s.color}`, background: `${s.color}18`, borderRadius: 3 }} />;
        if (s.shape === 'hex')    return <svg key={i} style={{ ...common }} viewBox="0 0 24 24" fill="none"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke={s.color} strokeWidth="1.5" fill={`${s.color}15`} /></svg>;
        if (s.shape === 'wrench') return <svg key={i} style={{ ...common }} viewBox="0 0 24 24" fill="none"><path d={wrenchPath} stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
        if (s.shape === 'gear')   return <svg key={i} style={{ ...common }} viewBox="0 0 24 24" fill="none"><path d={gearPath} stroke={s.color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
        return null;
      })}
    </div>
  );
}
