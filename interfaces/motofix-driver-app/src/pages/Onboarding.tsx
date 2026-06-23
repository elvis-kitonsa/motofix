// Onboarding.tsx — first-time profile setup for a new driver, including the optional
// driving-licence photo upload that gets AI-checked for authenticity. Exports
// PROFILE_COMPLETE_KEY, which other screens read to know onboarding is finished.

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, Camera, Upload, X, ArrowRight, Loader2,
  ShieldAlert, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/config/api';
import { toast } from 'sonner';

export const PROFILE_COMPLETE_KEY = 'motofix_profile_complete';
export const REQUEST_COUNT_KEY    = 'motofix_req_count';

/** Returns true when the driver must complete their profile before a new request. */
export function isProfileRequired(): boolean {
  const complete = localStorage.getItem(PROFILE_COMPLETE_KEY) === 'true';
  const count    = parseInt(localStorage.getItem(REQUEST_COUNT_KEY) ?? '0', 10);
  return !complete && count >= 3;
}

// ── Photo upload tile ────────────────────────────────────────────────────────

interface PhotoTileProps {
  label: string;
  sub?: string;
  value: File | null;
  onChange: (f: File | null) => void;
}

function PhotoTile({ label, sub, value, onChange }: PhotoTileProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setPreview(null); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div
      onClick={() => !value && ref.current?.click()}
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 select-none"
      style={{
        minHeight: 110,
        border: `1.5px dashed ${value ? 'rgba(34,197,94,0.6)' : 'var(--border-3)'}`,
        background: value ? 'rgba(34,197,94,0.06)' : 'var(--surface-2)',
      }}
    >
      {preview ? (
        <>
          <img src={preview} alt={label}
            className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 flex items-end justify-between p-2">
            <span className="text-[10px] font-semibold text-green-300 bg-black/50 rounded px-1.5 py-0.5 backdrop-blur-sm">
              {label}
            </span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null); }}
              className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <ShieldCheck className="w-6 h-6 text-green-400 relative z-10" />
        </>
      ) : (
        <>
          <Camera className="w-6 h-6 text-muted-foreground/50" />
          <div className="text-center px-2">
            <p className="text-xs font-semibold text-foreground/70">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>}
          </div>
          <Upload className="w-3.5 h-3.5 text-muted-foreground/30" />
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const required   = params.get('required') === 'true';

  const [nationalId, setNationalId] = useState('');
  const [idFront,    setIdFront]    = useState<File | null>(null);
  const [idBack,     setIdBack]     = useState<File | null>(null);
  const [licence,    setLicence]    = useState<File | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);

  const canSubmit = nationalId.trim().length >= 6;

  const goToLogin = () => {
    // Pass the registered phone so Login can lock the input to that number
    try {
      const stored = localStorage.getItem('motofix_user');
      const user   = stored ? JSON.parse(stored) : null;
      navigate('/login', { replace: true, state: { lockedPhone: user?.phone ?? null } });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  const handleSkip = () => goToLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) { toast.error('Enter your National ID number'); return; }

    setIsLoading(true);
    try {
      await authService.updateProfile({ national_id_number: nationalId.trim() });
      localStorage.setItem(PROFILE_COMPLETE_KEY, 'true');
      toast.success('Profile saved — thanks for verifying!');
      goToLogin();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not save profile. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2
                        w-96 h-96 rounded-full bg-green-500/6 blur-3xl" />
      </div>

      {/* ── Header bar ── */}
      <div
        className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2"
        style={{ animation: 'fade-in 0.3s ease both' }}
      >
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center"
          style={{ boxShadow: '0 0 18px hsl(var(--primary)/0.35)' }}>
          <img src="/motofix-logo.png" alt="MOTOFIX" className="w-6 h-6 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>

        {!required && (
          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip to login for now
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Title ── */}
      <div
        className="relative z-10 px-5 pt-5 pb-4"
        style={{ animation: 'fade-down 0.4s ease 0.05s both' }}
      >
        <h1 className="text-2xl font-black text-foreground">Verify Your Identity</h1>
        <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
          Help us keep the platform safe. This takes under a minute.
        </p>
      </div>

      {/* ── Required warning ── */}
      {required && (
        <div
          className="relative z-10 mx-5 mb-2 rounded-xl px-4 py-3 flex items-start gap-3"
          style={{
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.3)',
            animation: 'fade-up 0.35s ease both',
          }}
        >
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300/90 leading-relaxed">
            You've used your 3 free requests. Complete your profile to keep using MOTOFIX.
          </p>
        </div>
      )}

      {/* ── Form ── */}
      <div
        className="relative z-10 flex-1 px-5 pb-10 max-w-md mx-auto w-full"
        style={{ animation: 'fade-up 0.35s ease 0.1s both' }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* National ID number */}
          <div>
            <label className="text-xs font-semibold text-green-400 uppercase tracking-widest block mb-2">
              National ID Number
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
              <Input
                placeholder="e.g. CM93100012345ABCD"
                value={nationalId}
                onChange={e => setNationalId(e.target.value)}
                className="pl-10 h-12 focus-visible:ring-green-500/50 focus-visible:border-green-400 text-foreground bg-[var(--input-bg)] border-[var(--border-3)] font-mono tracking-wider"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground/50 mt-1 pl-1">
              Found on your Ugandan National ID card.
            </p>
          </div>

          {/* Photo uploads */}
          <div>
            <label className="text-xs font-semibold text-green-400 uppercase tracking-widest block mb-3">
              ID &amp; Licence Photos
              <span className="ml-2 text-[10px] text-muted-foreground/50 normal-case tracking-normal font-normal">
                optional but recommended
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <PhotoTile label="ID — Front" sub="Take photo"       value={idFront}  onChange={setIdFront} />
              <PhotoTile label="ID — Back"  sub="Take photo"       value={idBack}   onChange={setIdBack}  />
              <PhotoTile label="Licence"    sub="Driver's licence" value={licence}  onChange={setLicence} />
            </div>
            <p className="text-[11px] text-muted-foreground/50 mt-2">
              Clear photos help us verify faster. Your data is encrypted and private.
            </p>
          </div>

          {/* Why we ask */}
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}
          >
            <ShieldAlert className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Identity verification protects both drivers and mechanics. It discourages false calls and helps us resolve disputes fairly.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-green-600 hover:bg-green-500 text-white font-semibold border-0"
            disabled={isLoading || !canSubmit}
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <>Save &amp; Continue <ArrowRight className="w-4 h-4" /></>}
          </Button>

          {!required && (
            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors text-center py-1"
            >
              Skip to login for now
            </button>
          )}
        </form>
      </div>

      <style>{`
        @keyframes fade-in   { from { opacity: 0; }                               to { opacity: 1; } }
        @keyframes fade-down { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-up   { from { opacity: 0; transform: translateY(14px); }  to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
