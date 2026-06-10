import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Phone, Star, MapPin, X, Navigation, ShoppingBag,
  Loader2, ChevronRight, MessageCircle, ReceiptText, Clock, Store, Plus, Check,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { partsService, motobotService, PartsOrder, PartPriceItem } from '@/config/api';
import { generateSimDealers, SimDealer } from '@/lib/simDealers';
import { toast } from 'sonner';

const AMBER = '#F59E0B';
const AMBER_D = '#D97706';
const AMBER_GRAD = `linear-gradient(135deg, ${AMBER}, ${AMBER_D})`;

const QUICK_PARTS = [
  'Tyre', 'Inner tube', 'Car battery', 'Brake pads', 'Spark plugs', 'Headlight bulb',
  'Wiper blades', 'Engine oil', 'Air filter', 'Fan belt', 'Side mirror', 'Shock absorber',
  'Radiator', 'Fuel pump', 'Clutch plate', 'Fuses',
];

type Pose = 'grad' | 'detective' | 'think' | 'ready' | 'files' | 'wave';

interface Question {
  id: 'parts' | 'vehicle' | 'condition' | 'urgency';
  pose: Pose; text: string; hint?: string; type: 'multi' | 'single'; options: string[];
}

const QUESTIONS: Question[] = [
  { id: 'parts',     pose: 'grad',      text: 'What spare part are you looking for?', hint: 'Pick all that apply — or type your own', type: 'multi',  options: QUICK_PARTS },
  { id: 'vehicle',   pose: 'detective', text: 'What vehicle is it for?',              type: 'single', options: ['Saloon car', 'Boda-boda', 'Matatu / Van', 'Pick-up / Truck', 'Other'] },
  { id: 'condition', pose: 'think',     text: 'New or used parts?',                   type: 'single', options: ['Brand new', 'Good used', 'Either is fine'] },
  { id: 'urgency',   pose: 'ready',     text: 'How soon do you need them?',           type: 'single', options: ['Right now', 'Today', 'This week'] },
];

const PROC_MSGS = [
  'Analysing your request…', 'Checking current market prices…', 'Searching for spare-part dealers…',
  'Comparing dealer ratings…', 'Locating the nearest shops…', 'Putting it all together…',
];

