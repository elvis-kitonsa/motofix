// Reminders.tsx — the vehicle maintenance checklist screen: daily/weekly/monthly checks
// plus do's & don'ts (from lib/reminders). The driver ticks items off; due items drive
// the Home badge and the reminder nudges. Supports adding custom items.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCcw, Sparkles, Plus, Trash2, RefreshCw, X, Check, Settings } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import {
  SECTIONS,
  CHECKED_KEY,
  CUSTOM_KEY,
  loadSettings,
  isItemSatisfied,
  type CheckedMap,
  type Cadence,
} from '@/lib/reminders';

// Re-exported so existing importers (e.g. Home's badge) keep working.
export { SECTIONS } from '@/lib/reminders';

/* ─── AI reminder pool ─────────────────────────────────────── */
const AI_POOL = [
  { id: 'ai_1',  text: 'Engine oil changes are due every 5,000 km — check your odometer today.',         category: 'Engine'      },
  { id: 'ai_2',  text: 'Uganda\'s rainy season increases road hazards — inspect wiper blades now.',       category: 'Safety'      },
  { id: 'ai_3',  text: 'Tyre pressure drops in cold mornings — check before your first trip.',            category: 'Tyres'       },
  { id: 'ai_4',  text: 'Battery life averages 3–5 years. If your car is slow to start, get it tested.',   category: 'Battery'     },
  { id: 'ai_5',  text: 'Confirm your comprehensive insurance is active and covers roadside incidents.',    category: 'Insurance'   },
  { id: 'ai_6',  text: 'Brake pads wear faster in stop-and-go city traffic — schedule an inspection.',    category: 'Brakes'      },
  { id: 'ai_7',  text: 'A clean air filter improves fuel efficiency by up to 10% — check monthly.',       category: 'Engine'      },
  { id: 'ai_8',  text: 'Carry a reflective triangle and safety vest — it\'s a legal requirement in Uganda.', category: 'Safety'   },
  { id: 'ai_9',  text: 'Wheel alignment should be checked every 10,000 km or after hitting a pothole.',   category: 'Tyres'       },
  { id: 'ai_10', text: 'Coolant flush is recommended every 2 years to prevent engine overheating.',       category: 'Engine'      },
  { id: 'ai_11', text: 'Transmission fluid should be checked if you notice rough or delayed gear shifts.', category: 'Drivetrain' },
  { id: 'ai_12', text: 'Power steering fluid low? Difficulty turning is an early warning sign.',          category: 'Steering'    },
  { id: 'ai_13', text: 'If your fuel consumption has increased recently, have your injectors cleaned.',   category: 'Fuel'        },
  { id: 'ai_14', text: 'Spark plugs typically need replacing every 30,000 km — check your service records.', category: 'Engine'  },
  { id: 'ai_15', text: 'Driving with a cracked windscreen is illegal and dangerous — repair it promptly.', category: 'Safety'    },
  { id: 'ai_16', text: 'Exhaust smoke colour matters: blue = oil burn, white = coolant leak, black = fuel.', category: 'Engine'  },
  { id: 'ai_17', text: 'Your emergency contacts in MOTOFIX should include a trusted mechanic\'s number.',  category: 'Preparedness' },
  { id: 'ai_18', text: 'Keep a small amount of engine oil and coolant in your boot for long trips.',      category: 'Preparedness' },
  { id: 'ai_19', text: 'Horn not working? It\'s a safety device — get it fixed before your next drive.',  category: 'Safety'      },
  { id: 'ai_20', text: 'Headlight alignment matters at night — misaligned beams reduce visibility greatly.', category: 'Safety'  },
];

const CATEGORY_COLOR: Record<string, string> = {
  Engine: '#F59E0B', Safety: '#F87171', Tyres: '#60A5FA', Battery: '#FCD34D',
  Insurance: '#34D399', Brakes: '#FB923C', Drivetrain: '#A78BFA', Steering: '#38BDF8',
  Fuel: '#4ADE80', Preparedness: '#E879F9',
};

