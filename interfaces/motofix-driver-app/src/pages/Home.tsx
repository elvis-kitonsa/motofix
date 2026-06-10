import { useNavigate } from 'react-router-dom';
import { useRequests } from '@/contexts/RequestContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Truck, Wrench, AlertTriangle,
  MapPin, ChevronRight, Phone, Clock, RefreshCw,
  Wifi, Loader2,
  Shield, TrendingUp, Star, HeartPulse,
  User, LogOut, SlidersHorizontal,
  BookOpen, X, Zap, Droplet, Wind, Circle,
  Sun, Moon, Bell, ShoppingBag,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { requestsService } from '@/config/api';
import { dueCount } from '@/lib/reminders';
import { useNotifications } from '@/hooks/useNotifications';
import ReminderOptInPrompt from '@/components/ReminderOptInPrompt';
import { toast } from 'sonner';

/* ── All services (editorial list) ────────────────────────── */
const ALL_SERVICES = [
  { id: 'mechanic',   label: 'Mechanic & Repair', icon: Wrench,     color: '#F59E0B', desc: 'Engine · Tyres · Battery · Roadside repair' },
  { id: 'towing',     label: 'Tow Truck & Breakdown', icon: Truck,  color: '#60A5FA', desc: 'Vehicle recovery & transport'                },
  { id: 'ambulance',  label: 'Ambulance & Medical', icon: HeartPulse, color: '#f87171', desc: 'Medical emergency dispatch'                  },
  { id: 'insurance',  label: 'Insurance Coverage & Claims', icon: Shield, color: '#34D399', desc: 'File a claim or check your coverage'         },
  { id: 'spare_parts', label: 'Spare Parts & Self-Fix', icon: ShoppingBag, color: '#A78BFA', desc: 'Find dealers · order parts to fix it yourself' },
];

/* ── Quick How-To guides ───────────────────────────────────── */
const GUIDES = [
  {
    id: 'tyre',
    title: 'Change a Tyre',
    icon: Circle,
    color: '#f87171',
    steps: [
      'Park on a flat, solid surface away from traffic. Turn on your hazard lights and apply the handbrake firmly.',
      'Get the spare tyre, jack, and wheel spanner out of the boot.',
      'Loosen each wheel nut on the flat tyre by half a turn — do not fully remove them yet.',
      'Place the jack under the vehicle\'s jack point nearest to the flat tyre (check under the door sill for a notch or marking). Raise the vehicle until the flat tyre is about 15 cm off the ground.',
      'Fully remove all wheel nuts and put them somewhere safe. Pull the flat tyre off.',
      'Mount the spare tyre onto the wheel bolts. Hand-tighten all nuts in a star pattern (opposite nuts, not in a circle).',
      'Lower the vehicle slowly until the tyre touches the ground but the weight is not fully on it. Tighten the nuts as firmly as you can in the same star pattern.',
      'Lower the vehicle completely and remove the jack. Give each nut one final firm tighten.',
      'Put the flat tyre in the boot and drive to the nearest tyre shop — spare tyres are not meant for high speeds or long distances.',
    ],
  },
  {
    id: 'bumper',
    title: 'Fix a Loose Bumper',
    icon: Wrench,
    color: '#fcd34d',
    steps: [
      'Park the car and turn it off. Walk around the bumper and identify exactly where it has come loose — look for missing clips, broken tabs, or fallen screws.',
      'For clips that have popped out — align the bumper back into position and press firmly until you hear or feel a click. Work from the centre outward.',
      'Check the top edge of the bumper where it meets the bonnet. Press it up and in toward the brackets until it sits flush.',
      'Check both side edges near the wheel arches. These often have push-in plastic clips — press them back in firmly.',
      'If a clip is broken, plastic bumper push-clips cost very little at any auto parts shop. Push the new clip through the hole from the front and it will lock in place.',
      'If there are missing screws, replace with the same size. Do not overtighten — bumpers are plastic and will crack.',
      'If the bumper bracket itself is cracked or bent, or the bumper is sagging no matter what you do, take it to a panel beater for a proper repair.',
    ],
  },
  {
    id: 'battery',
    title: 'Jump-Start a Dead Battery',
    icon: Zap,
    color: '#fbbf24',
    steps: [
      'Park the working car nose-to-nose with the dead car so both batteries are within cable reach. Turn off both vehicles.',
      'Connect the RED cable to the POSITIVE (+) terminal of the dead battery first.',
      'Connect the other end of the RED cable to the POSITIVE (+) terminal of the working battery.',
      'Connect the BLACK cable to the NEGATIVE (-) terminal of the working battery.',
      'Connect the other end of the BLACK cable to a bare metal part of the dead car\'s engine block — NOT to the dead battery. This avoids a spark near the battery.',
      'Start the working car and let it run for 2 minutes.',
      'Now try starting the dead car. If it starts, let both run for 10 minutes to allow charging.',
      'Remove the cables in reverse order: black from engine, black from working battery, red from working battery, red from the started car.',
      'Drive the jump-started car continuously for at least 30 minutes — this lets the alternator recharge the battery. If the battery dies again soon, it needs to be replaced.',
    ],
  },
  {
    id: 'oil',
    title: 'Top Up Engine Oil',
    icon: Droplet,
    color: '#34d399',
    steps: [
      'Park on a flat surface and switch off the engine. Wait at least 5 minutes for the oil to drain back into the sump.',
      'Open the bonnet and locate the oil dipstick — it usually has a yellow or orange loop handle.',
      'Pull the dipstick out fully and wipe it clean with a cloth or tissue.',
      'Reinsert the dipstick all the way back in, then pull it out again. Check where the oil line sits — it should be between the MIN and MAX marks.',
      'If the level is below MIN, find the oil filler cap on top of the engine (it usually has an oil can symbol or says ENGINE OIL). Unscrew it.',
      'Pour in a small amount of the correct oil type (check your car manual — common types are 5W-30 or 10W-40). Use a funnel to avoid spills.',
      'Wait a minute, then re-check the dipstick. Repeat until the level reaches the MAX mark. Do not overfill — too much oil is also harmful.',
      'Screw the filler cap back on tightly, close the bonnet, and check underneath the car for any fresh oil drips.',
    ],
  },
  {
    id: 'ac',
    title: 'AC Not Blowing Cold',
    icon: Wind,
    color: '#60a5fa',
    steps: [
      'Start the engine and set the AC to the maximum fan speed and lowest temperature.',
      'Open the bonnet and look at the AC compressor (a belt-driven unit at the front of the engine). When AC is on, a clutch plate at the front should spin. If it is not spinning, the system has a problem.',
      'If the compressor clutch is not engaging, the refrigerant (gas) is likely low. This requires an AC technician with a regas machine — you cannot fix this yourself.',
      'If the compressor is running but air is barely cold, check the cabin air filter. Open the glove box, press the sides inward to drop it fully, and you will see a filter behind it. If it looks grey and clogged, replace it.',
      'Make sure all the AC vents inside the car are fully open and nothing is blocking them.',
      'Check that the AC button is not set to recirculation mode only — mix in some fresh air from outside, especially if the car has been parked in the sun.',
      'If the air is still warm after all these checks, the system likely has a refrigerant leak or a failing compressor. Visit an AC technician.',
    ],
  },
  {
    id: 'wipers',
    title: 'Replace Wiper Blades',
    icon: Wind,
    color: '#a78bfa',
    steps: [
      'Turn on the ignition without starting the engine. Run the wipers once, then turn them off when they are upright in the middle of the windscreen. Turn off the ignition — this locks them in a raised position.',
      'Lift one wiper arm away from the windscreen. It will lock upright on its own.',
      'Look at the point where the blade connects to the arm. There is a small plastic tab or button on the underside of the connector — press it.',
      'While pressing the tab, slide the old blade downward toward the windscreen to unhook it from the arm. Pull it free.',
      'Take your new blade and align the hook slot with the wiper arm hook. Slide it upward until you hear a definite click.',
      'Gently lower the arm back onto the windscreen. Do not let it snap down on its own — it can crack the glass.',
      'Repeat the same steps for the other wiper blade.',
      'Test by turning the wipers on with some water on the screen — the blades should wipe cleanly without skipping or streaking.',
    ],
  },
];

