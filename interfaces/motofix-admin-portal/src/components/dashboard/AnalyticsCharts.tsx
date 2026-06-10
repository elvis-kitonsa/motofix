import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, ReferenceLine,
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { Wrench, Calendar, TrendingUp, X } from 'lucide-react';

// ── Sample data ────────────────────────────────────────────────────────────────

const SERVICES_DATA = [
  { name: 'Tyre Change',      count: 312 },
  { name: 'Battery Jump',     count: 274 },
  { name: 'Towing',           count: 198 },
  { name: 'Fuel Delivery',    count: 163 },
  { name: 'Engine Check',     count: 141 },
  { name: 'Flat Tyre Repair', count: 118 },
  { name: 'Oil Change',       count:  89 },
  { name: 'Lockout Service',  count:  72 },
];

const DOW_DATA = [
  { day: 'Monday',    short: 'Mon', cases: 94  },
  { day: 'Tuesday',   short: 'Tue', cases: 78  },
  { day: 'Wednesday', short: 'Wed', cases: 83  },
  { day: 'Thursday',  short: 'Thu', cases: 71  },
  { day: 'Friday',    short: 'Fri', cases: 112 },
  { day: 'Saturday',  short: 'Sat', cases: 137 },
  { day: 'Sunday',    short: 'Sun', cases: 101 },
];

const WEEKLY_DATA = (() => {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() - (11 - i) * 7);
    const label     = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const base      = 72 + i * 3.2;
    const noise     = Math.sin(i * 1.3) * 12 + Math.cos(i * 0.8) * 8;
    const cases     = Math.round(Math.max(40, base + noise));
    const completed = Math.round(Math.max(30, cases * (0.78 + Math.sin(i) * 0.06)));
    return { label, cases, completed };
  });
})();

// ── Shared detail modal ────────────────────────────────────────────────────────

interface ModalRow { label: string; value: string | number; pct: number; color: string }

interface ModalConfig {
  icon: React.ReactNode;
  accentColor: string;
  title: string;
  description: string;
  mainValue: string | number;
  mainLabel: string;
  rows: ModalRow[];
  footer?: string;
}

function DetailModal({ config, onClose }: { config: ModalConfig; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'dmFadeIn 0.18s ease',
      }}
    >
      <style>{`@keyframes dmFadeIn { from { opacity:0; transform:scale(0.96) } to { opacity:1; transform:scale(1) } }`}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--adm-surface)',
          border: '2px solid var(--adm-card-border)',
          boxShadow: 'var(--adm-popup-shadow)',
          borderRadius: 20, padding: '28px 30px',
          width: '100%', maxWidth: 460,
          position: 'relative',
          animation: 'dmFadeIn 0.18s ease',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--adm-surface-2)',
            border: '1px solid var(--adm-divider)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--adm-muted)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-red-dim)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--adm-red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--adm-surface-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--adm-muted)'; }}
        >
          <X size={15} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `${config.accentColor}18`,
            border: `1px solid ${config.accentColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: config.accentColor,
          }}>
            {config.icon}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--adm-text)', letterSpacing: '-0.3px' }}>
              {config.title}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--adm-muted)', marginTop: 1 }}>
              {config.description}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--adm-divider)', margin: '18px 0' }} />

        {/* Main metric */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--adm-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {config.mainLabel}
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, color: config.accentColor, letterSpacing: '-2px', lineHeight: 1 }}>
            {config.mainValue}
          </div>
        </div>

        {/* Breakdown rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {config.rows.map((row, i) => (
            <div key={row.label} style={{
              padding: '13px 0',
              borderBottom: i < config.rows.length - 1 ? '1px solid var(--adm-divider)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--adm-muted)', fontWeight: 500 }}>{row.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--adm-text)' }}>{row.value}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: `${row.color}18`, color: row.color,
                    border: `1px solid ${row.color}30`,
                    padding: '1px 7px', borderRadius: 20,
                  }}>{row.pct}%</span>
                </div>
              </div>
              <div style={{ height: 4, background: 'var(--adm-track-bg)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min(row.pct, 100)}%`,
                  background: row.color, borderRadius: 99,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {config.footer && (
          <div style={{
            marginTop: 18, padding: '10px 14px',
            background: `${config.accentColor}0d`,
            border: `1px solid ${config.accentColor}20`,
            borderRadius: 10,
            fontSize: 12, color: 'var(--adm-muted)', lineHeight: 1.6,
          }}>
            {config.footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared card shell ──────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--adm-surface)',
        border: '2px solid var(--adm-card-border)',
        boxShadow: 'var(--adm-card-shadow)',
        borderRadius: 16, padding: '24px 26px',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--adm-border-hi)';
        e.currentTarget.style.transform   = 'translateY(-3px)';
        e.currentTarget.style.boxShadow   = 'var(--adm-hover-shadow)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--adm-card-border)';
        e.currentTarget.style.transform   = 'translateY(0)';
        e.currentTarget.style.boxShadow   = 'var(--adm-card-shadow)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'var(--adm-amber-dim)',
          border: '1px solid rgba(255,179,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--adm-amber)',
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--adm-text)', lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--adm-muted)', marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Hover tooltips ─────────────────────────────────────────────────────────────

function ServiceTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--adm-popup-bg)', border: '1px solid var(--adm-popup-border)', borderRadius: 10, padding: '9px 13px', boxShadow: 'var(--adm-popup-shadow)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#FFB300' }}>{payload[0].value} requests</div>
      <div style={{ fontSize: 10.5, color: 'var(--adm-muted)', marginTop: 3 }}>Click for full breakdown</div>
    </div>
  );
}

function DowTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--adm-popup-bg)', border: '1px solid var(--adm-popup-border)', borderRadius: 10, padding: '9px 13px', boxShadow: 'var(--adm-popup-shadow)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--adm-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--adm-cyan)' }}>{payload[0].value} cases</div>
      <div style={{ fontSize: 10.5, color: 'var(--adm-muted)', marginTop: 3 }}>Click for full breakdown</div>
    </div>
  );
}

function WeeklyTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total     = payload.find(p => p.dataKey === 'cases')?.value     ?? 0;
  const completed = payload.find(p => p.dataKey === 'completed')?.value ?? 0;
  const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ background: 'var(--adm-popup-bg)', border: '1px solid var(--adm-popup-border)', borderRadius: 12, padding: '12px 16px', boxShadow: 'var(--adm-popup-shadow)', minWidth: 175 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--adm-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Week of {label}</div>
      {[
        { label: 'Total',     value: total,     color: '#FFB300' },
        { label: 'Completed', value: completed, color: 'var(--adm-green)' },
        { label: 'Rate',      value: `${rate}%`, color: 'var(--adm-green)' },
      ].map(row => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--adm-muted)' }}>{row.label}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: row.color }}>{row.value}</span>
        </div>
      ))}
      <div style={{ fontSize: 10.5, color: 'var(--adm-muted)', marginTop: 6, borderTop: '1px solid var(--adm-divider)', paddingTop: 6 }}>Click to see full breakdown</div>
    </div>
  );
}

// ── Charts ─────────────────────────────────────────────────────────────────────

