// Splash.tsx — the first screen on app open: a short branded animation (the `Phase`
// states below step through the logo reveal), then it sends the user onward (to the
// welcome/login flow, or straight in if already signed in).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

type Phase = 'idle' | 'ring' | 'scan' | 'logo' | 'text' | 'ready' | 'caption' | 'exit';

const AMBER = '#F59E0B';

const CHARS = 'MOTOFIX'.split('');

/* Ring is 260 px; all measurements derive from this */
const R        = 130;   // SVG half-size / centre coordinate
const R_OUTER  = 124;   // faint static ring
const R_DRAW   = 111;   // animated drawing ring  (circumference ≈ 697.4)
const R_ACCENT =  92;   // inner dashed ring
const CIRC     = 2 * Math.PI * R_DRAW; // 697.4

function splashDisabled(): boolean {
  try { return JSON.parse(localStorage.getItem('motofix_settings') ?? '{}').disableSplash === true; }
  catch { return false; }
}

export default function Splash() {
  const [phase, setPhase] = useState<Phase>('idle');
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const badgeBg = isDark ? '#C47F09' : 'transparent';

  useEffect(() => {
    // Already signed in (and not expired by the 15-min inactivity guard that runs in
    // main.tsx before render) → go straight Home and skip the splash, so the browser
    // Back button never strands a logged-in user on the splash/login flow.
    if (localStorage.getItem('motofix_token')) {
      navigate('/requests', { replace: true });
      return;
    }
    if (splashDisabled()) {
      navigate('/driver-entry', { replace: true });
      return;
    }
    const schedule: [number, () => void][] = [
      [100,  () => setPhase('ring')],
      [900,  () => setPhase('scan')],
      [1400, () => setPhase('logo')],
      [2100, () => setPhase('text')],
      [3100, () => setPhase('ready')],
      [3900, () => setPhase('caption')],
      [6000, () => setPhase('exit')],
      [6650, () => navigate('/welcome', { replace: true })],
    ];
    const timers = schedule.map(([ms, fn]) => setTimeout(fn, ms));
    return () => timers.forEach(clearTimeout);
  }, [navigate]);

  const show = (from: Phase) => {
    const order: Phase[] = ['idle','ring','scan','logo','text','ready','caption','exit'];
    return order.indexOf(phase) >= order.indexOf(from);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'var(--page-bg)',
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.65s ease',
      }}
    >
      <GridBackground />

      {/* ── Corner brackets (screen corners) ── */}
      {(['tl','tr','bl','br'] as const).map((pos, i) => (
        <CornerBracket key={pos} pos={pos} visible={show('text')} delay={i * 80} />
      ))}

      {/* ── Scan line ── */}
      {show('scan') && (
        <div
          className="absolute left-0 right-0 h-px pointer-events-none z-10"
          style={{
            background: 'linear-gradient(90deg,transparent,hsl(var(--primary)/0.8),transparent)',
            animation: 'scan-line 1.2s ease forwards',
            boxShadow: '0 0 12px hsl(var(--primary)/0.6)',
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════
          Main content — single column, everything fits
      ════════════════════════════════════════════════════ */}
      <div className="relative z-20 flex flex-col items-center" style={{ gap: 10 }}>

        {/* ── Ring + logo (together in one relative box) ── */}
        <div className="relative shrink-0" style={{ width: R*2, height: R*2 }}>

          {/* SVG HUD ring */}
          <svg viewBox={`0 0 ${R*2} ${R*2}`} fill="none" className="absolute inset-0 w-full h-full">
            {/* Faint static outer ring */}
            <circle cx={R} cy={R} r={R_OUTER} stroke="hsl(var(--primary)/0.20)" strokeWidth="1" />

            {/* Tick marks */}
            {show('ring') && Array.from({ length: 32 }).map((_, i) => {
              const angle = (i / 32) * 360;
              const rad   = (angle * Math.PI) / 180;
              const r2    = i % 4 === 0 ? R_OUTER - 9 : R_OUTER - 5;
              return (
                <line key={i}
                  x1={R + R_OUTER * Math.cos(rad)} y1={R + R_OUTER * Math.sin(rad)}
                  x2={R + r2      * Math.cos(rad)} y2={R + r2      * Math.sin(rad)}
                  stroke={`hsl(var(--primary)/${i % 4 === 0 ? '0.65' : '0.30'})`}
                  strokeWidth={i % 4 === 0 ? 1.5 : 0.8}
                  style={{ opacity: 0, animation: `tick-in 0.1s ease ${i * 18}ms forwards` }}
                />
              );
            })}

            {/* Animated drawing ring */}
            {show('ring') && (
              <circle cx={R} cy={R} r={R_DRAW}
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC}
                transform={`rotate(-90 ${R} ${R})`}
                style={{
                  animation: 'draw-ring 1.2s cubic-bezier(0.4,0,0.2,1) forwards',
                  filter: 'drop-shadow(0 0 6px hsl(var(--primary)/0.7))',
                }}
              />
            )}

            {/* Inner dashed accent ring */}
            {show('logo') && (
              <circle cx={R} cy={R} r={R_ACCENT}
                stroke="hsl(var(--primary)/0.35)"
                strokeWidth="1"
                strokeDasharray="5 7"
                style={{ animation: 'fade-in 0.4s ease forwards' }}
              />
            )}
          </svg>

          {/* Logo badge — dead-centre of ring, always dark so logo is always visible */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: show('logo') ? 1 : 0,
              transform: show('logo') ? 'scale(1)' : 'scale(0.3)',
              transition: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            }}
          >
            {/* Outer glow halo */}
            <div className="absolute rounded-3xl"
              style={{
                width: 148, height: 148,
                background: 'hsl(var(--primary)/0.18)',
                filter: 'blur(24px)',
                animation: show('logo') ? 'pulse-halo 2.4s ease-in-out infinite' : undefined,
              }} />
            <div
              className="relative rounded-3xl flex items-center justify-center"
              style={{
                width: 132, height: 132,
                background: badgeBg,
                border: '2.5px solid hsl(var(--primary)/0.9)',
                boxShadow: show('logo')
                  ? '0 0 0 1px hsl(var(--primary)/0.2), 0 0 32px hsl(var(--primary)/0.65), 0 0 70px hsl(var(--primary)/0.25), inset 0 1px 0 hsl(var(--primary)/0.15)'
                  : 'none',
                animation: show('logo') ? 'flicker 0.6s ease forwards' : undefined,
              }}
            >
              <img src="/motofix-logo.png" alt="MOTOFIX"
                className="object-contain"
                style={{ width: 116, height: 116 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          </div>

          {/* Arc status labels — anchored to ring top / bottom */}
          {show('text') && (
            <>
              <div
                className="absolute left-0 right-0 flex justify-center items-center gap-1.5"
                style={{ top: -22, animation: 'fade-in 0.4s ease 0.3s both' }}
              >
                <div className="h-px w-5 bg-primary/50" />
                <span
                  className="text-[8px] font-mono text-primary/70 uppercase"
                  style={{ letterSpacing: '0.32em', paddingLeft: '0.32em' }}
                >Rescue Network</span>
                <div className="h-px w-5 bg-primary/50" />
              </div>
              <div
                className="absolute left-0 right-0 flex justify-center items-center gap-1.5"
                style={{ bottom: -22, animation: 'fade-in 0.4s ease 0.45s both' }}
              >
                <div className="h-px w-5 bg-primary/50" />
                <span
                  className="text-[8px] font-mono text-primary/70 uppercase"
                  style={{ letterSpacing: '0.32em', paddingLeft: '0.32em' }}
                >GPS Active</span>
                <div className="h-px w-5 bg-primary/50" />
              </div>
            </>
          )}
        </div>

        {/* ── Wordmark ── */}
        <div className="flex items-end gap-0.5 overflow-hidden" style={{ height: 44, marginTop: 18 }}>
          {CHARS.map((char, i) => (
            <span
              key={i}
              className="text-4xl font-black tracking-[0.15em] text-foreground inline-block"
              style={{
                transform: show('text') ? 'translateY(0)' : 'translateY(48px)',
                opacity:   show('text') ? 1 : 0,
                transition: `transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 55}ms,
                             opacity   0.25s ease ${i * 55}ms`,
              }}
            >
              {char}
            </span>
          ))}
        </div>

        {/* Sub-label */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            opacity:   show('text') ? 1 : 0,
            transform: show('text') ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s',
          }}
        >
          <div style={{ height: 1, width: 32, background: `${AMBER}99` }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.4em', textTransform: 'uppercase', color: AMBER }}>Roadside Rescue</span>
          <div style={{ height: 1, width: 32, background: `${AMBER}99` }} />
        </div>

        {/* SYSTEM READY badge */}
        <div
          style={{
            opacity:   show('ready') ? 1 : 0,
            transform: show('ready') ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            marginTop: 4,
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full"
            style={{
              border: '1.5px solid hsl(var(--primary)/0.45)',
              background: 'hsl(var(--primary)/0.12)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animation: 'pulse-dot 1s ease-in-out infinite' }} />
            <span className="text-xs font-mono font-bold tracking-widest text-primary">SYSTEM READY</span>
          </div>
        </div>

        {/* Caption */}
        <div
          style={{
            opacity:   show('caption') ? 1 : 0,
            transform: show('caption') ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
            marginTop: 6,
          }}
        >
          <p className="text-center leading-snug" style={{ fontSize: 13 }}>
            <span className="text-muted-foreground">Every driver. Every road.</span>{' '}
            <span className="font-bold text-primary" style={{ letterSpacing: '0.04em' }}>
              Every time.
            </span>
          </p>
        </div>

      </div>{/* end main content column */}

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes draw-ring {
          to { stroke-dashoffset: 0; }
        }
        @keyframes tick-in {
          to { opacity: 1; }
        }
        @keyframes scan-line {
          0%   { top: 15%; opacity: 0; }
          10%  { opacity: 1; }
          100% { top: 85%; opacity: 0; }
        }
        @keyframes flicker {
          0%,19%,21%,23%,25%,54%,56%,100% { opacity: 1; }
          20%,22%,24%,55%                  { opacity: 0.35; }
        }
        @keyframes fade-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes pulse-dot {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.4; transform: scale(0.6); }
        }
        @keyframes pulse-halo {
          0%,100% { opacity: 0.6; transform: scale(1);    }
          50%     { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes bracket-tl {
          from { transform: translate(-12px,-12px); opacity: 0; }
          to   { transform: translate(0,0);         opacity: 1; }
        }
        @keyframes bracket-tr {
          from { transform: translate(12px,-12px); opacity: 0; }
          to   { transform: translate(0,0);        opacity: 1; }
        }
        @keyframes bracket-bl {
          from { transform: translate(-12px,12px); opacity: 0; }
          to   { transform: translate(0,0);        opacity: 1; }
        }
        @keyframes bracket-br {
          from { transform: translate(12px,12px); opacity: 0; }
          to   { transform: translate(0,0);       opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ── Grid background ─────────────────────────────────────────── */
function GridBackground() {
  return (
    <>
      {/* Grid lines */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ opacity: 0.4 }}
      >
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none"
                stroke="hsl(var(--primary)/0.18)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      {/* Vignette — CSS-based so it adapts to the current theme bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, var(--page-bg) 75%)',
        }}
      />
    </>
  );
}

/* ── Corner bracket ──────────────────────────────────────────── */
function CornerBracket({ pos, visible, delay }: {
  pos: 'tl' | 'tr' | 'bl' | 'br';
  visible: boolean;
  delay: number;
}) {
  const size   = 20;
  const stroke = 'hsl(var(--primary)/0.75)';
  const paths: Record<typeof pos, string> = {
    tl: `M ${size} 0 L 0 0 L 0 ${size}`,
    tr: `M 0 0 L ${size} 0 L ${size} ${size}`,
    bl: `M 0 0 L 0 ${size} L ${size} ${size}`,
    br: `M 0 ${size} L ${size} ${size} L ${size} 0`,
  };
  const positions: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 28, left: 28 },
    tr: { top: 28, right: 28 },
    bl: { bottom: 28, left: 28 },
    br: { bottom: 28, right: 28 },
  };
  return (
    <div
      className="absolute z-30"
      style={{
        ...positions[pos],
        opacity: visible ? 1 : 0,
        animation: visible ? `bracket-${pos} 0.4s ease ${delay}ms both` : undefined,
      }}
    >
      <svg width={size} height={size} fill="none">
        <path d={paths[pos]} stroke={stroke} strokeWidth="2" strokeLinecap="square" />
      </svg>
    </div>
  );
}