function pickAiReminders(count = 5): typeof AI_POOL {
  const shuffled = [...AI_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/* ─── Storage keys (CHECKED_KEY / CUSTOM_KEY now come from lib/reminders) ─── */
const AI_KEY        = 'motofix_ai_reminders';

/* ─── Types ────────────────────────────────────────────────── */
interface CustomReminder {
  id: string;
  text: string;
  checked: boolean;
  createdAt: number;
}

interface AiReminder {
  id: string;
  text: string;
  category: string;
  dismissed: boolean;
}

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

/* ─── Main page ────────────────────────────────────────────── */
export default function Reminders() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  /* checklist checked state */
  const [checked, setChecked]   = useState<CheckedMap>(() => loadJson(CHECKED_KEY, {}));
  const [expandedSection, setExpandedSection] = useState<string | null>('daily');

  /* muted sections come from Reminder Settings — hidden from the checklist */
  const [mutedSections, setMutedSections] = useState<string[]>(() => loadSettings().mutedSections);
  useEffect(() => {
    const sync = () => setMutedSections(loadSettings().mutedSections);
    window.addEventListener('motofix:reminder-settings', sync);
    return () => window.removeEventListener('motofix:reminder-settings', sync);
  }, []);
  const visibleSections = SECTIONS.filter(s => !mutedSections.includes(s.key));

  /* custom reminders */
  const [custom, setCustom]     = useState<CustomReminder[]>(() => loadJson(CUSTOM_KEY, []));
  const [addOpen, setAddOpen]   = useState(false);
  const [draft, setDraft]       = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* AI reminders */
  const [aiItems, setAiItems]   = useState<AiReminder[]>(() => {
    const saved = loadJson<AiReminder[] | null>(AI_KEY, null);
    if (saved && saved.length > 0) return saved;
    return pickAiReminders(5).map(r => ({ ...r, dismissed: false }));
  });
  const [aiLoading, setAiLoading] = useState(false);

  /* persist on change — also nudge the Home badge to recompute (same-tab) */
  useEffect(() => {
    localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
    window.dispatchEvent(new Event('motofix:reminders-changed'));
  }, [checked]);
  useEffect(() => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    window.dispatchEvent(new Event('motofix:reminders-changed'));
  }, [custom]);
  useEffect(() => { localStorage.setItem(AI_KEY, JSON.stringify(aiItems)); }, [aiItems]);

  /* focus textarea when add panel opens */
  useEffect(() => { if (addOpen) setTimeout(() => inputRef.current?.focus(), 60); }, [addOpen]);

  /* checklist helpers — ticking stores a timestamp so recurring checks reset
     once their period (day / week / month) rolls over */
  const toggleCheck = (id: string, cadence: Cadence) => setChecked(p => {
    const next = { ...p };
    if (isItemSatisfied(cadence, p, id)) delete next[id];
    else next[id] = new Date().toISOString();
    return next;
  });
  const resetAll    = () => { setChecked({}); setCustom(c => c.map(r => ({ ...r, checked: false }))); };

  /* custom reminder helpers */
  const addCustom = () => {
    const text = draft.trim();
    if (!text) return;
    const next: CustomReminder = { id: `c_${Date.now()}`, text, checked: false, createdAt: Date.now() };
    setCustom(p => [next, ...p]);
    setDraft('');
    setAddOpen(false);
  };
  const toggleCustom = (id: string) =>
    setCustom(p => p.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
  const deleteCustom = (id: string) =>
    setCustom(p => p.filter(r => r.id !== id));

  /* AI helpers */
  const refreshAi = () => {
    setAiLoading(true);
    setTimeout(() => {
      setAiItems(pickAiReminders(5).map(r => ({ ...r, dismissed: false })));
      setAiLoading(false);
    }, 1200);
  };
  const dismissAi = (id: string) =>
    setAiItems(p => p.map(r => r.id === id ? { ...r, dismissed: true } : r));

  /* progress (due-aware: an item counts as done only for its current period) */
  const totalItems    = visibleSections.reduce((n, s) => n + s.items.length, 0);
  const totalDone     = visibleSections.reduce((n, s) => n + s.items.filter(i => isItemSatisfied(s.cadence, checked, i.id)).length, 0);
  const customDone    = custom.filter(r => r.checked).length;
  const grandTotal    = totalItems + custom.length;
  const grandDone     = totalDone + customDone;
  const pct           = grandTotal > 0 ? Math.round((grandDone / grandTotal) * 100) : 0;
  const visibleAi     = aiItems.filter(r => !r.dismissed);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', paddingBottom: 120 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 52, paddingBottom: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', color: 'var(--text-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-3)'; }}
          >
            <ChevronLeft style={{ width: 18, height: 18 }} />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'rgba(245,158,11,0.75)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 2 }}>
              MOTOFIX · Reminders
            </p>
            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Driver Checklist
            </h1>
          </div>
          <button
            onClick={() => navigate('/reminder-settings')}
            title="Reminder settings"
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', color: 'var(--text-lo)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s ease, color 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.14)'; e.currentTarget.style.color = '#F59E0B'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.color = 'var(--text-lo)'; }}
          >
            <Settings style={{ width: 16, height: 16 }} />
          </button>
          <button
            onClick={resetAll}
            title="Reset all"
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', color: 'var(--text-lo)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s ease, color 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.color = 'var(--text-lo)'; }}
          >
            <RotateCcw style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* ── Progress card ── */}
        <div style={{ marginTop: 20, marginBottom: 24, background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 18, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <p style={{ color: 'var(--text-md)', fontSize: 13, fontWeight: 700 }}>Overall progress</p>
            <p style={{ color: '#F59E0B', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
              {pct}<span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(245,158,11,0.6)', marginLeft: 1 }}>%</span>
            </p>
          </div>
          <div style={{ height: 7, borderRadius: 6, background: 'var(--surface-4)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 6, width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#4ADE80,#22C55E)' : 'linear-gradient(90deg,#F59E0B,#EAB308)', transition: 'width 0.4s ease' }} />
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8 }}>
            {grandDone} of {grandTotal} items checked
            {pct === 100 && <span style={{ color: '#4ADE80', marginLeft: 8, fontWeight: 700 }}>— All done! 🎉</span>}
          </p>
        </div>

        {/* ══════════════════════════════════════════
            AI SUGGESTIONS
        ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: 'linear-gradient(135deg,#A78BFA,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles style={{ width: 12, height: 12, color: 'var(--text-hi)' }} />
            </div>
            <p style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700 }}>
              AI Suggestions
            </p>
          </div>
          <button
            onClick={refreshAi}
            disabled={aiLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#A78BFA', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s ease', opacity: aiLoading ? 0.5 : 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.16)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.08)'; }}
          >
            <RefreshCw style={{ width: 11, height: 11, animation: aiLoading ? 'rm-spin 0.8s linear infinite' : 'none' }} />
            {aiLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div style={{ borderRadius: 20, overflow: 'hidden', background: isDark ? 'rgba(167,139,250,0.05)' : 'rgba(167,139,250,0.08)', border: `1.5px solid rgba(167,139,250,${isDark ? '0.15' : '0.40'})`, marginBottom: 24 }}>
          {visibleAi.length === 0 ? (
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>All suggestions dismissed — tap Refresh for new ones.</p>
            </div>
          ) : visibleAi.map((item, idx) => {
            const accent = CATEGORY_COLOR[item.category] ?? '#A78BFA';
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '13px 16px',
                  borderBottom: idx < visibleAi.length - 1 ? `1px solid var(${isDark ? '--border-1' : '--border-2'})` : 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ padding: '2px 7px', borderRadius: 6, background: `${accent}18`, border: `1px solid ${accent}${isDark ? '35' : '65'}`, color: accent, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', flexShrink: 0, marginTop: 2 }}>
                  {item.category.toUpperCase()}
                </span>
                <p style={{ flex: 1, color: 'var(--text-md)', fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>
                  {item.text}
                </p>
                <button
                  onClick={() => dismissAi(item.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: 'var(--text-faint)', transition: 'color 0.15s ease', marginTop: -2 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-ghost)'; }}
                  title="Dismiss"
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════
            MY REMINDERS
        ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700 }}>
            My Reminders
          </p>
          <button
            onClick={() => setAddOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: addOpen ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)', color: '#F59E0B', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = addOpen ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)'; }}
          >
            <Plus style={{ width: 11, height: 11 }} />
            Add reminder
          </button>
        </div>

        {/* Add reminder form */}
        {addOpen && (
          <div style={{ borderRadius: 16, background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.25)', padding: '14px 16px', marginBottom: 10, animation: 'rm-slide-in 0.22s ease both' }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCustom(); } if (e.key === 'Escape') { setAddOpen(false); setDraft(''); } }}
              placeholder="Describe your reminder… (Enter to save, Esc to cancel)"
              rows={2}
              style={{
                width: '100%', resize: 'none', background: 'var(--surface-3)',
                border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 10,
                padding: '10px 12px', color: 'var(--text-hi)', fontSize: 13, lineHeight: 1.5,
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.65)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={addCustom}
                disabled={!draft.trim()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: 'none', background: draft.trim() ? 'linear-gradient(135deg,#F59E0B,#D97706)' : 'var(--surface-4)', color: draft.trim() ? '#000' : 'var(--text-faint)', fontWeight: 800, fontSize: 13, cursor: draft.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.15s ease' }}
              >
                <Check style={{ width: 14, height: 14 }} /> Save
              </button>
              <button
                onClick={() => { setAddOpen(false); setDraft(''); }}
                style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: 'var(--text-lo)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Custom reminders list */}
        <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--surface-1)', border: '1px solid var(--border-2)', marginBottom: 24 }}>
          {custom.length === 0 ? (
            <div style={{ padding: '22px 18px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>No personal reminders yet.</p>
              <p style={{ color: 'var(--text-ghost)', fontSize: 11, marginTop: 4 }}>Tap "Add reminder" above to create one.</p>
            </div>
          ) : custom.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                borderBottom: idx < custom.length - 1 ? '1px solid var(--border-1)' : 'none',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleCustom(item.id)}
                style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: 'pointer',
                  border: `2px solid ${item.checked ? '#F59E0B' : 'var(--border-3)'}`,
                  background: item.checked ? '#F59E0B' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.18s ease',
                } as React.CSSProperties}
              >
                {item.checked && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6l2.5 2.5 4.5-5" stroke="var(--page-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              {/* Text */}
              <p style={{ flex: 1, color: item.checked ? 'var(--text-dim)' : 'var(--text-hi)', fontSize: 13, fontWeight: 600, lineHeight: 1.45, textDecoration: item.checked ? 'line-through' : 'none', transition: 'color 0.15s ease' }}>
                {item.text}
              </p>
              {/* Delete */}
              <button
                onClick={() => deleteCustom(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: 'var(--text-ghost)', transition: 'color 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-ghost)'; }}
                title="Delete reminder"
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            MAINTENANCE CHECKLIST
        ══════════════════════════════════════════ */}
        <p style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 10 }}>
          Maintenance Checklist
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleSections.map(section => {
            const isOpen     = expandedSection === section.key;
            const doneCount  = section.items.filter(i => isItemSatisfied(section.cadence, checked, i.id)).length;
            const allDone    = doneCount === section.items.length;
            const cadenceLabel = section.cadence === 'daily' ? 'Resets daily'
              : section.cadence === 'weekly' ? 'Resets every Monday'
              : section.cadence === 'monthly' ? 'Resets monthly'
              : 'Good to know';

            return (
              <div
                key={section.key}
                style={{ borderRadius: 20, background: isDark ? section.bg : section.bg.replace('0.07', '0.10'), border: `1.5px solid ${isOpen ? section.border.replace('0.18', isDark ? '0.42' : '0.60') : section.border.replace('0.18', isDark ? '0.18' : '0.45')}`, overflow: 'hidden', transition: 'border-color 0.2s ease' }}
              >
                <button
                  onClick={() => setExpandedSection(isOpen ? null : section.key)}
                  style={{ width: '100%', border: 'none', background: 'transparent', padding: '15px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', transition: 'background 0.18s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${section.accent}14`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: `${section.accent}18`, border: `1.5px solid ${section.accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {allDone ? '✅' : section.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 14, lineHeight: 1.1 }}>{section.label}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      <p style={{ color: 'var(--text-dim)', fontSize: 11 }}>{section.subtitle}</p>
                      <span style={{ color: section.accent, fontSize: 9, fontWeight: 700, opacity: 0.85, whiteSpace: 'nowrap' }}>· {cadenceLabel}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ padding: '3px 9px', borderRadius: 20, background: allDone ? 'rgba(74,222,128,0.15)' : `${section.accent}18`, color: allDone ? '#4ADE80' : section.accent, fontSize: 11, fontWeight: 800, border: `1px solid ${allDone ? 'rgba(74,222,128,0.3)' : section.accent + '30'}` }}>
                      {doneCount}/{section.items.length}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', color: 'var(--text-dim)' }}>
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: `1px solid ${section.border}`, padding: '10px 0 6px' }}>
                    {section.items.map((item, idx) => {
                      const done = isItemSatisfied(section.cadence, checked, item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleCheck(item.id, section.cadence)}
                          style={{ width: '100%', border: 'none', background: 'transparent', padding: '11px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', borderBottom: idx < section.items.length - 1 ? '1px solid var(--border-1)' : 'none', transition: 'background 0.15s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${section.accent}10`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: `2px solid ${done ? section.accent : 'var(--border-3)'}`, background: done ? section.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s ease' }}>
                            {done && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6l2.5 2.5 4.5-5" stroke={section.accent === '#F87171' ? '#fff' : 'var(--page-bg)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <p style={{ color: done ? 'var(--text-dim)' : 'var(--text-hi)', fontSize: 13, fontWeight: 600, lineHeight: 1.45, textDecoration: done ? 'line-through' : 'none', transition: 'color 0.15s ease', flex: 1 }}>
                            {item.text}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ color: 'var(--text-faint)', fontSize: 11, textAlign: 'center', lineHeight: 1.6, marginTop: 28, padding: '0 24px' }}>
          Your checklist progress is saved automatically and resets when you tap the ↺ button above.
        </p>

      </div>

      <style>{`
        @keyframes rm-spin    { to { transform: rotate(360deg); } }
        @keyframes rm-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