function TopServicesChart() {
  const { isDark } = useTheme();
  const AMBER = '#FFB300';
  const MUTED = isDark ? '#6b6b82' : '#374151';
  const GRID  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const total = SERVICES_DATA.reduce((s, d) => s + d.count, 0);
  const max   = SERVICES_DATA[0].count;

  const [modal, setModal] = useState<ModalConfig | null>(null);

  const handleBarClick = (data: { name: string; count: number }) => {
    const rank  = SERVICES_DATA.findIndex(s => s.name === data.name) + 1;
    const share = Math.round((data.count / total) * 100);
    setModal({
      icon: <Wrench size={20} />,
      accentColor: AMBER,
      title: data.name,
      description: `Breakdown of requests for this service type`,
      mainValue: data.count,
      mainLabel: 'Total requests (all time)',
      rows: [
        { label: 'Share of all requests', value: `${share}%`,      pct: share,                              color: AMBER },
        { label: 'Rank among services',   value: `#${rank} of 8`,  pct: Math.round(((8 - rank + 1) / 8) * 100), color: isDark ? '#a78bfa' : '#7c3aed' },
        ...SERVICES_DATA.filter(s => s.name !== data.name).slice(0, 3).map(s => ({
          label: s.name,
          value: `${s.count} req`,
          pct: Math.round((s.count / max) * 100),
          color: MUTED,
        })),
      ],
      footer: `${data.name} accounts for ${share}% of all service requests on the platform.`,
    });
  };

  return (
    <>
      <ChartCard title="Top Services Requested" subtitle="All-time request distribution by service type — click a bar for details" icon={<Wrench size={15} />}>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SERVICES_DATA} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 10 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} width={110} />
              <Tooltip content={<ServiceTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={18} style={{ cursor: 'pointer' }} onClick={(data) => handleBarClick(data as { name: string; count: number })}>
                {SERVICES_DATA.map((entry, i) => (
                  <Cell key={i} fill={AMBER} fillOpacity={0.45 + (entry.count / max) * 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      {modal && <DetailModal config={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function DayOfWeekChart() {
  const { isDark } = useTheme();
  const CYAN  = isDark ? '#22d3ee' : '#0891b2';
  const MUTED = isDark ? '#6b6b82' : '#374151';
  const GRID  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const total = DOW_DATA.reduce((s, d) => s + d.cases, 0);
  const avg   = Math.round(total / DOW_DATA.length);
  const wdAvg = Math.round(DOW_DATA.slice(0, 5).reduce((s, d) => s + d.cases, 0) / 5);
  const weAvg = Math.round(DOW_DATA.slice(5).reduce((s, d) => s + d.cases, 0) / 2);

  const [modal, setModal] = useState<ModalConfig | null>(null);

  const handleBarClick = (data: { day: string; cases: number }) => {
    const share  = Math.round((data.cases / total) * 100);
    const vsAvg  = Math.round(((data.cases - avg) / avg) * 100);
    const isWeekend = ['Saturday', 'Sunday'].includes(data.day);
    setModal({
      icon: <Calendar size={20} />,
      accentColor: CYAN,
      title: data.day,
      description: `Average breakdown incident volume on ${data.day}s`,
      mainValue: data.cases,
      mainLabel: 'Average cases per day',
      rows: [
        { label: 'Share of weekly volume', value: `${share}%`, pct: share, color: CYAN },
        { label: 'vs. Daily average',      value: `${vsAvg > 0 ? '+' : ''}${vsAvg}%`, pct: Math.min(Math.abs(vsAvg), 100), color: vsAvg >= 0 ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626') },
        { label: 'Weekday avg',            value: `${wdAvg} cases`, pct: Math.round((wdAvg / (isWeekend ? weAvg : wdAvg)) * 100), color: MUTED },
        { label: 'Weekend avg',            value: `${weAvg} cases`, pct: Math.round((weAvg / Math.max(wdAvg, weAvg)) * 100), color: '#f59e0b' },
      ],
      footer: `${data.day} is ${vsAvg >= 0 ? 'above' : 'below'} the daily average by ${Math.abs(vsAvg)}% with ${data.cases} avg cases.`,
    });
  };

  return (
    <>
      <ChartCard title="Cases by Day of Week" subtitle="Average breakdown incidents per weekday — click a bar for details" icon={<Calendar size={15} />}>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DOW_DATA} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="dowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={CYAN} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="short" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} dy={6} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} />
              <Tooltip content={<DowTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="cases" fill="url(#dowGrad)" radius={[5, 5, 0, 0]} maxBarSize={44} style={{ cursor: 'pointer' }} onClick={(data) => handleBarClick(data as { day: string; cases: number })} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      {modal && <DetailModal config={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function WeeklyTrendChart() {
  const { isDark } = useTheme();
  const AMBER  = '#FFB300';
  const GREEN  = isDark ? '#34d399' : '#059669';
  const ORANGE = '#f59e0b';
  const MUTED  = isDark ? '#6b6b82' : '#374151';
  const GRID   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const avgCases   = Math.round(WEEKLY_DATA.reduce((s, d) => s + d.cases, 0) / WEEKLY_DATA.length);
  const totalCases = WEEKLY_DATA.reduce((s, d) => s + d.cases, 0);
  const avgRate    = Math.round(WEEKLY_DATA.reduce((s, d) => s + d.completed / d.cases, 0) / WEEKLY_DATA.length * 100);

  const [modal, setModal] = useState<ModalConfig | null>(null);

  const handleChartClick = (chartData: { activePayload?: { payload: { label: string; cases: number; completed: number } }[] }) => {
    if (!chartData?.activePayload?.length) return;
    const d         = chartData.activePayload[0].payload;
    const pending   = d.cases - d.completed;
    const rate      = Math.round((d.completed / d.cases) * 100);
    const pendingPct = Math.round((pending / d.cases) * 100);
    const vsAvg     = Math.round(((d.cases - avgCases) / avgCases) * 100);
    setModal({
      icon: <TrendingUp size={20} />,
      accentColor: AMBER,
      title: `Week of ${d.label}`,
      description: 'Breakdown case summary for this week',
      mainValue: d.cases,
      mainLabel: 'Total cases this week',
      rows: [
        { label: 'Completed',        value: d.completed,   pct: rate,        color: GREEN  },
        { label: 'Pending / Open',   value: pending,       pct: pendingPct,  color: ORANGE },
        { label: 'vs. 12-week avg',  value: `${vsAvg > 0 ? '+' : ''}${vsAvg}%`, pct: Math.min(Math.abs(vsAvg), 100), color: vsAvg >= 0 ? GREEN : (isDark ? '#f87171' : '#dc2626') },
      ],
      footer: `Completion rate this week: ${rate}%. Overall 12-week average: ${avgCases} cases/week.`,
    });
  };

  return (
    <>
      <ChartCard title="Weekly Cases Trend" subtitle="Breakdown cases handled vs completed — last 12 weeks — click a point for details" icon={<TrendingUp size={15} />}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total (12 wks)', value: totalCases, color: AMBER },
            { label: 'Avg per week',   value: avgCases,   color: MUTED },
            { label: 'Avg completion', value: `${avgRate}%`, color: GREEN },
          ].map(pill => (
            <div key={pill.label} style={{
              padding: '7px 14px', borderRadius: 8,
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: '1px solid var(--adm-divider)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: pill.color }}>{pill.value}</span>
              <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{pill.label}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={WEEKLY_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
              <defs>
                <linearGradient id="wkAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={AMBER} stopOpacity={isDark ? 0.3 : 0.18} />
                  <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="wkGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={GREEN} stopOpacity={isDark ? 0.25 : 0.14} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11, fontWeight: 500 }} dy={8} interval={1} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} width={38} domain={[0, 'auto']} />
              <Tooltip content={<WeeklyTooltip />} cursor={{ stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeWidth: 1.5, strokeDasharray: '4 3' }} />
              <ReferenceLine y={avgCases} stroke={AMBER} strokeDasharray="6 4" strokeWidth={1} strokeOpacity={0.45} />
              <Area dataKey="cases"     type="monotoneX" stroke={AMBER} strokeWidth={2.5} fill="url(#wkAmber)" dot={{ r: 3.5, fill: AMBER, stroke: isDark ? '#1e1e2e' : '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: AMBER, stroke: isDark ? '#1e1e2e' : '#fff', strokeWidth: 2 }} />
              <Area dataKey="completed" type="monotoneX" stroke={GREEN} strokeWidth={2.5} fill="url(#wkGreen)" dot={{ r: 3.5, fill: GREEN, stroke: isDark ? '#1e1e2e' : '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: GREEN, stroke: isDark ? '#1e1e2e' : '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 14, justifyContent: 'center' }}>
          {[
            { label: 'Total Cases', color: AMBER },
            { label: 'Completed',   color: GREEN },
            { label: `Avg (${avgCases}/wk)`, color: AMBER, dashed: true },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {item.dashed
                ? <div style={{ width: 22, height: 0, borderTop: `2px dashed ${item.color}`, opacity: 0.5 }} />
                : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                    <div style={{ width: 14, height: 2.5, borderRadius: 99, background: item.color }} />
                  </div>
              }
              <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </ChartCard>
      {modal && <DetailModal config={modal} onClose={() => setModal(null)} />}
    </>
  );
}

// ── Exported section ───────────────────────────────────────────────────────────

export function AnalyticsCharts() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <TopServicesChart />
        <DayOfWeekChart />
      </div>
      <WeeklyTrendChart />
    </div>
  );
}
