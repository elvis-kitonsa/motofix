// PartsNeeded.tsx — shows which spare parts a given fault needs and their price ranges
// (admin catalog prices take priority over the AI estimate), then sends the driver on to
// order them from a dealer. Bridges a diagnosis into the parts-shopping flow.

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ShoppingBag, Wrench, ShieldCheck, Sparkles,
  Loader2, MapPin, ReceiptText, ChevronRight, Info,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { partsService, DiagnosisResult, CatalogPart } from '@/config/api';
import { toast } from 'sonner';

const PURPLE = '#A78BFA';

const fmtUGX = (n: number) => {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return `UGX ${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `UGX ${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return `UGX ${n.toLocaleString()}`;
};
const range = (a?: number | null, b?: number | null) =>
  (a == null && b == null) ? null : a === b ? fmtUGX(a ?? 0) : `${fmtUGX(a ?? 0)} – ${fmtUGX(b ?? 0)}`;
const prettify = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function PartsNeeded() {
  const navigate = useNavigate();
  const state = useLocation().state as {
    diagnosis?: DiagnosisResult;
    lat?: number; lng?: number; address?: string;
  } | null;
  const { isDark } = useTheme();

  const diagnosis = state?.diagnosis;
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [verified, setVerified] = useState(false);          // admin catalog override applied?
  const [label, setLabel] = useState('');
  const [parts, setParts] = useState<CatalogPart[]>([]);
  const [feeMin, setFeeMin] = useState<number | null>(null);
  const [feeMax, setFeeMax] = useState<number | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!diagnosis) { navigate('/home', { replace: true }); return; }
    let cancelled = false;
    (async () => {
      // Hybrid: admin catalog override wins; otherwise fall back to the AI estimate.
      let cat: any = null;
      try {
        const resp = await partsService.getCatalog(diagnosis.fault_category);
        cat = resp.data;
      } catch { /* 404 → no override, use AI */ }
      if (cancelled) return;
      const aiParts = diagnosis.required_parts ?? [];
      if (cat && (cat.parts?.length || cat.service_fee_min != null)) {
        setVerified(true);
        setLabel(cat.label || prettify(diagnosis.fault_category));
        setParts(cat.parts?.length ? cat.parts : aiParts);
        setFeeMin(cat.service_fee_min);
        setFeeMax(cat.service_fee_max);
        setNotes(cat.notes);
      } else {
        setVerified(false);
        setLabel(prettify(diagnosis.fault_category));
        setParts(aiParts);
        setFeeMin(diagnosis.service_fee_min ?? null);
        setFeeMax(diagnosis.service_fee_max ?? null);
        setNotes(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [diagnosis, navigate]);

  const partsTotalMin = parts.reduce((s, p) => s + (p.price_min || 0), 0);
  const partsTotalMax = parts.reduce((s, p) => s + (p.price_max || 0), 0);

  const findDealers = () => {
    const order = {
      fault_category: diagnosis!.fault_category,
      fault_label: label,
      parts: parts.map(p => ({ name: p.name, price_min: p.price_min, price_max: p.price_max, qty: 1 })),
    };
    const go = (lat: number, lng: number, address?: string) =>
      navigate('/spare-parts', { state: { lat, lng, address, order } });

    if (state?.lat != null && state?.lng != null) { go(state.lat, state.lng, state.address); return; }
    if (!('geolocation' in navigator)) { toast.error('Location not available on this device'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLocating(false); go(pos.coords.latitude, pos.coords.longitude); },
      () => { setLocating(false); toast.error('Could not get your location — please enable location access'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ── theme ──
  const bg = isDark ? '#0b0f17' : '#f5f6fa';
  const surface = isDark ? '#111827' : '#ffffff';
  const textHi = isDark ? '#f9fafb' : '#111827';
  const textMd = isDark ? '#d1d5db' : '#374151';
  const textLo = isDark ? '#9ca3af' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <div style={{ position: 'fixed', inset: 0, background: bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexShrink: 0,
        background: surface, borderBottom: `1px solid ${border}`,
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0, border: 'none', cursor: 'pointer',
          background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: textHi,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textHi }}>Fix it yourself</div>
          <div style={{ fontSize: 11, color: textLo }}>Parts & cost estimate</div>
        </div>
        <button onClick={() => navigate('/parts-orders')} title="My orders" style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 20, cursor: 'pointer',
          background: `${PURPLE}1a`, border: `1px solid ${PURPLE}44`, color: PURPLE, fontSize: 11, fontWeight: 700,
        }}><ReceiptText size={13} /> Orders</button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={30} style={{ color: PURPLE, animation: 'mf-spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Fault summary */}
          <div style={{ background: surface, borderRadius: 16, padding: 16, border: `1px solid ${border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, background: `${PURPLE}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}><Wrench size={18} style={{ color: PURPLE }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: textHi }}>{label}</div>
                <div style={{ fontSize: 12, color: textLo }}>{diagnosis!.fault_description}</div>
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
              padding: '3px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
              background: verified ? 'rgba(16,185,129,0.12)' : `${PURPLE}14`,
              color: verified ? '#10B981' : PURPLE,
              border: `1px solid ${verified ? 'rgba(16,185,129,0.3)' : `${PURPLE}40`}`,
            }}>
              {verified ? <><ShieldCheck size={12} /> MOTOFIX verified prices</> : <><Sparkles size={12} /> AI estimate</>}
            </div>
          </div>

          {/* Parts list */}
          <div style={{ background: surface, borderRadius: 16, padding: 16, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: textHi, marginBottom: 12 }}>Parts you'll likely need</div>
            {parts.length === 0 ? (
              <div style={{ fontSize: 12.5, color: textLo, fontStyle: 'italic' }}>
                No specific part list available — the dealer can advise on what's needed for this fault.
              </div>
            ) : parts.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '10px 0', borderBottom: i < parts.length - 1 ? `1px solid ${border}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <ShoppingBag size={15} style={{ color: PURPLE, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: textHi, fontWeight: 500 }}>{p.name}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: textMd, whiteSpace: 'nowrap' }}>
                  {range(p.price_min, p.price_max) ?? '—'}
                </span>
              </div>
            ))}
            {parts.length > 0 && (partsTotalMin > 0 || partsTotalMax > 0) && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12,
                borderTop: `1px dashed ${border}`, fontSize: 13, fontWeight: 800, color: textHi,
              }}>
                <span>Parts subtotal</span><span>{range(partsTotalMin, partsTotalMax)}</span>
              </div>
            )}
          </div>

          {/* Service fee */}
          {(feeMin != null || feeMax != null) && (
            <div style={{
              background: surface, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: textHi }}>Typical fitting / labour fee</div>
                <div style={{ fontSize: 11, color: textLo }}>What a roadside mechanic usually charges to fit it</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: PURPLE, whiteSpace: 'nowrap' }}>
                {range(feeMin, feeMax)}
              </span>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div style={{
              display: 'flex', gap: 9, padding: '12px 14px', borderRadius: 12,
              background: `${PURPLE}10`, border: `1px solid ${PURPLE}30`,
            }}>
              <Info size={15} style={{ color: PURPLE, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: textMd, lineHeight: 1.5 }}>{notes}</span>
            </div>
          )}

          <div style={{ fontSize: 11, color: textLo, textAlign: 'center', lineHeight: 1.5, padding: '0 8px' }}>
            These are rough public price ranges for Uganda, not a binding quote. Final prices vary by dealer and vehicle.
          </div>
        </div>
      )}

      {/* Footer actions */}
      {!loading && (
        <div style={{ flexShrink: 0, padding: 16, background: surface, borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={findDealers} disabled={locating} style={{
            width: '100%', height: 52, borderRadius: 14, border: 'none', cursor: locating ? 'wait' : 'pointer',
            background: PURPLE, color: '#fff', fontSize: 15, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {locating ? <><Loader2 size={18} style={{ animation: 'mf-spin 1s linear infinite' }} /> Finding you…</>
                      : <><MapPin size={18} /> Find &amp; order parts nearby <ChevronRight size={16} /></>}
          </button>
          <button onClick={() => navigate(-1)} style={{
            width: '100%', height: 46, borderRadius: 14, cursor: 'pointer',
            background: 'transparent', border: `1.5px solid ${border}`, color: textMd, fontSize: 13.5, fontWeight: 700,
          }}>
            Request a mechanic instead
          </button>
        </div>
      )}

      <style>{`@keyframes mf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
