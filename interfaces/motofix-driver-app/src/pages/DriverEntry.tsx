// DriverEntry.tsx — the "you're entering as a driver" gateway screen where the user
// chooses to log in or sign up before reaching the driver app proper.

import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Sparkles, ShieldCheck } from "lucide-react";

const B = '#3B82F6';

export default function DriverEntry() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      {/* ── Ambient glow ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-500/8 blur-3xl" />
      </div>

      {/* ── Back button ── */}
      <button onClick={() => navigate("/welcome")} className="relative z-10 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mt-6 ml-5 w-fit" style={{ animation: "fade-in 0.4s ease both" }}>
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </button>

      {/* ── Header ── */}
      <div className="relative z-10 flex flex-col items-center pt-10 pb-10 px-6 text-center" style={{ animation: "fade-down 0.5s ease 0.1s both" }}>

        {/* Driver network badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: `${B}14`, border: `1px solid ${B}38`, marginBottom: 18 }}>
          <ShieldCheck style={{ width: 11, height: 11, color: B }} />
          <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: B }}>Driver Network</span>
        </div>

        {/* Small logo */}
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-6" style={{ boxShadow: "0 0 24px hsl(var(--primary)/0.4)" }}>
          <img
            src="/motofix-logo.png"
            alt="MOTOFIX"
            className="w-8 h-8 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        <h1 className="text-2xl font-black text-foreground leading-tight">Have we met before?</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xs leading-relaxed">We'll get you moving in seconds — whether it's your first time or you're picking up where you left off.</p>
      </div>

      {/* ── Option cards ── */}
      <div className="relative z-10 flex flex-col gap-4 px-5 max-w-lg mx-auto w-full">
        {/* Returning user */}
        <button
          onClick={() => navigate("/login")}
          className="entry-card text-left rounded-2xl p-6 cursor-pointer group"
          style={{
            border: "1.5px solid var(--border-2)",
            background: "var(--surface-1)",
            boxShadow: "var(--card-shadow)",
            animation: "card-in 0.6s ease 0.2s both",
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
              <RotateCcw className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-base text-foreground group-hover:text-black-400 transition-colors">Yes, I've been here before</p>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">Log in with your phone number. We'll send a quick verification code — no password needed.</p>
            </div>
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 group-hover:scale-110" style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)" }}>
              <span className="text-blue-400 text-xs font-bold">→</span>
            </div>
          </div>

          {/* Bottom tag */}
          <div className="mt-4 flex items-center gap-2">
            <div style={{ height: 1, flex: 1, background: "var(--border-2)" }} />
            <span className="text-[13px] font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--accent-blue)' }}>Log in</span>
            <div style={{ height: 1, flex: 1, background: "var(--border-2)" }} />
          </div>
        </button>

        {/* New user */}
        <button
          onClick={() => navigate("/signup")}
          className="entry-card text-left rounded-2xl p-6 cursor-pointer group"
          style={{
            border: "1.5px solid var(--border-2)",
            background: "var(--surface-1)",
            boxShadow: "var(--card-shadow)",
            animation: "card-in 0.6s ease 0.32s both",
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <Sparkles className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-base text-foreground group-hover:text-green-400 transition-colors">No, this is my first time</p>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">Create your MOTOFIX account in under a minute. All you need is your name and phone number.</p>
            </div>
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 group-hover:scale-110" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)" }}>
              <span className="text-green-400 text-xs font-bold">→</span>
            </div>
          </div>

          {/* Bottom tag */}
          <div className="mt-4 flex items-center gap-2">
            <div style={{ height: 1, flex: 1, background: "var(--border-2)" }} />
            <span className="text-[13px] font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--accent-green)' }}>Sign up</span>
            <div style={{ height: 1, flex: 1, background: "var(--border-2)" }} />
          </div>
        </button>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes fade-down {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes card-in {
          0%   { opacity: 0; transform: translateY(32px) scale(0.97); }
          55%  { opacity: 1; transform: translateY(-6px) scale(1.015); }
          75%  { transform: translateY(3px) scale(0.99); }
          100% { transform: translateY(0) scale(1); }
        }
        .entry-card {
          transition:
            transform    0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
            border-color 0.3s ease,
            box-shadow   0.3s ease,
            background   0.3s ease;
        }
        .entry-card:hover {
          transform: translateY(-6px) scale(1.02);
        }
        .entry-card:nth-child(1):hover {
          border-color: rgba(59,130,246,0.35);
          background: rgba(59,130,246,0.06);
          box-shadow: 0 0 28px rgba(59,130,246,0.12), 0 8px 24px rgba(0,0,0,0.14);
        }
        .entry-card:nth-child(2):hover {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.05);
          box-shadow: 0 0 28px rgba(34,197,94,0.12), 0 8px 24px rgba(0,0,0,0.14);
        }
      `}</style>
    </div>
  );
}