function waDigits(raw?: string): string {
  if (!raw) return '';
  let d = raw.replace(/[^\d]/g, '');
  if (d.startsWith('0')) d = '256' + d.slice(1);
  else if (!d.startsWith('256') && d.length === 9) d = '256' + d;
  return d;
}
const fmtUGX = (n: number) => (n >= 1000 ? `UGX ${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : `UGX ${n}`);
const range = (a: number, b: number) => (a === b ? fmtUGX(a) : `${fmtUGX(a)} – ${fmtUGX(b)}`);

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  const f = Math.round(rating);
  return <span style={{ display: 'inline-flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} style={{ color: AMBER, fill: i <= f ? AMBER : 'none' }} />)}</span>;
}

// ── Sleek floating amber MOTOBOT (orb-bot) with per-question poses ────────────
function MotoBot({ pose }: { pose: Pose }) {
  const cap = pose === 'grad', shades = pose === 'grad', magnifier = pose === 'detective';
  const thought = pose === 'think', thumbs = pose === 'ready', files = pose === 'files';
  return (
    <svg width="100%" viewBox="0 0 280 272" fill="none" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="mbBody" cx="0.42" cy="0.3" r="0.85"><stop offset="0" stopColor="#FFE7A0" /><stop offset="0.55" stopColor="#F59E0B" /><stop offset="1" stopColor="#C2740A" /></radialGradient>
        <linearGradient id="mbHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#EEF1F6" /></linearGradient>
        <linearGradient id="mbVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3a46" /><stop offset="1" stopColor="#121219" /></linearGradient>
        <radialGradient id="mbTip" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFE9A8" /><stop offset="1" stopColor="#F59E0B" /></radialGradient>
        <radialGradient id="mbAura" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stopColor="rgba(245,158,11,0.30)" /><stop offset="1" stopColor="rgba(245,158,11,0)" /></radialGradient>
      </defs>

      <ellipse cx="140" cy="138" rx="130" ry="130" fill="url(#mbAura)" />
      <ellipse cx="140" cy="256" rx="58" ry="10" fill="#000" opacity="0.12" />

      {/* antenna (hidden under cap) */}
      {!cap && (<><line x1="140" y1="42" x2="140" y2="22" stroke={AMBER} strokeWidth="5" strokeLinecap="round" /><circle className="mb-ant" cx="140" cy="16" r="9" fill="url(#mbTip)" /></>)}

      {/* floating left hand */}
      <g className={thumbs ? '' : 'mb-wave'} style={{ transformOrigin: '70px 188px' }}>
        <ellipse cx="70" cy="188" rx="17" ry="19" fill={AMBER} /><ellipse cx="65" cy="183" rx="6" ry="7" fill="#FFD37A" opacity="0.75" />
      </g>
      {/* floating right hand + tool */}
      <ellipse cx="210" cy="188" rx="17" ry="19" fill={AMBER} /><ellipse cx="205" cy="183" rx="6" ry="7" fill="#FFD37A" opacity="0.75" />
      {magnifier ? (
        <g className="mb-tool" style={{ transformOrigin: '210px 188px' }}><g transform="translate(220,176) rotate(26)"><circle r="17" fill="#bcd4ff" opacity="0.35" stroke="#e5e7eb" strokeWidth="5" /><rect x="-4" y="15" width="8" height="24" rx="4" fill="#cbd5e1" /></g></g>
      ) : thumbs ? (
        <rect x="64" y="156" width="12" height="26" rx="6" fill={AMBER} />
      ) : !files && (
        <g className="mb-tool" style={{ transformOrigin: '210px 188px' }}><g transform="translate(214,180) rotate(34)"><rect x="-6" y="-40" width="12" height="52" rx="5" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" /><path d="M-14 -48 a14 14 0 0 1 28 0 v7 l-9 -5 -10 0 -9 5 z" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" /></g></g>
      )}

      {/* body */}
      <rect x="96" y="156" width="88" height="84" rx="40" fill="url(#mbBody)" />
      <ellipse cx="140" cy="172" rx="34" ry="12" fill="#fff" opacity="0.22" />
      <circle cx="140" cy="198" r="25" fill="#fff" />
      <image href="/motofix-logo.png" x="121" y="179" width="38" height="38" preserveAspectRatio="xMidYMid meet" />

      {/* head */}
      <rect x="70" y="42" width="140" height="108" rx="44" fill="url(#mbHead)" />
      <path d="M92 60 Q140 48 188 60" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.7" />
      <rect x="62" y="86" width="11" height="26" rx="5.5" fill={AMBER} /><rect x="207" y="86" width="11" height="26" rx="5.5" fill={AMBER} />
      {/* visor */}
      <rect x="86" y="64" width="108" height="64" rx="30" fill="url(#mbVisor)" />
      <rect x="96" y="72" width="48" height="13" rx="6.5" fill="#fff" opacity="0.10" />
      {/* eyes / shades + smile */}
      {shades ? (
        <g>
          <rect x="96" y="84" width="34" height="22" rx="10" fill="#08080e" /><rect x="150" y="84" width="34" height="22" rx="10" fill="#08080e" />
          <rect x="128" y="92" width="24" height="5" rx="2.5" fill={AMBER} />
          <rect x="101" y="88" width="11" height="4" rx="2" fill="#5b6472" /><rect x="155" y="88" width="11" height="4" rx="2" fill="#5b6472" />
        </g>
      ) : (
        <>
          <g className="mb-eye">
            <circle cx="118" cy="92" r="14" fill={AMBER} /><circle cx="123" cy="86" r="5" fill="#fff" /><circle cx="114" cy="98" r="3" fill="#FFE9A8" opacity="0.85" />
            <circle cx="162" cy="92" r="14" fill={AMBER} /><circle cx="167" cy="86" r="5" fill="#fff" /><circle cx="158" cy="98" r="3" fill="#FFE9A8" opacity="0.85" />
          </g>
          <path d="M120 110 Q140 124 160 110" stroke={AMBER} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* graduation cap */}
      {cap && (<g><rect x="122" y="32" width="36" height="10" rx="3" fill="#1b2147" /><polygon points="140,12 190,34 140,56 90,34" fill="#1b2147" /><polygon points="140,15 183,34 140,53 97,34" fill="#2e3566" /><line x1="177" y1="34" x2="184" y2="56" stroke={AMBER} strokeWidth="3" /><circle cx="184" cy="58" r="5" fill={AMBER} /></g>)}
      {/* thought bubble */}
      {thought && (<g className="mb-think"><circle cx="206" cy="56" r="5" fill="#fff" /><circle cx="218" cy="44" r="8" fill="#fff" /><circle cx="236" cy="30" r="17" fill="#fff" /><text x="236" y="36" textAnchor="middle" fontSize="20" fontWeight="800" fill={AMBER_D}>?</text></g>)}
      {/* flipping files (processing) */}
      {files && (<g><rect x="108" y="198" width="64" height="44" rx="6" fill="#B45309" /><rect className="mb-file" x="116" y="194" width="54" height="40" rx="5" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" style={{ transformOrigin: '116px 214px' }} /><rect className="mb-file2" x="116" y="194" width="54" height="40" rx="5" fill="#FEF3C7" stroke="#e5e7eb" strokeWidth="1.5" style={{ transformOrigin: '116px 214px' }} /></g>)}
    </svg>
  );
}

type Stage = 'intro' | 'questions' | 'processing' | 'results';

export default function SparePartsDealer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const routeState = useLocation().state as { lat?: number; lng?: number; address?: string; order?: { fault_label?: string; parts: { name: string; price_min: number; price_max: number }[] } } | null;
  const firstName = (user?.full_name?.trim().split(/\s+/)[0]) || 'there';
  const preOrder = routeState?.order;

  const [stage, setStage] = useState<Stage>(preOrder?.parts?.length ? 'processing' : 'intro');
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [otherInput, setOtherInput] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [priced, setPriced] = useState<PartPriceItem[]>(preOrder?.parts?.length ? preOrder.parts.map(p => ({ name: p.name, price_min: p.price_min, price_max: p.price_max, note: null })) : []);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(routeState?.lat != null && routeState?.lng != null ? { lat: routeState.lat, lng: routeState.lng } : null);
  const [dealers, setDealers] = useState<SimDealer[]>([]);
  const [selected, setSelected] = useState<SimDealer | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState<PartsOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [procMsg, setProcMsg] = useState(0);

  const items = useMemo(() => [...picked, ...customItems], [picked, customItems]);
  const q = QUESTIONS[qIndex];
  const pose: Pose = stage === 'processing' ? 'files' : stage === 'intro' ? 'wave' : (q?.pose ?? 'ready');

  // Welcome splash auto-advances into the questions.
  useEffect(() => { if (stage !== 'intro') return; const t = setTimeout(() => setStage('questions'), 3200); return () => clearTimeout(t); }, [stage]);

  const togglePick = (p: string) => setPicked(s => s.includes(p) ? s.filter(x => x !== p) : [...s, p]);
  const addCustom = () => { const v = otherInput.trim(); if (!v) return; if (![...picked, ...customItems].some(x => x.toLowerCase() === v.toLowerCase())) setCustomItems(s => [...s, v]); setOtherInput(''); };
  const removeCustom = (v: string) => setCustomItems(s => s.filter(x => x !== v));

  const advance = useCallback(() => { if (qIndex < QUESTIONS.length - 1) setQIndex(i => i + 1); else setStage('processing'); }, [qIndex]);
  const answerSingle = (val: string) => { setAnswers(a => ({ ...a, [q.id]: val })); setTimeout(advance, 280); };

  useEffect(() => {
    if (stage !== 'processing') return;
    setProcMsg(0);
    const msgT = setInterval(() => setProcMsg(i => (i + 1) % PROC_MSGS.length), 1400);
    const started = Date.now();
    let done = false;
    const finish = (pr: PartPriceItem[], c: { lat: number; lng: number } | null) => {
      if (done) return; done = true;
      if (pr.length) setPriced(pr);
      if (c) { setCoords(c); setDealers(generateSimDealers(c)); }
      const wait = Math.max(0, 3600 - (Date.now() - started));
      setTimeout(() => { clearInterval(msgT); setStage('results'); }, wait);
    };
    (async () => {
      let pr = priced;
      if (!pr.length && items.length) {
        try { const res = await motobotService.priceItems(items); pr = res.data.items?.length ? res.data.items : items.map(n => ({ name: n, price_min: 0, price_max: 0, note: null })); }
        catch { pr = items.map(n => ({ name: n, price_min: 0, price_max: 0, note: null })); }
      }
      let c = coords;
      if (!c && 'geolocation' in navigator) {
        c = await new Promise<{ lat: number; lng: number } | null>(resolve =>
          navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 10000 }));
      }
      finish(pr, c);
    })();
    return () => clearInterval(msgT);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDealer = (d: SimDealer) => { setSelected(d); setHeroIdx(0); };
  const imgsOf = (d: SimDealer) => (d.photos.length ? d.photos : d.art);

  const placeOrder = useCallback(() => {
    if (!selected) return;
    const ctx = [answers.vehicle, answers.condition, answers.urgency && `needed ${answers.urgency.toLowerCase()}`].filter(Boolean).join(' · ');
    const lines = [`Hello ${selected.name}, I'd like to order spare parts via MOTOFIX (MOTOBOT).`, ''];
    if (ctx) lines.push(`For: ${ctx}`, '');
    if (priced.length) { lines.push('Parts needed:'); priced.forEach(p => lines.push(`• ${p.name}${(p.price_min || p.price_max) ? ` (est. ${range(p.price_min, p.price_max)})` : ''}`)); }
    if (coords) lines.push('', `My location: https://maps.google.com/?q=${coords.lat},${coords.lng}`);
    lines.push('', 'Are these available, and how much in total?');
    const text = encodeURIComponent(lines.join('\n'));
    const digits = waDigits(selected.whatsapp || selected.phone);
    window.open(digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
    const min = priced.reduce((s, p) => s + (p.price_min || 0), 0), max = priced.reduce((s, p) => s + (p.price_max || 0), 0);
    partsService.createOrder({ fault_label: ctx ? `Spare parts · ${ctx}` : 'Spare parts (MOTOBOT)', parts: priced.map(p => ({ name: p.name, price_min: p.price_min, price_max: p.price_max, qty: 1 })), dealer_name: selected.name, dealer_phone: selected.phone, dealer_place_id: selected.place_id, estimated_total_min: min || null, estimated_total_max: max || null })
      .then(() => toast.success('Order saved to your history')).catch(() => {});
  }, [selected, priced, coords, answers]);

  const openOrders = () => { setOrdersOpen(true); setOrdersLoading(true); partsService.listOrders().then(r => setOrders(r.data || [])).catch(() => setOrders([])).finally(() => setOrdersLoading(false)); };

  // ── theme tokens (match the rest of the app) ──
  const pageBg = 'var(--page-bg)';
  const surface = 'var(--surface-1)';
  const surface2 = 'var(--surface-2)';
  const textHi = 'var(--text-hi)';
  const textMd = 'var(--text-md)';
  const textLo = 'var(--text-dim)';
  const border = 'var(--border-2)';

  // ════════ INTRO + QUESTIONS + PROCESSING (amber/white scene, on-brand) ════════
  if (stage === 'intro' || stage === 'questions' || stage === 'processing') {
    const robotW = stage === 'processing' ? 'clamp(250px,56vw,350px)' : stage === 'intro' ? 'clamp(230px,52vw,330px)' : 'clamp(200px,44vw,290px)';
    const zoneH = stage === 'processing' ? 'clamp(230px,40vh,360px)' : stage === 'intro' ? 'clamp(220px,38vh,340px)' : 'clamp(195px,31vh,300px)';
    // Robot glides to a new spot for each question — it "moves around" the zone.
    const robotShiftX = stage === 'questions' ? ['-26%', '24%', '-20%', '22%'][qIndex % 4] : '0%';
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: pageBg, display: 'flex', flexDirection: 'column' }}>
        {/* warm amber glow + particles */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(90% 52% at 50% 2%, rgba(245,158,11,0.20), transparent 60%)', pointerEvents: 'none' }} />
        {[{ l: '10%', t: '30%', s: 9, d: '0s' }, { l: '86%', t: '34%', s: 11, d: '1.2s' }, { l: '16%', t: '60%', s: 7, d: '0.6s' }, { l: '88%', t: '66%', s: 9, d: '1.7s' }].map((p, i) => (
          <span key={i} style={{ position: 'absolute', left: p.l, top: p.t, width: p.s, height: p.s, borderRadius: '50%', background: AMBER, opacity: 0.3, animation: `mb-drift ${5 + i}s ${p.d} ease-in-out infinite`, pointerEvents: 'none' }} />
        ))}

        {/* top bar */}
        <div style={{ position: 'relative', zIndex: 5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: surface, color: textHi, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={18} /></button>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '0.26em', color: AMBER_D }}>MOTOFIX · MOTOBOT</div>
          {stage === 'questions' && <div style={{ display: 'flex', gap: 6 }}>{QUESTIONS.map((_, i) => <span key={i} style={{ width: i === qIndex ? 20 : 8, height: 8, borderRadius: 4, background: i <= qIndex ? AMBER : 'rgba(245,158,11,0.28)', transition: 'all 0.3s' }} />)}</div>}
        </div>

        {/* robot zone — dedicated, always fully visible; glides around per question */}
        <div style={{ position: 'relative', zIndex: 3, flex: '0 0 auto', height: zoneH, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ width: robotW, transform: `translateX(${robotShiftX})`, transition: 'transform 0.85s cubic-bezier(0.22,1,0.36,1)' }}>
            <div className="mb-float" key={pose}><MotoBot pose={pose} /></div>
          </div>
        </div>

        {/* content zone — scrolls below the robot */}
        <div style={{ position: 'relative', zIndex: 4, flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 18px 26px' }}>
          {stage === 'intro' && (
            <div onClick={() => setStage('questions')} style={{ maxWidth: 460, margin: '14px auto 0', textAlign: 'center', cursor: 'pointer', animation: 'mb-qIn 0.5s ease both' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.3em', color: AMBER_D, marginBottom: 10 }}>MOTOBOT</div>
              <h1 style={{ fontSize: 'clamp(22px,5vw,30px)', fontWeight: 900, color: textHi, lineHeight: 1.25, margin: '0 0 10px' }}>Welcome to the <span style={{ color: AMBER_D }}>Spare Parts</span> Shopping &amp; Ordering Section</h1>
              <p style={{ fontSize: 13.5, color: textMd, lineHeight: 1.6, margin: '0 0 22px' }}>Hi {firstName}! I'll help you find the parts you need and the best dealers to buy from.</p>
              <div style={{ width: 220, height: 5, borderRadius: 3, margin: '0 auto', background: 'rgba(245,158,11,0.2)', overflow: 'hidden' }}><div className="mb-loadbar" style={{ height: '100%', borderRadius: 3, background: AMBER_GRAD }} /></div>
              <div style={{ marginTop: 16, fontSize: 12, color: textLo }}>Tap to continue →</div>
            </div>
          )}
          {stage === 'questions' && q && (
            <div key={qIndex} style={{ maxWidth: 560, margin: '0 auto', animation: 'mb-qIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>
              <div style={{ background: surface, borderRadius: 20, padding: '16px 18px', marginBottom: 14, border: `1px solid ${border}`, boxShadow: '0 12px 36px rgba(0,0,0,0.16)' }}>
                {qIndex === 0 && <div style={{ fontSize: 12.5, color: AMBER_D, fontWeight: 700, marginBottom: 4 }}>Hi {firstName}! 👋 I'm MOTOBOT.</div>}
                <div style={{ fontSize: 18, fontWeight: 800, color: textHi, lineHeight: 1.3 }}>{q.text}</div>
                {q.hint && <div style={{ fontSize: 12, color: textLo, marginTop: 4 }}>{q.hint}</div>}
              </div>

              {q.type === 'multi' ? (
                <div style={{ background: surface, borderRadius: 20, padding: 14, border: `1px solid ${border}`, boxShadow: '0 12px 36px rgba(0,0,0,0.16)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: '28vh', overflowY: 'auto' }}>
                    {q.options.map(p => {
                      const on = picked.includes(p);
                      return (
                        <button key={p} onClick={() => togglePick(p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: on ? 'rgba(245,158,11,0.14)' : 'transparent', color: on ? AMBER_D : textMd, border: `1.5px solid ${on ? AMBER : border}` }}>
                          <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? AMBER : 'transparent', border: `1.5px solid ${on ? AMBER : textLo}` }}>{on && <Check size={11} style={{ color: '#fff' }} />}</span>{p}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input value={otherInput} onChange={e => setOtherInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustom(); }} placeholder="Other — type a part…" style={{ flex: 1, height: 42, borderRadius: 12, border: `1.5px solid ${border}`, background: surface2, color: textHi, padding: '0 12px', fontSize: 13, outline: 'none' }} />
                    <button onClick={addCustom} style={{ width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'rgba(245,158,11,0.16)', color: AMBER_D, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></button>
                  </div>
                  {customItems.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>{customItems.map(c => <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'rgba(245,158,11,0.16)', color: AMBER_D }}>{c}<button onClick={() => removeCustom(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: AMBER_D, padding: 0, display: 'flex' }}><X size={13} /></button></span>)}</div>}
                  <button onClick={advance} disabled={!items.length} style={{ width: '100%', marginTop: 14, height: 50, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 800, cursor: items.length ? 'pointer' : 'not-allowed', background: items.length ? AMBER_GRAD : 'var(--surface-3)', color: items.length ? '#fff' : textLo, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Continue{items.length ? ` (${items.length})` : ''} <ChevronRight size={18} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map(o => (
                    <button key={o} onClick={() => answerSingle(o)} style={{ width: '100%', textAlign: 'left', padding: '15px 18px', borderRadius: 16, cursor: 'pointer', fontSize: 14.5, fontWeight: 700, background: surface, color: textHi, border: answers[q.id] === o ? `2px solid ${AMBER}` : `1px solid ${border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{o} <ChevronRight size={18} style={{ color: AMBER }} /></button>
                  ))}
                </div>
              )}
            </div>
          )}

          {stage === 'processing' && (
            <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', paddingBottom: 10 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: textHi, margin: '0 0 12px' }}>MOTOBOT is on it…</h2>
              <p key={procMsg} style={{ fontSize: 14.5, fontWeight: 700, color: AMBER_D, margin: '0 0 22px', animation: 'mb-qIn 0.4s ease both' }}>{PROC_MSGS[procMsg]}</p>
              <div style={{ width: 240, height: 5, borderRadius: 3, margin: '0 auto', background: 'rgba(245,158,11,0.2)', overflow: 'hidden' }}><div className="mb-loadbar" style={{ height: '100%', borderRadius: 3, background: AMBER_GRAD }} /></div>
            </div>
          )}
        </div>
        <Styles />
      </div>
    );
  }

  // ════════ RESULTS ════════
  return (
    <div style={{ position: 'fixed', inset: 0, background: pageBg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexShrink: 0, background: surface, borderBottom: `1px solid ${border}` }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: surface2, color: textHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={18} /></button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: AMBER_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Store size={17} style={{ color: '#fff' }} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800, color: textHi }}>Your results</div><div style={{ fontSize: 11, color: textLo }}>{dealers.length} dealers · {priced.length} parts</div></div>
        <button onClick={openOrders} title="My orders" style={{ width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: surface2, color: textHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ReceiptText size={16} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {priced.length > 0 && (
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: textHi, marginBottom: 10 }}>Estimated prices in Kampala</div>
            {priced.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: i < priced.length - 1 ? `1px solid ${border}` : 'none' }}>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: textHi }}>{p.name}</div>{p.note && <div style={{ fontSize: 11, color: textLo }}>{p.note}</div>}</div>
                <span style={{ fontSize: 13, fontWeight: 800, color: AMBER_D, whiteSpace: 'nowrap' }}>{(p.price_min || p.price_max) ? range(p.price_min, p.price_max) : '—'}</span>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: textLo }}>Rough public estimates, not a binding quote.</div>
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 800, color: textHi, marginBottom: 10 }}>Dealers near you — tap to view &amp; order</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dealers.map(d => (
            <button key={d.place_id} onClick={() => openDealer(d)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, cursor: 'pointer', textAlign: 'left', background: surface, border: `1px solid ${border}` }}>
              <div style={{ width: 58, height: 58, borderRadius: 12, flexShrink: 0, overflow: 'hidden', border: `1px solid ${border}` }}><img src={imgsOf(d)[0]} alt={d.name} onError={e => { (e.currentTarget as HTMLImageElement).src = d.art[0]; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: textHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}><Stars rating={d.rating} size={11} /><span style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>{d.rating.toFixed(1)}</span><span style={{ fontSize: 11, color: textLo }}>· {d.distance_km} km</span></div>
                <div style={{ fontSize: 11, color: textLo, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.specialization}</div>
              </div>
              <ChevronRight size={16} style={{ color: textLo, flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 45, background: surface, borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -16px 56px rgba(0,0,0,0.32)' }}>
          <div style={{ position: 'relative', height: 188, overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
            <img src={imgsOf(selected)[heroIdx] ?? selected.art[0]} alt={selected.name} onError={e => { (e.currentTarget as HTMLImageElement).src = selected.art[Math.min(heroIdx, selected.art.length - 1)]; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.52)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 6 }}>{imgsOf(selected).map((a, i) => <button key={i} onClick={() => setHeroIdx(i)} style={{ width: 34, height: 26, borderRadius: 6, overflow: 'hidden', border: `2px solid ${i === heroIdx ? '#fff' : 'rgba(255,255,255,0.5)'}`, cursor: 'pointer', padding: 0, background: 'none' }}><img src={a} alt="" onError={e => { (e.currentTarget as HTMLImageElement).src = selected.art[Math.min(i, selected.art.length - 1)]; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></button>)}</div>
          </div>
          <div style={{ padding: '18px 16px 36px' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: textHi, margin: '0 0 6px' }}>{selected.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}><Stars rating={selected.rating} size={14} /><span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>{selected.rating.toFixed(1)}</span><span style={{ fontSize: 12, color: textLo }}>({selected.user_ratings_total}) · {selected.distance_km} km away</span></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: selected.open_now ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: selected.open_now ? '#10B981' : '#EF4444', border: `1px solid ${selected.open_now ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: selected.open_now ? '#10B981' : '#EF4444' }} />{selected.open_now ? 'Open now' : 'Closed'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.14)', color: AMBER_D, border: `1px solid ${AMBER}55` }}><ShoppingBag size={11} /> {selected.specialization}</span>
            </div>
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 8 }}><MapPin size={14} style={{ color: AMBER, flexShrink: 0, marginTop: 2 }} /><span style={{ fontSize: 13, color: textMd, lineHeight: 1.5 }}>{selected.vicinity}</span></div>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}><Clock size={14} style={{ color: AMBER, flexShrink: 0 }} /><span style={{ fontSize: 13, color: textMd }}>{selected.hours}</span></div>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 16 }}><Phone size={14} style={{ color: AMBER, flexShrink: 0 }} /><span style={{ fontSize: 13, color: textMd }}>{selected.phone}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>{selected.services.map((s, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: textMd }}><span style={{ fontSize: 15 }}>{s.icon}</span> {s.label}</div>)}</div>
            {priced.length > 0 && <div style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 10, background: 'rgba(245,158,11,0.1)', border: `1px solid ${AMBER}40` }}><div style={{ fontSize: 11, fontWeight: 700, color: AMBER_D, marginBottom: 4 }}>YOUR LIST</div><div style={{ fontSize: 12, color: textMd, lineHeight: 1.5 }}>{priced.map(p => p.name).join(', ')}</div></div>}
            <button onClick={placeOrder} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer', background: '#25D366', color: '#fff', fontSize: 14, fontWeight: 800, marginBottom: 10 }}><MessageCircle size={17} /> Order via WhatsApp</button>
            <a href={selected.online_store_url} target="_blank" rel="noopener noreferrer" style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 14, background: AMBER_GRAD, color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 800, marginBottom: 10 }}><Store size={16} /> Visit online store &amp; order</a>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href={`tel:${selected.phone.replace(/[\s\-()]/g, '')}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 14, background: 'rgba(245,158,11,0.14)', border: `1.5px solid ${AMBER}55`, color: AMBER_D, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}><Phone size={15} /> Call</a>
              <a href={selected.directions_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderRadius: 14, background: surface2, border: `1.5px solid ${border}`, color: textMd, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}><Navigation size={15} /> Directions</a>
            </div>
          </div>
        </div>
      )}

      {ordersOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: pageBg, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: surface, borderBottom: `1px solid ${border}` }}>
            <button onClick={() => setOrdersOpen(false)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: surface2, color: textHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={18} /></button>
            <div style={{ fontSize: 15, fontWeight: 700, color: textHi }}>My Parts Orders</div>
          </div>
          {ordersLoading ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={26} style={{ color: AMBER, animation: 'mb-spin 1s linear infinite' }} /></div>
            : orders.length === 0 ? <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, textAlign: 'center' }}><ShoppingBag size={34} style={{ color: textLo, opacity: 0.6 }} /><div style={{ fontSize: 14, fontWeight: 700, color: textHi }}>No orders yet</div></div>
              : <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>{orders.map(o => <div key={o.id} style={{ background: surface, borderRadius: 14, padding: 14, border: `1px solid ${border}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><ShoppingBag size={15} style={{ color: AMBER, flexShrink: 0 }} /><span style={{ fontSize: 14, fontWeight: 700, color: textHi }}>{o.fault_label || 'Spare parts'}</span></div>{o.dealer_name && <div style={{ fontSize: 12.5, color: textMd, marginBottom: 4 }}>Dealer: <strong>{o.dealer_name}</strong></div>}<div style={{ fontSize: 12, color: textLo, marginBottom: 6 }}>{o.parts.map(p => p.name).join(', ')}</div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: textLo }}><Clock size={11} /> {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>)}</div>}
        </div>
      )}
      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      @keyframes mb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes mb-floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-13px); } }
      .mb-float { animation: mb-floaty 3s ease-in-out infinite; }
      @keyframes mb-sway { 0%,100% { transform: translateX(-16px); } 50% { transform: translateX(16px); } }
      .mb-sway { animation: mb-sway 5.5s ease-in-out infinite; }
      @keyframes mb-blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
      .mb-eye { transform-box: fill-box; transform-origin: center; animation: mb-blink 3.4s ease-in-out infinite; }
      @keyframes mb-antPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      .mb-ant { transform-box: fill-box; transform-origin: center; animation: mb-antPulse 1.2s ease-in-out infinite; }
      @keyframes mb-wave { 0%,100% { transform: rotate(8deg); } 50% { transform: rotate(-24deg); } }
      .mb-wave { animation: mb-wave 1.5s ease-in-out infinite; }
      @keyframes mb-toolWave { 0%,100% { transform: rotate(-7deg); } 50% { transform: rotate(9deg); } }
      .mb-tool { animation: mb-toolWave 1.8s ease-in-out infinite; }
      @keyframes mb-think { 0%,100% { transform: translateY(0); opacity: 0.92; } 50% { transform: translateY(-4px); opacity: 1; } }
      .mb-think { animation: mb-think 2s ease-in-out infinite; }
      @keyframes mb-flip { 0%,100% { transform: rotateY(0deg); } 50% { transform: rotateY(-150deg); } }
      .mb-file { animation: mb-flip 1.3s ease-in-out infinite; }
      .mb-file2 { animation: mb-flip 1.3s 0.65s ease-in-out infinite; }
      @keyframes mb-drift { 0%,100% { transform: translateY(0); opacity: 0.2; } 50% { transform: translateY(-26px); opacity: 0.5; } }
      @keyframes mb-qIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes mb-load { from { width: 0; } to { width: 100%; } }
      .mb-loadbar { animation: mb-load 3.5s linear both; }
    `}</style>
  );
}
