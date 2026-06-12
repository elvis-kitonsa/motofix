import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, ChevronRight, Phone, MessageCircle,
  Calendar, MapPin, FileText, Camera, CheckCircle2,
  Car, Flame, Droplets, Wind, Scissors, EyeOff,
  HelpCircle, X, AlertTriangle, Clock, Plus,
  ChevronLeft, Loader2, Copy, Check, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { insuranceService, ClaimRecord, ApplicationRecord, Insurer, CoverType } from '@/config/api';
import { toast } from 'sonner';

/* ── Palette ── */
const G  = '#34D399';
const GD = '#059669';

/* ── Claim types ── */
const CLAIM_TYPES = [
  { id: 'accident',   label: 'Accident',        desc: 'Collision or crash',          icon: Car,        color: '#f87171', bg: 'rgba(248,113,113,0.1)'  },
  { id: 'theft',      label: 'Theft',            desc: 'Vehicle stolen/broken into',  icon: EyeOff,     color: '#a78bfa', bg: 'rgba(167,139,250,0.1)'  },
  { id: 'fire',       label: 'Fire Damage',      desc: 'Fire or explosion',           icon: Flame,      color: '#f97316', bg: 'rgba(249,115,22,0.1)'   },
  { id: 'flood',      label: 'Flood / Weather',  desc: 'Water or storm damage',       icon: Droplets,   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'   },
  { id: 'vandalism',  label: 'Vandalism',        desc: 'Deliberate damage',           icon: Scissors,   color: '#fcd34d', bg: 'rgba(252,211,77,0.1)'   },
  { id: 'windscreen', label: 'Windscreen',       desc: 'Cracked or shattered glass',  icon: Wind,       color: G,         bg: 'rgba(52,211,153,0.1)'   },
  { id: 'other',      label: 'Other',            desc: 'Something else',              icon: HelpCircle, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
];

/* ── Photo label slots ── */
const PHOTO_SLOTS = [
  'Front view',
  'Rear view',
  'Left side',
  'Right side',
  'Damage close-up',
  'Scene / surroundings',
];

/* ── Fallback catalog (mirrors the backend) so the Apply page is never empty ── */
const FALLBACK_INSURERS: Insurer[] = [
  { id: 'uap',       name: 'UAP Old Mutual Insurance',         short: 'UAP Old Mutual',    tagline: "One of Uganda's largest general insurers." },
  { id: 'jubilee',   name: 'Jubilee Allianz General Insurance',short: 'Jubilee Allianz',   tagline: 'Backed by global insurer Allianz.' },
  { id: 'sanlam',    name: 'Sanlam General Insurance Uganda',  short: 'Sanlam',            tagline: 'Pan-African insurer with strong motor cover.' },
  { id: 'britam',    name: 'Britam Insurance Uganda',          short: 'Britam',            tagline: 'Wide branch network and quick claims.' },
  { id: 'icea',      name: 'ICEA Lion General Insurance',      short: 'ICEA Lion',         tagline: 'Trusted East-African insurer.' },
  { id: 'goldstar',  name: 'Goldstar Insurance',               short: 'Goldstar',          tagline: 'Known for affordable motor cover.' },
  { id: 'cic',       name: 'CIC Africa Insurance (Uganda)',    short: 'CIC Africa',        tagline: 'Co-operative insurer with flexible plans.' },
  { id: 'nic',       name: 'NIC General Insurance',            short: 'NIC',               tagline: 'Long-established Ugandan insurer.' },
  { id: 'liberty',   name: 'Liberty General Insurance Uganda', short: 'Liberty',           tagline: 'Part of the Liberty group.' },
  { id: 'apa',       name: 'APA Insurance (Uganda)',           short: 'APA',               tagline: 'Regional insurer with quick turnaround.' },
  { id: 'statewide', name: 'Statewide Insurance Company',      short: 'Statewide (SWICO)', tagline: "One of Uganda's oldest insurers." },
];
const FALLBACK_COVERS: CoverType[] = [
  { id: 'third_party',            label: 'Third-Party Only',          blurb: 'The legal minimum. Covers injury or damage you cause to other people and their property.' },
  { id: 'third_party_fire_theft', label: 'Third-Party, Fire & Theft', blurb: 'Adds cover if your vehicle is stolen or damaged by fire.' },
  { id: 'comprehensive',          label: 'Comprehensive',             blurb: 'Full cover — including accidental damage to your own vehicle.' },
];

type Step = 'overview' | 'apply' | 'apply_done' | 'type' | 'details' | 'evidence' | 'review' | 'done';

const APP_STATUS: Record<string, { color: string; label: string }> = {
  pending:      { color: '#fcd34d', label: 'Pending' },
  under_review: { color: '#60a5fa', label: 'Under review' },
  active:       { color: '#34D399', label: 'Active' },
  rejected:     { color: '#f87171', label: 'Rejected' },
  expired:      { color: '#94a3b8', label: 'Expired' },
  cancelled:    { color: '#94a3b8', label: 'Cancelled' },
};

interface ClaimDraft {
  type: string;
  typeLabel: string;
  typeColor: string;
  date: string;
  time: string;
  location: string;
  description: string;
  injuries: boolean | null;
  thirdParty: boolean | null;
  photos: { slot: string; preview: string }[];
}

const emptyDraft = (): ClaimDraft => ({
  type: '', typeLabel: '', typeColor: G,
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
  location: '', description: '',
  injuries: null, thirdParty: null,
  photos: [],
});

/* ── Step indicator ── */
function StepBar({ current }: { current: number }) {
  const steps = ['Incident', 'Details', 'Evidence', 'Review'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 18px 18px' }}>
      {steps.map((label, i) => {
        const idx   = i + 1;
        const done  = idx < current;
        const active = idx === current;
        return (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* Connector line */}
            {i > 0 && (
              <div style={{
                position: 'absolute', top: 11, right: '50%', left: '-50%', height: 2,
                background: done || active ? G : 'var(--surface-4)',
                transition: 'background 0.3s',
              }} />
            )}
            {/* Circle */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%', zIndex: 1,
              background: done ? G : active ? `${G}22` : 'var(--surface-3)',
              border: `2px solid ${done || active ? G : 'var(--border-3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
            }}>
              {done
                ? <Check style={{ width: 11, height: 11, color: '#000' }} />
                : <span style={{ color: active ? G : 'var(--text-faint)', fontSize: 9.5, fontWeight: 800 }}>{idx}</span>
              }
            </div>
            <span style={{ color: active ? G : done ? 'var(--text-dim)' : 'var(--text-ghost)', fontSize: 9, fontWeight: active ? 700 : 500, marginTop: 4 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Yes/No toggle ── */
function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ color: 'var(--text-lo)', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {[true, false].map(opt => (
          <button key={String(opt)} onClick={() => onChange(opt)} style={{
            flex: 1, height: 42, borderRadius: 12, border: `1.5px solid ${value === opt ? G : 'var(--border-2)'}`,
            background: value === opt ? `${G}18` : 'var(--surface-2)',
            color: value === opt ? G : 'var(--text-dim)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s',
          }}>
            {opt ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Text input ── */
function Field({ label, value, onChange, placeholder, type = 'text', rows }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; rows?: number;
}) {
  const baseStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)',
    border: `1px solid ${value ? `${G}40` : 'var(--border-2)'}`,
    borderRadius: 12, color: 'var(--text-hi)', fontSize: 13, padding: '11px 14px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ color: 'var(--text-lo)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</p>
      {rows
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
            style={{ ...baseStyle, resize: 'none', lineHeight: 1.55 }} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={baseStyle} />
      }
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Main page
════════════════════════════════════════════════════════════ */
export default function InsurancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step,    setStep]    = useState<Step>('overview');
  const [draft,   setDraft]   = useState<ClaimDraft>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);
  const [refNum,  setRefNum]  = useState('');
  const [copied,  setCopied]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState(0);

  /* ── Claims history ── */
  const [claims,       setClaims]       = useState<ClaimRecord[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  /* ── Insurance applications / policy ── */
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [insurers,     setInsurers]     = useState<Insurer[]>(FALLBACK_INSURERS);
  const [coverTypes,   setCoverTypes]   = useState<CoverType[]>(FALLBACK_COVERS);
  const policy = applications[0] ?? null; // newest application = the driver's current cover

  /* ── Apply-for-cover form ── */
  const [aInsurer, setAInsurer] = useState<Insurer | null>(null);
  const [aCover,   setACover]   = useState<CoverType | null>(null);
  const [aVeh,     setAVeh]     = useState({ reg: '', make: '', model: '', year: '', period: '1 year' });
  const [applying, setApplying] = useState(false);
  const [appRef,   setAppRef]   = useState('');

  const patch = (update: Partial<ClaimDraft>) => setDraft(d => ({ ...d, ...update }));

  /* ── Load claims, applications & insurer catalog on mount ── */
  useEffect(() => {
    fetchClaims();
    fetchApplications();
    insuranceService.insurers()
      .then(r => {
        if (r.data?.insurers?.length) setInsurers(r.data.insurers);
        if (r.data?.cover_types?.length) setCoverTypes(r.data.cover_types);
      })
      .catch(() => { /* keep fallback catalog */ });
  }, []);

  const fetchClaims = async () => {
    setClaimsLoading(true);
    try {
      const res = await insuranceService.list();
      setClaims(res.data);
    } catch {
      // silently fail — user may not have any claims yet
    } finally {
      setClaimsLoading(false);
    }
  };

  const fetchApplications = async () => {
    try { const r = await insuranceService.applications(); setApplications(r.data); }
    catch { /* none yet */ }
  };

  /* ── Submit an insurance application ── */
  const submitApplication = async () => {
    if (!aInsurer || !aCover || !aVeh.reg.trim()) return;
    setApplying(true);
    try {
      const res = await insuranceService.apply({
        insurer_id:   aInsurer.id,
        insurer_name: aInsurer.name,
        cover_type:   aCover.id,
        cover_label:  aCover.label,
        vehicle_reg:  aVeh.reg.trim(),
        vehicle_make: aVeh.make.trim(),
        vehicle_model: aVeh.model.trim(),
        vehicle_year: aVeh.year.trim(),
        period:       aVeh.period,
      });
      setAppRef(res.data.reference);
      setStep('apply_done');
      fetchApplications();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Application failed. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  /* ── Handle photo selection ── */
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const slotLabel = PHOTO_SLOTS[activeSlot];
      const exists = draft.photos.findIndex(p => p.slot === slotLabel);
      if (exists >= 0) {
        const updated = [...draft.photos];
        updated[exists] = { slot: slotLabel, preview: reader.result as string };
        patch({ photos: updated });
      } else {
        patch({ photos: [...draft.photos, { slot: slotLabel, preview: reader.result as string }] });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Submit claim to backend ── */
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await insuranceService.submit({
        type:           draft.type,
        type_label:     draft.typeLabel,
        incident_date:  draft.date,
        incident_time:  draft.time,
        location:       draft.location,
        description:    draft.description,
        injuries:       draft.injuries,
        third_party:    draft.thirdParty,
        insurer_id:     policy?.insurer_id ?? null,
        insurer_name:   policy?.insurer_name ?? null,
        photos:         draft.photos,
      });
      setRefNum(res.data.reference);
      setStep('done');
      fetchClaims(); // refresh history
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Submission failed. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Copy reference ── */
  const handleCopy = () => {
    navigator.clipboard.writeText(refNum).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Back logic ── */
  const handleBack = () => {
    if (step === 'overview') navigate(-1);
    else if (step === 'apply')      setStep('overview');
    else if (step === 'apply_done') { setStep('overview'); setAInsurer(null); setACover(null); setAVeh({ reg: '', make: '', model: '', year: '', period: '1 year' }); }
    else if (step === 'type')     setStep('overview');
    else if (step === 'details')  setStep('type');
    else if (step === 'evidence') setStep('details');
    else if (step === 'review')   setStep('evidence');
    else if (step === 'done')     { setStep('overview'); setDraft(emptyDraft()); }
  };

  /* ── Step numbers ── */
  const stepNum: Record<Step, number> = { overview: 0, apply: 0, apply_done: 0, type: 1, details: 2, evidence: 3, review: 4, done: 5 };

  const selectedType = CLAIM_TYPES.find(t => t.id === draft.type);

  /* ════════════════════════════════════════════════════════════
     SHARED SHELL
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--page-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: -80, left: -60, width: 300, height: 300, borderRadius: '50%', background: `${G}08`, filter: 'blur(80px)', pointerEvents: 'none' }} />

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'max(env(safe-area-inset-top,0px),14px)',
        paddingBottom: 12, paddingLeft: 14, paddingRight: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--overlay-bg)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-1)',
        position: 'relative', zIndex: 2,
      }}>
        <button onClick={handleBack} style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-3)', border: '1px solid var(--border-3)', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft style={{ width: 17, height: 17, color: 'var(--text-md)' }} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
            {step === 'overview' ? 'Insurance'
              : step === 'apply' ? 'Apply for Insurance'
              : step === 'apply_done' ? 'Application Sent'
              : step === 'done' ? 'Claim Submitted'
              : 'File a Claim'}
          </p>
          {['type', 'details', 'evidence', 'review'].includes(step) && (
            <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>
              Step {stepNum[step]} of 4
            </p>
          )}
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* ── Step bar (wizard only) ── */}
      {['type','details','evidence','review'].includes(step) && (
        <div style={{ flexShrink: 0, paddingTop: 16, background: 'var(--overlay-bg)', position: 'relative', zIndex: 2 }}>
          <StepBar current={stepNum[step]} />
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 1 }}>

        {/* ════════════════════
            OVERVIEW
        ════════════════════ */}
        {step === 'overview' && (
          <div style={{ padding: '20px 18px 32px' }}>

            {/* Coverage card — real policy/application, or an Apply CTA */}
            {policy ? (
              <div style={{
                borderRadius: 20, marginBottom: 14,
                background: `linear-gradient(135deg, ${G}18 0%, var(--overlay-bg) 100%)`,
                border: `1.5px solid ${G}35`,
                padding: '18px 18px 16px',
                boxShadow: `0 0 32px ${G}10`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <p style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4 }}>Your Cover</p>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 17 }}>{policy.cover_label}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2 }}>{policy.insurer_name}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: `${(APP_STATUS[policy.status]?.color ?? G)}18`, border: `1px solid ${(APP_STATUS[policy.status]?.color ?? G)}35` }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: APP_STATUS[policy.status]?.color ?? G, animation: 'ins-blink 2s ease-in-out infinite' }} />
                    <span style={{ color: APP_STATUS[policy.status]?.color ?? G, fontSize: 11, fontWeight: 700 }}>{APP_STATUS[policy.status]?.label ?? policy.status}</span>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--surface-4)', marginBottom: 12 }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Reference', val: policy.reference },
                    { label: 'Vehicle',   val: policy.vehicle_reg || '—' },
                    { label: 'Period',    val: policy.period },
                    { label: 'Applied',   val: new Date(policy.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>{label}</p>
                      <p style={{ color: 'var(--text-md)', fontSize: 12, fontWeight: 700 }}>{val}</p>
                    </div>
                  ))}
                </div>
                {policy.status === 'pending' && (
                  <p style={{ color: 'var(--text-faint)', fontSize: 10.5, marginTop: 12, lineHeight: 1.5 }}>
                    Application received — {policy.insurer_name} will contact you to finalise cover and arrange your premium.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ borderRadius: 20, marginBottom: 14, background: 'var(--surface-1)', border: '1px solid var(--border-2)', padding: '20px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${G}14`, border: `1px solid ${G}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield style={{ width: 19, height: 19, color: G }} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 15 }}>No cover yet</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>Apply for motor insurance through MOTOFIX</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>
                  Choose from insurers used across Kampala (third-party or comprehensive). MOTOFIX files your application and the insurer follows up to set it up.
                </p>
                <button onClick={() => setStep('apply')} style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${G}, ${GD})`, color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Shield style={{ width: 18, height: 18 }} /> Apply for Insurance
                </button>
              </div>
            )}

            {/* Apply for (another) cover — when a policy already exists */}
            {policy && (
              <button onClick={() => setStep('apply')} style={{ width: '100%', height: 46, borderRadius: 14, border: `1.5px solid ${G}40`, background: `${G}10`, color: G, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                <Plus style={{ width: 17, height: 17 }} /> Apply for another policy
              </button>
            )}

            {/* File a Claim CTA */}
            <button
              onClick={() => setStep('type')}
              style={{
                width: '100%', height: 58, borderRadius: 16, border: 'none',
                background: `linear-gradient(135deg, ${G}, ${GD})`,
                color: '#000', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: `0 0 0 3px ${G}22, 0 8px 28px ${G}33`,
                marginBottom: 14,
              }}
            >
              <FileText style={{ width: 20, height: 20 }} />
              File a New Claim
            </button>

            {/* ── Claims History ── */}
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border-2)', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px 10px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em' }}>My Claims</p>
                <button onClick={fetchClaims} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <RefreshCw style={{ width: 13, height: 13, color: 'var(--text-dim)', animation: claimsLoading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>

              {claimsLoading ? (
                <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 style={{ width: 16, height: 16, color: 'var(--text-faint)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading claims…</span>
                </div>
              ) : claims.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>No claims filed yet</p>
                </div>
              ) : (
                claims.map((claim, i) => {
                  const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
                    pending:      { color: '#fcd34d', bg: 'rgba(252,211,77,0.12)',  label: 'Pending'      },
                    under_review: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Under Review' },
                    approved:     { color: G,         bg: `${G}18`,                 label: 'Approved'     },
                    rejected:     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Rejected'     },
                    settled:      { color: G,         bg: `${G}18`,                 label: 'Settled'      },
                  };
                  const ss = STATUS_STYLES[claim.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: claim.status };
                  const ct = CLAIM_TYPES.find(t => t.id === claim.claim_type);
                  return (
                    <div key={claim.id} style={{
                      padding: '14px 16px',
                      borderBottom: i < claims.length - 1 ? '1px solid var(--border-1)' : 'none',
                      background: 'var(--surface-1)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      {/* Icon */}
                      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: ct ? `${ct.color}18` : 'var(--surface-3)', border: `1px solid ${ct ? ct.color + '30' : 'var(--border-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {ct ? <ct.icon style={{ width: 17, height: 17, color: ct.color }} /> : <FileText style={{ width: 17, height: 17, color: 'var(--text-dim)' }} />}
                      </div>
                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{claim.claim_type_label}</p>
                        <p style={{ color: 'var(--text-dim)', fontSize: 11 }}>{claim.reference} · {claim.incident_date}</p>
                      </div>
                      {/* Status badge */}
                      <div style={{ padding: '4px 9px', borderRadius: 8, background: ss.bg, border: `1px solid ${ss.color}30`, flexShrink: 0 }}>
                        <span style={{ color: ss.color, fontSize: 10.5, fontWeight: 700 }}>{ss.label}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Need help? → MOTOFIX support */}
            <button onClick={() => navigate('/contact-support')} style={{ width: '100%', textAlign: 'left', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border-2)', marginBottom: 20, background: 'var(--surface-1)', cursor: 'pointer', padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-1)' }}>
                <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Need help?</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle style={{ width: 18, height: 18, color: '#22C55E' }} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 13 }}>Contact MOTOFIX support</p>
                  <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 1 }}>{policy ? `Questions about your ${policy.insurer_name} cover` : 'Questions about applying or claiming'}</p>
                </div>
                <ChevronRight style={{ width: 15, height: 15, color: 'var(--text-faint)', marginLeft: 'auto' }} />
              </div>
            </button>

            {/* Tips */}
            <div style={{ borderRadius: 18, padding: '16px 16px', background: 'var(--surface-1)', border: '1px solid var(--border-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle style={{ width: 15, height: 15, color: '#fcd34d' }} />
                <p style={{ color: '#fcd34d', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Before You File</p>
              </div>
              {[
                'Take photos of all vehicle damage before moving the vehicle.',
                'Collect third-party details (name, plate, insurer) if another vehicle is involved.',
                'File a police report for accidents, theft, or vandalism within 24 hours.',
                'Keep all repair estimates and receipts — you will need them for settlement.',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border-4)', flexShrink: 0, marginTop: 5 }} />
                  <p style={{ color: 'var(--text-lo)', fontSize: 12, lineHeight: 1.55 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════
            APPLY FOR INSURANCE
        ════════════════════ */}
        {step === 'apply' && (
          <div style={{ padding: '18px 18px 40px' }}>
            <p style={{ color: 'var(--text-lo)', fontSize: 12.5, lineHeight: 1.55, marginBottom: 18 }}>
              Pick an insurer and the cover you want. MOTOFIX records your application and the insurer follows up to finalise cover and arrange your premium.
            </p>

            {/* 1 · Insurer */}
            <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>1 · Choose insurer</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {insurers.map(ins => {
                const sel = aInsurer?.id === ins.id;
                return (
                  <button key={ins.id} onClick={() => setAInsurer(ins)} style={{ textAlign: 'left', borderRadius: 14, padding: '12px 14px', border: `1.5px solid ${sel ? G : 'var(--border-2)'}`, background: sel ? `${G}10` : 'var(--surface-1)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: sel ? `${G}1e` : 'var(--surface-3)', border: `1px solid ${sel ? G + '40' : 'var(--border-2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Shield style={{ width: 16, height: 16, color: sel ? G : 'var(--text-dim)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 13.5 }}>{ins.short}</p>
                        <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 1 }}>{ins.tagline}</p>
                      </div>
                      {sel && <Check style={{ width: 16, height: 16, color: G, flexShrink: 0 }} />}
                    </div>
                  </button>
                );
              })}
              {insurers.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading insurers…</p>}
            </div>

            {/* 2 · Cover type */}
            <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>2 · Choose cover</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {coverTypes.map(c => {
                const sel = aCover?.id === c.id;
                return (
                  <button key={c.id} onClick={() => setACover(c)} style={{ textAlign: 'left', borderRadius: 14, padding: '12px 14px', border: `1.5px solid ${sel ? G : 'var(--border-2)'}`, background: sel ? `${G}10` : 'var(--surface-1)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 13.5 }}>{c.label}</p>
                        <p style={{ color: 'var(--text-dim)', fontSize: 11.5, marginTop: 2, lineHeight: 1.45 }}>{c.blurb}</p>
                      </div>
                      {sel && <Check style={{ width: 16, height: 16, color: G, flexShrink: 0, marginTop: 2 }} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 3 · Vehicle */}
            <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 10 }}>3 · Your vehicle</p>
            <Field label="Number plate *" value={aVeh.reg} onChange={(v: string) => setAVeh(s => ({ ...s, reg: v }))} placeholder="e.g. UAX 123A" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Make" value={aVeh.make} onChange={(v: string) => setAVeh(s => ({ ...s, make: v }))} placeholder="Toyota" />
              <Field label="Model" value={aVeh.model} onChange={(v: string) => setAVeh(s => ({ ...s, model: v }))} placeholder="Premio" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Year" value={aVeh.year} onChange={(v: string) => setAVeh(s => ({ ...s, year: v }))} placeholder="2015" type="number" />
              <div style={{ marginBottom: 14 }}>
                <p style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Period</p>
                <select value={aVeh.period} onChange={e => setAVeh(s => ({ ...s, period: e.target.value }))} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, background: 'var(--surface-3)', border: '1px solid var(--border-2)', color: 'var(--text-hi)', fontSize: 14, outline: 'none' }}>
                  <option>1 year</option><option>6 months</option><option>3 months</option><option>1 month</option>
                </select>
              </div>
            </div>

            <button onClick={submitApplication} disabled={!aInsurer || !aCover || !aVeh.reg.trim() || applying}
              style={{ width: '100%', height: 54, borderRadius: 16, border: 'none', marginTop: 8, cursor: (!aInsurer || !aCover || !aVeh.reg.trim() || applying) ? 'default' : 'pointer', opacity: (!aInsurer || !aCover || !aVeh.reg.trim()) ? 0.5 : 1, background: `linear-gradient(135deg, ${G}, ${GD})`, color: '#000', fontWeight: 900, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {applying ? <Loader2 style={{ width: 19, height: 19, animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 style={{ width: 19, height: 19 }} />}
              {applying ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        )}

        {step === 'apply_done' && (
          <div style={{ padding: '40px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${G}18`, border: `2px solid ${G}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: G }} />
            </div>
            <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Application sent</p>
            <p style={{ color: 'var(--text-lo)', fontSize: 13.5, lineHeight: 1.55, maxWidth: 300, marginBottom: 16 }}>
              Your application to <strong style={{ color: 'var(--text-hi)' }}>{aInsurer?.name}</strong>{aCover ? ` for ${aCover.label}` : ''} has been received. They’ll contact you to finalise cover and arrange your premium.
            </p>
            {appRef && (
              <div style={{ borderRadius: 12, padding: '10px 16px', background: 'var(--surface-1)', border: '1px solid var(--border-2)', marginBottom: 22 }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Reference </span>
                <span style={{ color: G, fontWeight: 800, fontSize: 13 }}>{appRef}</span>
              </div>
            )}
            <button onClick={() => { setStep('overview'); setAInsurer(null); setACover(null); setAVeh({ reg: '', make: '', model: '', year: '', period: '1 year' }); }}
              style={{ width: '100%', maxWidth: 320, height: 50, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${G}, ${GD})`, color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
              Back to Insurance
            </button>
          </div>
        )}

        {/* ════════════════════
            STEP 1 — CLAIM TYPE
        ════════════════════ */}
        {step === 'type' && (
          <div style={{ padding: '4px 18px 32px' }}>
            <p style={{ color: 'var(--text-lo)', fontSize: 13, lineHeight: 1.55, marginBottom: 20 }}>
              What type of incident are you claiming for?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {CLAIM_TYPES.map(({ id, label, desc, icon: Ic, color, bg }) => {
                const active = draft.type === id;
                return (
                  <button
                    key={id}
                    onClick={() => patch({ type: id, typeLabel: label, typeColor: color })}
                    style={{
                      padding: '16px 14px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                      background: active ? `${color}14` : 'var(--surface-2)',
                      border: `1.5px solid ${active ? color + '55' : 'var(--border-2)'}`,
                      transition: 'all 0.2s',
                      boxShadow: active ? `0 0 18px ${color}18` : 'none',
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: active ? `${color}20` : bg, border: `1.5px solid ${active ? color + '50' : color + '25'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      <Ic style={{ width: 22, height: 22, color }} />
                    </div>
                    <p style={{ color: active ? 'var(--text-hi)' : 'var(--text-hi)', fontWeight: 800, fontSize: 13, marginBottom: 3 }}>{label}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 10.5, lineHeight: 1.35 }}>{desc}</p>
                    {active && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 style={{ width: 12, height: 12, color }} />
                        <span style={{ color, fontSize: 10, fontWeight: 700 }}>Selected</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════
            STEP 2 — DETAILS
        ════════════════════ */}
        {step === 'details' && (
          <div style={{ padding: '4px 18px 32px' }}>
            <p style={{ color: 'var(--text-lo)', fontSize: 13, lineHeight: 1.55, marginBottom: 20 }}>
              Tell us what happened. Be as specific as possible.
            </p>

            {/* Selected type chip */}
            {selectedType && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 10, marginBottom: 20, background: `${selectedType.color}12`, border: `1px solid ${selectedType.color}30` }}>
                <selectedType.icon style={{ width: 13, height: 13, color: selectedType.color }} />
                <span style={{ color: selectedType.color, fontSize: 12, fontWeight: 700 }}>{selectedType.label} Claim</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
              <Field label="Date of incident" value={draft.date} onChange={v => patch({ date: v })} type="date" />
              <Field label="Time of incident" value={draft.time} onChange={v => patch({ time: v })} type="time" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ color: 'var(--text-lo)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Location of incident</p>
              <div style={{ position: 'relative' }}>
                <input
                  value={draft.location}
                  onChange={e => patch({ location: e.target.value })}
                  placeholder="E.g. Jinja Road near Nakawa Market, Kampala"
                  style={{
                    width: '100%', background: 'var(--surface-2)',
                    border: `1px solid ${draft.location ? `${G}40` : 'var(--border-2)'}`,
                    borderRadius: 12, color: 'var(--text-hi)', fontSize: 13,
                    padding: '11px 44px 11px 14px',
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={() => {
                    navigator.geolocation?.getCurrentPosition(pos => {
                      patch({ location: `GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` });
                    });
                  }}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <MapPin style={{ width: 16, height: 16, color: `${G}80` }} />
                </button>
              </div>
              <p style={{ color: 'var(--text-faint)', fontSize: 10.5, marginTop: 4 }}>Tap the pin icon to auto-fill your current GPS location.</p>
            </div>

            <Field
              label="Describe what happened"
              value={draft.description}
              onChange={v => patch({ description: v })}
              placeholder="Describe the incident in detail — what happened, how, damage observed, any witnesses…"
              rows={5}
            />

            <YesNo label="Were there any injuries?" value={draft.injuries} onChange={v => patch({ injuries: v })} />
            <YesNo label="Was a third party involved?" value={draft.thirdParty} onChange={v => patch({ thirdParty: v })} />
          </div>
        )}

        {/* ════════════════════
            STEP 3 — EVIDENCE
        ════════════════════ */}
        {step === 'evidence' && (
          <div style={{ padding: '4px 18px 32px' }}>
            <p style={{ color: 'var(--text-lo)', fontSize: 13, lineHeight: 1.55, marginBottom: 6 }}>
              Upload photos of the damage and the scene. Strong evidence speeds up your claim.
            </p>
            <p style={{ color: 'var(--text-faint)', fontSize: 11, marginBottom: 20 }}>
              Tap a slot to add a photo. At least 1 required.
            </p>

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {PHOTO_SLOTS.map((slot, i) => {
                const uploaded = draft.photos.find(p => p.slot === slot);
                return (
                  <button
                    key={slot}
                    onClick={() => { setActiveSlot(i); fileInputRef.current?.click(); }}
                    style={{
                      position: 'relative', aspectRatio: '1',
                      borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
                      background: uploaded ? 'transparent' : 'var(--surface-2)',
                      border: `1.5px solid ${uploaded ? `${G}55` : 'var(--border-2)'}`,
                      padding: 0,
                    }}
                  >
                    {uploaded ? (
                      <>
                        <img src={uploaded.preview} alt={slot} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)', display: 'flex', alignItems: 'flex-end', padding: '6px 8px' }}>
                          <span style={{ color: 'var(--text-hi)', fontSize: 9, fontWeight: 700, lineHeight: 1.2 }}>{slot}</span>
                        </div>
                        <div style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check style={{ width: 10, height: 10, color: '#000' }} />
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); patch({ photos: draft.photos.filter(p => p.slot !== slot) }); }}
                          style={{ position: 'absolute', top: 5, left: 5, width: 20, height: 20, borderRadius: '50%', background: 'var(--overlay-bg)', border: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <X style={{ width: 9, height: 9, color: 'var(--text-hi)' }} />
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '8px 6px', gap: 6 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-3)', border: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera style={{ width: 15, height: 15, color: 'var(--text-faint)' }} />
                        </div>
                        <span style={{ color: 'var(--text-dim)', fontSize: 9, lineHeight: 1.25, textAlign: 'center' }}>{slot}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-1)', border: '1px solid var(--border-2)', display: 'flex', gap: 10 }}>
              <AlertTriangle style={{ width: 15, height: 15, color: '#fcd34d', flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: 'var(--text-dim)', fontSize: 11.5, lineHeight: 1.55 }}>
                Photos cannot be altered or submitted after filing. Take clear, well-lit shots before moving the vehicle.
              </p>
            </div>
          </div>
        )}

        {/* ════════════════════
            STEP 4 — REVIEW
        ════════════════════ */}
        {step === 'review' && (
          <div style={{ padding: '4px 18px 32px' }}>
            <p style={{ color: 'var(--text-lo)', fontSize: 13, lineHeight: 1.55, marginBottom: 20 }}>
              Review your claim details before submitting.
            </p>

            {/* Summary card */}
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border-2)', marginBottom: 16 }}>
              {/* Claim type */}
              <div style={{ padding: '14px 16px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectedType && <selectedType.icon style={{ width: 18, height: 18, color: selectedType.color, flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Claim Type</p>
                  <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 14, marginTop: 1 }}>{draft.typeLabel}</p>
                </div>
                <button onClick={() => setStep('type')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G, fontSize: 11, fontWeight: 700 }}>Edit</button>
              </div>

              {/* Incident details */}
              {[
                { label: 'Date & Time', value: `${draft.date}  ·  ${draft.time}`, icon: Clock },
                { label: 'Location',   value: draft.location || '—',              icon: MapPin },
              ].map(({ label, value, icon: Ic }) => (
                <div key={label} style={{ padding: '12px 16px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-1)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <Ic style={{ width: 14, height: 14, color: 'var(--text-dim)', marginTop: 1, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 2 }}>{label}</p>
                    <p style={{ color: 'var(--text-md)', fontSize: 12 }}>{value}</p>
                  </div>
                </div>
              ))}

              {/* Description */}
              <div style={{ padding: '12px 16px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-1)', display: 'flex', gap: 12 }}>
                <FileText style={{ width: 14, height: 14, color: 'var(--text-dim)', marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Description</p>
                  <p style={{ color: 'var(--text-md)', fontSize: 12, lineHeight: 1.55 }}>{draft.description || '—'}</p>
                </div>
                <button onClick={() => setStep('details')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Edit</button>
              </div>

              {/* Flags */}
              <div style={{ padding: '12px 16px', background: 'var(--surface-1)', display: 'flex', gap: 16 }}>
                {[
                  { label: 'Injuries', value: draft.injuries === null ? '—' : draft.injuries ? 'Yes' : 'No', alert: draft.injuries },
                  { label: 'Third Party', value: draft.thirdParty === null ? '—' : draft.thirdParty ? 'Yes' : 'No', alert: draft.thirdParty },
                ].map(({ label, value, alert }) => (
                  <div key={label} style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 3 }}>{label}</p>
                    <p style={{ color: alert ? '#f87171' : 'var(--text-md)', fontSize: 13, fontWeight: 700 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Photos summary */}
            <div style={{ borderRadius: 18, padding: '14px 16px', background: 'var(--surface-1)', border: '1px solid var(--border-2)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera style={{ width: 14, height: 14, color: 'var(--text-dim)' }} />
                  <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Evidence Photos</p>
                </div>
                <button onClick={() => setStep('evidence')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G, fontSize: 11, fontWeight: 700 }}>Edit</button>
              </div>
              {draft.photos.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>No photos added.</p>
              ) : (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {draft.photos.map(p => (
                    <div key={p.slot} style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: `1px solid ${G}35` }}>
                      <img src={p.preview} alt={p.slot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked insurer */}
            <div style={{ padding: '12px 16px', borderRadius: 14, background: `${G}08`, border: `1px solid ${G}25`, marginBottom: 6 }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 3 }}>Insurer</p>
              <p style={{ color: G, fontWeight: 700, fontSize: 13 }}>{policy ? `${policy.insurer_name} · ${policy.reference}` : 'Not linked to a policy — apply for cover from the Insurance page'}</p>
            </div>
          </div>
        )}

        {/* ════════════════════
            DONE
        ════════════════════ */}
        {step === 'done' && (
          <div style={{ padding: '40px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Success icon */}
            <div style={{
              width: 80, height: 80, borderRadius: 24, marginBottom: 24,
              background: `${G}18`, border: `2px solid ${G}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 40px ${G}22`,
            }}>
              <CheckCircle2 style={{ width: 40, height: 40, color: G }} />
            </div>

            <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 22, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Claim Submitted!
            </p>
            <p style={{ color: 'var(--text-lo)', fontSize: 13, textAlign: 'center', lineHeight: 1.6, maxWidth: 280, marginBottom: 28 }}>
              Your {draft.typeLabel.toLowerCase()} claim has been recorded{policy ? ` and linked to your ${policy.insurer_name} cover` : ''}. You will receive a confirmation shortly.
            </p>

            {/* Reference number */}
            <div style={{ width: '100%', maxWidth: 340, borderRadius: 16, padding: '16px 18px', background: `${G}0d`, border: `1.5px solid ${G}30`, marginBottom: 28 }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', textAlign: 'center', marginBottom: 8 }}>Claim Reference</p>
              <p style={{ color: G, fontWeight: 900, fontSize: 22, textAlign: 'center', letterSpacing: '0.08em', marginBottom: 10 }}>{refNum}</p>
              <button onClick={handleCopy} style={{
                width: '100%', height: 38, borderRadius: 10, border: `1px solid ${G}30`,
                background: copied ? `${G}18` : 'var(--surface-2)',
                color: copied ? G : 'var(--text-lo)',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all 0.2s',
              }}>
                {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                {copied ? 'Copied!' : 'Copy reference number'}
              </button>
            </div>

            {/* Next steps */}
            <div style={{ width: '100%', maxWidth: 340, borderRadius: 16, padding: '16px 16px', background: 'var(--surface-1)', border: '1px solid var(--border-2)', marginBottom: 24 }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>What Happens Next</p>
              {[
                `${policy ? policy.insurer_name : 'Your insurer'} will contact you within 24–48 hours.`,
                'A loss adjuster may be assigned to assess the damage.',
                'Keep your reference number for all follow-up communication.',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 2 ? 8 : 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: `${G}15`, border: `1px solid ${G}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: G }}>{i + 1}</div>
                  <p style={{ color: 'var(--text-lo)', fontSize: 12, lineHeight: 1.55 }}>{item}</p>
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/contact-support')} style={{
              width: '100%', maxWidth: 340, height: 50, borderRadius: 14,
              background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.25)',
              color: '#4ade80', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <MessageCircle style={{ width: 16, height: 16 }} />
              Contact MOTOFIX support
            </button>
          </div>
        )}
      </div>

      {/* ── Sticky footer CTA (wizard steps only) ── */}
      {['type','details','evidence','review'].includes(step) && (
        <div style={{
          flexShrink: 0, padding: '12px 18px',
          paddingBottom: 'max(env(safe-area-inset-bottom,0px),18px)',
          background: 'var(--overlay-bg)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-1)',
        }}>
          {/* Validation hints */}
          {step === 'type' && !draft.type && (
            <p style={{ color: 'var(--text-dim)', fontSize: 11, textAlign: 'center', marginBottom: 10 }}>Select an incident type to continue</p>
          )}
          {step === 'details' && (!draft.location || !draft.description) && (
            <p style={{ color: 'var(--text-dim)', fontSize: 11, textAlign: 'center', marginBottom: 10 }}>Fill in the location and description to continue</p>
          )}
          {step === 'evidence' && draft.photos.length === 0 && (
            <p style={{ color: '#fcd34d', fontSize: 11, textAlign: 'center', marginBottom: 10 }}>At least 1 photo is required. You can add more later.</p>
          )}

          <button
            onClick={() => {
              if (step === 'type'    && draft.type)                             setStep('details');
              if (step === 'details' && draft.location && draft.description)    setStep('evidence');
              if (step === 'evidence')                                           setStep('review');
              if (step === 'review')                                             handleSubmit();
            }}
            disabled={
              (step === 'type'     && !draft.type) ||
              (step === 'details'  && (!draft.location || !draft.description)) ||
              (step === 'evidence' && draft.photos.length === 0) ||
              submitting
            }
            style={{
              width: '100%', height: 54, borderRadius: 15, border: 'none',
              background: `linear-gradient(135deg, ${G}, ${GD})`,
              color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 0 0 3px ${G}22, 0 8px 24px ${G}28`,
              opacity: (
                (step === 'type'     && !draft.type) ||
                (step === 'details'  && (!draft.location || !draft.description)) ||
                (step === 'evidence' && draft.photos.length === 0) ||
                submitting
              ) ? 0.45 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {submitting ? (
              <><Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> Submitting…</>
            ) : step === 'review' ? (
              <><CheckCircle2 style={{ width: 18, height: 18 }} /> Submit Claim</>
            ) : (
              <>Continue <ChevronRight style={{ width: 16, height: 16 }} /></>
            )}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div style={{ flexShrink: 0, padding: '12px 18px', paddingBottom: 'max(env(safe-area-inset-bottom,0px),18px)', background: 'var(--overlay-bg)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border-1)' }}>
          <button onClick={() => { setStep('overview'); setDraft(emptyDraft()); }} style={{ width: '100%', height: 52, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${G}, ${GD})`, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Shield style={{ width: 17, height: 17 }} /> Back to Insurance
          </button>
        </div>
      )}

      <style>{`
        @keyframes ins-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