/* ── Guide detail modal ──────────────────────────────────────── */
function GuideModal({ guide, onClose }: { guide: typeof GUIDES[0]; onClose: () => void }) {
  const Icon = guide.icon;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
        background: 'var(--overlay-bg)',
        border: '1px solid var(--border-3)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -24px 64px rgba(0,0,0,0.7)',
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 6, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-4)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px 16px', flexShrink: 0, borderBottom: '1px solid var(--border-2)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `${guide.color}18`, border: `1.5px solid ${guide.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon style={{ width: 20, height: 20, color: guide.color }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 16, lineHeight: 1 }}>{guide.title}</p>
            <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3 }}>{guide.steps.length} steps · Read carefully before starting</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-4)', border: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 15, height: 15, color: 'var(--text-lo)' }} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 20px 40px', scrollbarWidth: 'none' }}>
          {guide.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < guide.steps.length - 1 ? 20 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${guide.color}20`, border: `1.5px solid ${guide.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: guide.color, fontSize: 11, fontWeight: 900 }}>{i + 1}</span>
                </div>
                {i < guide.steps.length - 1 && (
                  <div style={{ width: 1.5, flex: 1, marginTop: 6, background: `${guide.color}20`, minHeight: 16 }} />
                )}
              </div>
              <p style={{ color: 'var(--text-md)', fontSize: 13.5, lineHeight: 1.65, paddingTop: 4, paddingBottom: i < guide.steps.length - 1 ? 4 : 0 }}>
                {step}
              </p>
            </div>
          ))}
          <div style={{ marginTop: 28, padding: '12px 14px', borderRadius: 14, background: 'var(--surface-1)', border: '1px solid var(--border-2)', display: 'flex', gap: 10 }}>
            <BookOpen style={{ width: 15, height: 15, color: 'var(--text-dim)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: 'var(--text-dim)', fontSize: 11.5, lineHeight: 1.55 }}>
              If you are unsure at any step, stop and use the SOS button on the dashboard to get a mechanic to assist you.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Status config ─────────────────────────────────────────── */
const STATUS: Record<string, { label: string; color: string; lightColor: string; bg: string; border: string }> = {
  pending:     { label: 'Pending',     color: '#F59E0B', lightColor: '#92620A', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
  accepted:    { label: 'Accepted',    color: '#60A5FA', lightColor: '#1D4ED8', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  in_progress: { label: 'In Progress', color: '#34D399', lightColor: '#065F46', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
  completed:   { label: 'Completed',   color: '#4ADE80', lightColor: '#15803D', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
  cancelled:   { label: 'Cancelled',   color: '#F87171', lightColor: '#991B1B', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
};

function greeting(name?: string) {
  // Always use Uganda time (EAT = UTC+3)
  const ugHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala', hour: 'numeric', hour12: false }),
    10
  );
  const period = ugHour < 12 ? 'morning' : ugHour < 17 ? 'afternoon' : 'evening';
  const question = ugHour < 12 ? 'Having a rough morning?' : ugHour < 17 ? 'Having a rough afternoon?' : 'Having a rough evening?';
  const firstName = name?.split(' ')[0] ?? 'Driver';
  const initials = name
    ? name.split(' ').slice(0, 3).map(w => w[0]).join('').toUpperCase()
    : 'DR';
  return { period, question, firstName, initials };
}

export default function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { requests, isLoading, error, isWsConnected, refresh } = useRequests();
  const { unread: unreadNotifs } = useNotifications();
  const [callingId, setCallingId] = useState<string | null>(null);
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [driverOnline, setDriverOnline] = useState(true);
  const [statusPrompt, setStatusPrompt] = useState<'going-offline' | 'going-online' | null>(null);
  const [remindersPending, setRemindersPending] = useState(0);
  const [selectedGuide, setSelectedGuide] = useState<typeof GUIDES[0] | null>(null);
  const [sosBlocked,    setSosBlocked]    = useState(false);
  const [pendingReview, setPendingReview] = useState<{ requestId: string; mechanicName: string } | null>(null);
  const sosSheetRef  = useRef<HTMLDivElement>(null);
  const sosDragRef   = useRef({ startY: 0, dragging: false, delta: 0 });

  const sosDragStart = (clientY: number) => {
    sosDragRef.current = { startY: clientY, dragging: true, delta: 0 };
    if (sosSheetRef.current) sosSheetRef.current.style.transition = 'none';
  };
  const sosDragMove = (clientY: number) => {
    if (!sosDragRef.current.dragging || !sosSheetRef.current) return;
    const delta = Math.max(0, clientY - sosDragRef.current.startY);
    sosDragRef.current.delta = delta;
    sosSheetRef.current.style.transform = `translateY(${delta}px)`;
    sosSheetRef.current.style.opacity   = String(Math.max(0, 1 - delta / 250));
  };
  const sosDragEnd = () => {
    if (!sosDragRef.current.dragging || !sosSheetRef.current) return;
    sosDragRef.current.dragging = false;
    const el = sosSheetRef.current;
    if (sosDragRef.current.delta > 90) {
      el.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
      el.style.transform  = 'translateY(100%)';
      el.style.opacity    = '0';
      setTimeout(() => setSosBlocked(false), 220);
    } else {
      el.style.transition = 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease';
      el.style.transform  = 'translateY(0)';
      el.style.opacity    = '1';
      setTimeout(() => { if (sosSheetRef.current) sosSheetRef.current.style.transition = ''; }, 320);
    }
  };


  useEffect(() => {
    // Only count checks that are *due now* (recurring daily/weekly/monthly that
    // haven't been done this period) + unticked personal reminders.
    const compute = () => { try { setRemindersPending(dueCount()); } catch { /* keep */ } };
    compute();
    window.addEventListener('storage', compute);
    window.addEventListener('motofix:reminders-changed', compute);
    // Recompute hourly so a day/week rollover refreshes the badge without a reload.
    const tick = setInterval(compute, 60 * 60 * 1000);
    return () => {
      window.removeEventListener('storage', compute);
      window.removeEventListener('motofix:reminders-changed', compute);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('motofix_pending_review');
      if (raw) setPendingReview(JSON.parse(raw));
    } catch {}
  }, []);

  const dismissReview = () => {
    sessionStorage.removeItem('motofix_pending_review');
    setPendingReview(null);
  };

  const active    = requests.filter(r => !['completed', 'cancelled'].includes(r.status));
  const activeReq = active[0] ?? null;          // drivers may have at most 1 active request
  const hasActive = !!activeReq;
  const history   = requests.filter(r =>  ['completed', 'cancelled'].includes(r.status));
  const completed = history.filter(r => r.status === 'completed').length;
  const { question, firstName, initials } = greeting(user?.full_name);

  const goRequest = (issueType?: string) => {
    if (hasActive) {
      setSosBlocked(true);
      return;
    }
    if (issueType) {
      const serviceType = issueType === 'towing' ? 'towing_provider' : 'mechanic';
      navigate('/locating', { state: { issueType, serviceType } });
    } else {
      navigate('/sos');
    }
  };

  const callMechanic = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCallingId(id);
    try {
      const res = await requestsService.getCallPartner(id);
      if (res.data.phone) window.location.href = `tel:${res.data.phone}`;
    } catch { toast.error('Unable to call mechanic right now'); }
    finally { setCallingId(null); }
  };


  if (isLoading) return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-12 max-w-md mx-auto space-y-5 animate-pulse">
        <div className="h-12 bg-white/6 rounded-xl w-56" />
        <div className="h-28 bg-white/4 rounded-3xl" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-white/4 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-28 overflow-x-hidden">
      <div className="px-4 max-w-md mx-auto">

        {/* ── First-run reminders opt-in ── */}
        <ReminderOptInPrompt />

        {/* ── Status confirmation modal ── */}
        {statusPrompt && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setStatusPrompt(null)}
            />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 70, width: 300, borderRadius: 22,
              background: 'var(--overlay-bg)',
              border: '1px solid var(--border-3)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              padding: '24px 20px',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px',
                background: statusPrompt === 'going-offline' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                border: `1.5px solid ${statusPrompt === 'going-offline' ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Wifi style={{ width: 20, height: 20, color: statusPrompt === 'going-offline' ? '#f87171' : '#4ade80' }} />
              </div>
              <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
                {statusPrompt === 'going-offline' ? 'Go Offline?' : 'Go Online?'}
              </p>
              <p style={{ color: 'var(--text-lo)', fontSize: 12, textAlign: 'center', lineHeight: 1.5, marginBottom: 20 }}>
                {statusPrompt === 'going-offline'
                  ? 'You will stop receiving requests. Only emergency medical services will remain accessible.'
                  : 'You will be visible to drivers and able to receive all service requests.'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStatusPrompt(null)}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid var(--border-3)', background: 'var(--surface-3)', color: 'var(--text-lo)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setDriverOnline(statusPrompt === 'going-online'); setStatusPrompt(null); }}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                    background: statusPrompt === 'going-offline' ? '#dc2626' : '#16a34a',
                    color: 'var(--text-hi)',
                  }}
                >
                  {statusPrompt === 'going-offline' ? 'Go Offline' : 'Go Online'}
                </button>
              </div>
            </div>
          </>
        )}


        {/* ── SOS blocked — active request warning ── */}
        {sosBlocked && activeReq && (() => {
          const Y = '#F59E0B', YD = '#D97706';
          const statusLabel: Record<string, string> = {
            pending:         'Waiting for a mechanic',
            accepted:        'Mechanic accepted',
            en_route:        'Mechanic on the way',
            arrived:         'Mechanic has arrived',
            in_progress:     'Service in progress',
            service_started: 'Service in progress',
          };
          const label = statusLabel[activeReq.status] ?? 'Request in progress';
          return (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
                onClick={() => setSosBlocked(false)}
              />
              <div
                ref={sosSheetRef}
                onTouchStart={e => sosDragStart(e.touches[0].clientY)}
                onTouchMove={e  => sosDragMove(e.touches[0].clientY)}
                onTouchEnd={sosDragEnd}
                onMouseDown={e  => sosDragStart(e.clientY)}
                onMouseMove={e  => { if (sosDragRef.current.dragging) sosDragMove(e.clientY); }}
                onMouseUp={sosDragEnd}
                onMouseLeave={sosDragEnd}
                style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80,
                  maxWidth: 480, margin: '0 auto',
                  borderRadius: '24px 24px 0 0',
                  background: 'var(--overlay-bg)',
                  border: `1px solid ${Y}28`,
                  boxShadow: `0 -12px 60px rgba(0,0,0,0.7), 0 0 0 1px ${Y}14`,
                  padding: '28px 24px',
                  paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)',
                  animation: 'sos-blk-slide-up 0.36s cubic-bezier(0.34,1.56,0.64,1)',
                  touchAction: 'none',
                  userSelect: 'none',
                  willChange: 'transform',
                }}>
                {/* Drag handle */}
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-4)', margin: '0 auto 24px', cursor: 'grab' }} />

                {/* Icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <div style={{ position: 'relative' }}>
                    {[80, 56].map((size, i) => (
                      <div key={size} style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: size, height: size, borderRadius: '50%',
                        border: `1.5px solid ${Y}${i === 0 ? '18' : '30'}`,
                        transform: 'translate(-50%,-50%)',
                        animation: `sos-blk-ring ${1.8 + i * 0.5}s ease-out ${i * 0.3}s infinite`,
                      }} />
                    ))}
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: `${Y}18`, border: `2px solid ${Y}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 32px ${Y}28`, position: 'relative',
                    }}>
                      <AlertTriangle style={{ width: 34, height: 34, color: Y }} />
                    </div>
                  </div>
                </div>

                {/* Text */}
                <p style={{ color: Y, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center', marginBottom: 10 }}>
                  Request Active
                </p>
                <h2 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 20, textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>
                  You already have a request in progress
                </h2>
                <p style={{ color: 'var(--text-lo)', fontSize: 13, textAlign: 'center', lineHeight: 1.65, marginBottom: 14 }}>
                  You cannot place another service request. Please complete or cancel the current one first.
                </p>

                {/* Status pill */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '7px 16px', borderRadius: 9999,
                    background: `${Y}14`, border: `1.5px solid ${Y}40`,
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: Y, animation: 'sos-blk-dot 1.4s ease-in-out infinite' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: Y }}>{label}</span>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => { setSosBlocked(false); navigate(`/requests/${activeReq.id}`); }}
                    style={{
                      width: '100%', height: 54, borderRadius: 16, border: 'none',
                      background: `linear-gradient(135deg, ${Y}, ${YD})`,
                      color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                      boxShadow: `0 0 0 3px ${Y}22, 0 6px 24px ${Y}35`,
                    }}
                  >
                    View Current Request
                  </button>
                  <button
                    onClick={() => setSosBlocked(false)}
                    style={{
                      width: '100%', height: 48, borderRadius: 14,
                      background: 'var(--surface-3)', border: '1.5px solid var(--border-3)',
                      color: 'var(--text-md)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    Go Back
                  </button>
                </div>

                <style>{`
                  @keyframes sos-blk-slide-up {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                  }
                  @keyframes sos-blk-ring {
                    0%   { transform: translate(-50%,-50%) scale(0.8); opacity: 0.8; }
                    80%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
                    100% { opacity: 0; }
                  }
                  @keyframes sos-blk-dot {
                    0%,100% { opacity: 1; transform: scale(1); }
                    50%     { opacity: 0.4; transform: scale(0.6); }
                  }
                `}</style>
              </div>
            </>
          );
        })()}

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between pt-8 pb-2">
          {/* Left — plate + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user?.number_plate && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                style={{
                  background: '#F59E0B', color: '#000', letterSpacing: '0.05em', cursor: 'default',
                  transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.background = '#FBBF24';
                  el.style.boxShadow = '0 0 14px rgba(251,191,36,0.45)';
                  el.style.transform = 'scale(1.06)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = '#F59E0B';
                  el.style.boxShadow = 'none';
                  el.style.transform = 'scale(1)';
                }}
              >
                {user.number_plate}
              </div>
            )}
            {/* Online / Offline toggle */}
            <button
              onClick={() => setStatusPrompt(driverOnline ? 'going-offline' : 'going-online')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                background: driverOnline ? 'var(--status-online-bg)' : 'var(--status-offline-bg)',
                border: `1px solid ${driverOnline ? 'var(--status-online-border)' : 'var(--status-offline-border)'}`,
                color: driverOnline ? 'var(--status-online-color)' : 'var(--status-offline-color)',
                cursor: 'pointer',
                transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.background = driverOnline ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)';
                el.style.boxShadow = driverOnline ? '0 0 10px rgba(34,197,94,0.2)' : '0 0 10px rgba(239,68,68,0.2)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                el.style.background = driverOnline ? 'var(--status-online-bg)' : 'var(--status-offline-bg)';
                el.style.boxShadow = 'none';
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: driverOnline ? 'var(--status-online-dot)' : 'var(--status-offline-dot)', animation: driverOnline ? 'blink 2s ease-in-out infinite' : 'none' }} />
              {driverOnline ? 'Online' : 'Offline'}
            </button>
          </div>

          {/* Right — theme capsule + profile avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Theme capsule toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              position: 'relative',
              width: 56, height: 28,
              borderRadius: 999,
              background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              border: '1px solid var(--border-3)',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              transition: 'background 0.25s ease, border-color 0.25s ease',
            }}
          >
            {/* Sun icon — left side */}
            <Sun style={{
              position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
              width: 12, height: 12,
              color: theme === 'light' ? '#F59E0B' : 'var(--text-md)',
              transition: 'color 0.25s ease',
            }} />
            {/* Moon icon — right side */}
            <Moon style={{
              position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
              width: 12, height: 12,
              color: theme === 'dark' ? '#818cf8' : 'var(--text-md)',
              transition: 'color 0.25s ease',
            }} />
            {/* Sliding knob */}
            <span style={{
              position: 'absolute',
              top: 3, bottom: 3,
              width: 22,
              borderRadius: 999,
              background: theme === 'dark' ? '#818cf8' : '#F59E0B',
              left: theme === 'dark' ? 'calc(100% - 25px)' : '3px',
              transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.25s ease',
              boxShadow: theme === 'dark' ? '0 0 8px rgba(129,140,248,0.5)' : '0 0 8px rgba(245,158,11,0.5)',
            }} />
          </button>

          {/* Notifications bell */}
          <button
            onClick={() => navigate('/notifications')}
            title="Notifications"
            style={{
              position: 'relative', width: 38, height: 38, borderRadius: '50%',
              border: '1px solid var(--border-3)', background: 'var(--surface-2)',
              color: 'var(--text-md)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              transition: 'background 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
          >
            <Bell style={{ width: 17, height: 17 }} />
            {unreadNotifs > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17,
                padding: '0 4px', borderRadius: 999, background: '#EF4444', color: '#fff',
                fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center',
                justifyContent: 'center', border: '2px solid var(--page-bg)',
              }}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
            )}
          </button>

          {/* Profile avatar */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                border: '2px solid rgba(245,158,11,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 3px rgba(245,158,11,0.12)',
                fontSize: 13, fontWeight: 900, color: '#000', letterSpacing: '0.04em',
                transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget;
                b.style.background = 'linear-gradient(135deg, #FBBF24, #F59E0B)';
                b.style.borderColor = 'rgba(251,191,36,0.8)';
                b.style.boxShadow = '0 0 0 4px rgba(251,191,36,0.25), 0 0 18px rgba(245,158,11,0.4)';
                b.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={e => {
                const b = e.currentTarget;
                b.style.background = 'linear-gradient(135deg, #F59E0B, #D97706)';
                b.style.borderColor = 'rgba(245,158,11,0.4)';
                b.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.12)';
                b.style.transform = 'scale(1)';
              }}
            >
              {initials}
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <>
                {/* Backdrop to close */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setDropdownOpen(false)}
                />
                <div style={{
                  position: 'absolute', top: 46, right: 0, zIndex: 50,
                  width: 200,
                  background: 'var(--overlay-bg)',
                  border: '1px solid var(--border-3)',
                  borderRadius: 16,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                }}>
                  {/* Driver info header */}
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-2)' }}>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>{user?.full_name ?? 'Driver'}</p>
                    <p style={{ color: 'rgba(245,158,11,0.7)', fontSize: 11, marginTop: 3 }}>{user?.phone}</p>
                  </div>
                  {/* Menu items */}
                  {[
                    { label: 'My Profile',  icon: User,             action: () => { setDropdownOpen(false); navigate('/profile'); } },
                    { label: 'Settings',    icon: SlidersHorizontal, action: () => { setDropdownOpen(false); navigate('/settings'); } },
                    { label: 'Refresh',     icon: RefreshCw,         action: () => { setDropdownOpen(false); window.location.reload(); } },
                  ].map(({ label, icon: Icon, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className="w-full flex items-center gap-3 transition-colors"
                      style={{
                        padding: '11px 16px', cursor: 'pointer', border: 'none',
                        background: 'transparent', textAlign: 'left',
                        borderBottom: '1px solid var(--border-1)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Icon style={{ width: 15, height: 15, color: 'var(--text-lo)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-md)', fontSize: 13, fontWeight: 600 }}>{label}</span>
                    </button>
                  ))}
                  {/* Logout — red tint */}
                  <button
                    onClick={() => { setDropdownOpen(false); logout(); navigate('/welcome'); }}
                    className="w-full flex items-center gap-3 transition-colors"
                    style={{ padding: '11px 16px', cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0 }} />
                    <span style={{ color: '#f87171', fontSize: 13, fontWeight: 600 }}>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
          </div>{/* end theme capsule + avatar flex */}
        </div>

        {/* ── Editorial headline ── */}
        <div style={{ paddingTop: 20, paddingBottom: 22 }}>
          <p className="mf-brand-label" style={{ color: 'rgba(245,158,11,0.75)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 6 }}>
            MOTOFIX · Roadside Assistance
          </p>
          <h1 style={{
            color: 'var(--text-hi)',
            fontWeight: 900,
            fontSize: 38,
            letterSpacing: '-0.03em',
            lineHeight: 1.0,
            marginBottom: 10,
          }}>
            <span className="mf-headline-question" style={{ color: '#ff2d2d', textShadow: '0 0 40px rgba(255,45,45,0.3)' }}>{question}</span>
            <br /><span className="mf-headline-name" style={{ display: 'inline-block', marginTop: 6, color: 'var(--text-hi)' }}>{firstName.toUpperCase()}.</span>
          </h1>
          <p className="mf-subtitle" style={{ color: 'var(--text-md)', fontSize: 12, lineHeight: 1.5 }}>
            {hasActive ? '1 request in progress' : 'No requests in progress at the moment'}
          </p>
        </div>

        {/* ── Rate mechanic nudge banner ── */}
        {pendingReview && (
          <div style={{
            borderRadius: 18,
            background: 'rgba(245,158,11,0.09)',
            border: '1.5px solid rgba(245,158,11,0.35)',
            padding: '14px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Star style={{ width: 18, height: 18, color: '#F59E0B', fill: '#F59E0B' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 2 }}>
                How was {pendingReview.mechanicName}?
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-lo)', lineHeight: 1.4 }}>
                A quick rating helps us match you with the best mechanics.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => {
                  dismissReview();
                  navigate('/rate-motofix', { state: { mode: 'mechanic', requestId: pendingReview.requestId, mechanicName: pendingReview.mechanicName } });
                }}
                style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: '#F59E0B', color: '#111', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Rate now
              </button>
              <button
                onClick={dismissReview}
                style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-3)', background: 'var(--surface-3)', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                aria-label="Dismiss"
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}

        {/* ── Active Requests card ── */}
        {(() => {
          const req    = activeReq;
          const st     = req ? (STATUS[req.status] ?? STATUS.pending) : null;
          const hasReq = hasActive;
          return (
            <div className="mb-5" style={{ position: 'relative' }}>
              <div
                onClick={() => hasReq && navigate(`/requests/${req!.id}`)}
                style={{
                  position: 'relative',
                  borderRadius: 22,
                  background: (hasReq && isDark) ? st!.bg : 'var(--surface-1)',
                  border: `1.5px solid ${isDark ? (hasReq ? st!.border : 'var(--border-2)') : '#000'}`,
                  boxShadow: (hasReq && isDark) ? `0 0 28px ${st!.bg}` : 'none',
                  padding: '18px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  cursor: hasReq ? 'pointer' : 'default',
                  transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                }}
                onMouseEnter={e => { if (hasReq) { e.currentTarget.style.transform = 'scale(1.012)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {/* Red badge */}
                {hasReq && (
                  <div style={{
                    position: 'absolute', top: -9, right: -9,
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#dc2626',
                    border: '2.5px solid var(--page-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 900, color: '#fff',
                    boxShadow: '0 0 8px rgba(220,38,38,0.5)',
                  }}>
                    1
                  </div>
                )}
                {/* Icon */}
                <div style={{
                  width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                  background: hasReq ? `${isDark ? st!.color : st!.lightColor}18` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'),
                  border: `1.5px solid ${hasReq ? (isDark ? st!.color + '40' : st!.lightColor + '60') : 'var(--border-2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Wrench style={{ width: 24, height: 24, color: hasReq ? (isDark ? st!.color : st!.lightColor) : (isDark ? 'var(--text-ghost)' : 'var(--text-md)') }} />
                </div>
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Active Requests</p>
                  <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 5, lineHeight: 1.4 }}>
                    {hasReq
                      ? <><span style={{ color: isDark ? st!.color : st!.lightColor, fontWeight: 700 }}>{st!.label}</span> — {req!.service_type} · tap to track</>
                      : 'No active requests — tap SOS to get help'}
                  </p>
                </div>
                {hasReq && <ChevronRight style={{ width: 20, height: 20, color: st!.color + '80', flexShrink: 0 }} />}
              </div>
            </div>
          );
        })()}

        {/* ── Offline banner ── */}
        {!driverOnline && (
          <div className="mb-4 rounded-2xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
            <p style={{ color: 'rgba(252,165,165,0.8)', fontSize: 12, lineHeight: 1.4 }}>
              You are <strong style={{ color: '#f87171' }}>offline</strong>. Most services are paused — only emergency medical services remain accessible.
            </p>
          </div>
        )}

        {/* ── SOS hero block — proper red ── */}
        <div
          onClick={() => !driverOnline ? undefined : goRequest()}
          className="relative rounded-3xl overflow-hidden mb-5"
          style={{
            background: driverOnline ? 'var(--sos-bg)' : '#3a1010',
            boxShadow: driverOnline ? 'var(--sos-shadow)' : 'none',
            border: isDark ? (driverOnline ? '1.5px solid var(--sos-border-color)' : '1px solid rgba(239,68,68,0.15)') : '1.5px solid #000',
            cursor: driverOnline ? 'pointer' : 'not-allowed',
            opacity: driverOnline ? 1 : 0.5,
            transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
          }}
          onMouseEnter={e => {
            if (!driverOnline) return;
            const el = e.currentTarget;
            el.style.background = 'var(--sos-hover-bg)';
            el.style.boxShadow = 'var(--sos-hover-shadow)';
            el.style.transform = 'scale(1.015)';
          }}
          onMouseLeave={e => {
            if (!driverOnline) return;
            const el = e.currentTarget;
            el.style.background = 'var(--sos-bg)';
            el.style.boxShadow = 'var(--sos-shadow)';
            el.style.transform = 'scale(1)';
          }}
        >
          {/* Top sheen — dark mode only */}
          {isDark && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'var(--border-4)' }} />}

          <div className="relative flex items-center justify-between px-6 py-5">
            <div>
              <p style={{ color: 'var(--sos-label)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 6, textShadow: 'var(--sos-text-shadow)' }}>
                Emergency Dispatch
              </p>
              <p style={{ color: 'var(--sos-title)', fontWeight: 900, fontSize: 32, letterSpacing: '0.06em', lineHeight: 1, textShadow: 'var(--sos-text-shadow)' }}>SOS</p>
              <p style={{ color: 'var(--sos-sub)', fontSize: 11, marginTop: 6, textShadow: 'var(--sos-text-shadow)' }}>
                {hasActive ? '1 request active' : 'Tap to dispatch the nearest responder'}
              </p>
            </div>
            {/* Target rings */}
            <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
              {[64, 48].map((s, i) => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: s, height: s, borderRadius: '50%',
                  border: `1.5px solid var(${i === 0 ? '--sos-ring-1' : '--sos-ring-2'})`,
                  transform: 'translate(-50%,-50%)',
                  animation: `sosRing ${1.6 + i * 0.5}s ease-out ${i * 0.4}s infinite`,
                }} />
              ))}
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--sos-dot-bg)',
                border: '2px solid var(--sos-dot-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ChevronRight style={{ width: 16, height: 16, color: 'var(--sos-title)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── All services — editorial ruled list ── */}
        <div className="mb-5">
          <p className="mf-label" style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 12 }}>
            Available Services
          </p>
          <div style={{ background: 'var(--surface-1)', border: isDark ? '1px solid var(--border-2)' : '1px solid #000', borderRadius: 20, overflow: 'hidden' }}>
            {ALL_SERVICES.map(({ id, label, icon: Icon, color, desc }, i) => {
              const isHovered = hoveredService === id;
              // When offline, only ambulance and spare-parts browsing stay active
              const isLocked = !driverOnline && id !== 'ambulance' && id !== 'spare_parts';
              const effectiveColor = isLocked ? '#444' : color;
              return (
                <div
                  key={id}
                  onClick={() => {
                    if (isLocked) return;
                    if (id === 'ambulance') navigate('/emergency');
                    else if (id === 'insurance') navigate('/insurance');
                    else if (id === 'spare_parts') navigate('/spare-parts');
                    else if (id === 'mechanic' || id === 'towing') goRequest(id);
                  }}
                  onMouseEnter={() => !isLocked && setHoveredService(id)}
                  onMouseLeave={() => setHoveredService(null)}
                  style={{
                    padding: '16px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: i < ALL_SERVICES.length - 1 ? '1px solid var(--border-2)' : 'none',
                    background: isLocked ? 'rgba(255,255,255,0.01)' : isHovered ? `${color}12` : 'transparent',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.38 : 1,
                    transition: 'background 0.2s ease, opacity 0.2s ease',
                  }}
                >
                  {/* Colored rule */}
                  <div style={{
                    width: isHovered ? 4 : 3, height: 46, borderRadius: 2, flexShrink: 0,
                    background: effectiveColor,
                    boxShadow: (!isLocked && isHovered) ? `0 0 14px ${color}80` : `0 0 6px ${effectiveColor}30`,
                    transition: 'all 0.2s ease',
                  }} />
                  {/* Icon */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: (!isLocked && isHovered) ? `${color}25` : `${effectiveColor}12`,
                    border: `1.5px solid ${(!isLocked && isHovered) ? color + '60' : effectiveColor + '25'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}>
                    <Icon style={{ width: 20, height: 20, color: effectiveColor }} />
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 16, lineHeight: 1, transition: 'color 0.2s' }}>{label}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4, lineHeight: 1.3 }}>{desc}</p>
                  </div>
                  {/* Lock icon or arrow */}
                  {isLocked
                    ? <span style={{ fontSize: 13, flexShrink: 0 }}>🔒</span>
                    : <ChevronRight style={{ width: 16, height: 16, color: isHovered ? `${color}90` : 'var(--text-ghost)', flexShrink: 0, transition: 'color 0.2s' }} />
                  }
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Service History card ── */}
        <p className="mf-label" style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 12 }}>
          Service History
        </p>
        <div
          onClick={() => navigate('/history')}
          style={{
            borderRadius: 22,
            background: 'var(--surface-1)',
            border: isDark ? '1px solid var(--border-2)' : '1px solid #000',
            padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            cursor: 'pointer', marginBottom: 20,
            transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.background = 'rgba(245,158,11,0.06)';
            el.style.borderColor = 'rgba(245,158,11,0.22)';
            el.style.transform = 'scale(1.012)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.background = 'var(--surface-1)';
            el.style.borderColor = isDark ? 'var(--border-2)' : '#000';
            el.style.transform = 'scale(1)';
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock style={{ width: 24, height: 24, color: '#F59E0B' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Service History</p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 5, lineHeight: 1.4 }}>
              {history.length > 0
                ? `${history.length} past request${history.length > 1 ? 's' : ''} — tap to view all`
                : 'Your completed & cancelled requests will appear here'}
            </p>
          </div>
          <ChevronRight style={{ width: 20, height: 20, color: 'rgba(245,158,11,0.5)', flexShrink: 0 }} />
        </div>

        {/* ── Reminders trigger card ── */}
        <p className="mf-label" style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 12 }}>
          Reminders
        </p>
        <div
          onClick={() => navigate('/reminders')}
          style={{
            borderRadius: 22,
            background: 'rgba(245,158,11,0.06)',
            border: isDark ? '1px solid rgba(245,158,11,0.18)' : '1px solid #000',
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            cursor: 'pointer', marginBottom: 28,
            transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.background = 'rgba(245,158,11,0.11)';
            el.style.borderColor = 'rgba(245,158,11,0.32)';
            el.style.transform = 'scale(1.012)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.background = 'rgba(245,158,11,0.06)';
            el.style.borderColor = isDark ? 'rgba(245,158,11,0.18)' : '#000';
            el.style.transform = 'scale(1)';
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <span style={{ fontSize: 24 }}>🔔</span>
            {/* Badge */}
            {remindersPending > 0 && (
              <div style={{
                position: 'absolute', top: -4, right: -4,
                minWidth: 18, height: 18, borderRadius: 9, padding: '0 4px',
                background: '#dc2626', border: '2px solid var(--page-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: 'var(--text-hi)',
              }}>{remindersPending > 99 ? '99+' : remindersPending}</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>Reminders</p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 5, lineHeight: 1.4 }}>
              {remindersPending > 0 ? `${remindersPending} due now — tap to review` : 'All checks done for now — great job!'}
            </p>
          </div>
          <ChevronRight style={{ width: 20, height: 20, color: 'rgba(245,158,11,0.5)', flexShrink: 0 }} />
        </div>

        {/* ── Quick How-To ── */}
        <p className="mf-label" style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 12 }}>
          Driver's Handbook — Fix it Yourself
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
          {GUIDES.map(guide => {
            const GIcon = guide.icon;
            return (
            <button
              key={guide.id}
              onClick={() => setSelectedGuide(guide)}
              style={{
                background: 'var(--surface-1)',
                border: isDark ? '1px solid var(--border-2)' : '1px solid #000',
                borderRadius: 18, padding: '16px 14px',
                textAlign: 'left', cursor: 'pointer',
                transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${guide.color}10`;
                e.currentTarget.style.borderColor = `${guide.color}40`;
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--surface-1)';
                e.currentTarget.style.borderColor = isDark ? 'var(--border-2)' : '#000';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${guide.color}18`, border: `1.5px solid ${guide.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <GIcon style={{ width: 18, height: 18, color: guide.color }} />
              </div>
              <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 13, lineHeight: 1.3, marginBottom: 6 }}>{guide.title}</p>
              <p style={{ color: guide.color, fontSize: 10.5, fontWeight: 700 }}>{guide.steps.length} steps →</p>
            </button>
            );
          })}
        </div>

      </div>

      {/* ── Guide detail modal ── */}
      {selectedGuide && <GuideModal guide={selectedGuide} onClose={() => setSelectedGuide(null)} />}

      <style>{`
        @keyframes sosRing {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.8; }
          80%  { transform: translate(-50%,-50%) scale(2.1); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

        /* ── Global hover-brighten rules ── */
        .mf-label {
          transition: color 0.18s ease;
        }
        .mf-label:hover {
          color: var(--text-hi) !important;
        }
        .mf-subtitle {
          transition: color 0.18s ease;
          cursor: default;
        }
        .mf-subtitle:hover {
          color: var(--text-md) !important;
        }
        .mf-stat-card {
          transition: background 0.18s ease, border-color 0.18s ease;
          cursor: default;
        }
        .mf-stat-card:hover {
          background: var(--surface-4) !important;
          border-color: var(--border-3) !important;
        }
        .mf-stat-card:hover span {
          color: var(--text-hi) !important;
        }
        .mf-history-row {
          transition: background 0.15s ease;
        }
        .mf-history-row:hover {
          background: var(--surface-3) !important;
        }
        .mf-history-row:hover p {
          color: var(--text-hi) !important;
        }
        .mf-headline-name {
          transition: color 0.18s ease, text-shadow 0.18s ease;
          cursor: default;
        }
        .mf-headline-name:hover {
          color: var(--text-hi) !important;
        }
        .mf-brand-label {
          transition: color 0.18s ease, text-shadow 0.18s ease;
          cursor: default;
        }
        .mf-brand-label:hover {
          color: #F59E0B !important;
          text-shadow: 0 0 16px rgba(245,158,11,0.55), 0 0 32px rgba(245,158,11,0.25);
        }
        .mf-headline-question {
          transition: color 0.18s ease, text-shadow 0.18s ease;
          cursor: default;
        }
        .mf-headline-question:hover {
          color: #cc1515 !important;
          text-shadow: 0 0 24px rgba(204,21,21,0.65), 0 0 48px rgba(204,21,21,0.35);
        }
      `}</style>

    </div>
  );
}
