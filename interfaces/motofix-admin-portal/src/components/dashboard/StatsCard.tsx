// StatsCard.tsx — a single headline-number tile on the dashboard (e.g. "Total requests"),
// with an optional up/down trend indicator and a loading skeleton while data arrives.

import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react';

// ── Navy palette (matching reference design) ──────────────────────────────────
const C = {
  surface:  'var(--adm-surface)',
  surface2: 'var(--adm-surface-2)',
  border:   'var(--adm-border)',
  amber:    'var(--adm-amber)',
  amberDim: 'var(--adm-amber-dim)',
  text:     'var(--adm-text)',
  muted:    'var(--adm-muted)',
  green:    'var(--adm-green)',
  red:      'var(--adm-red)',
} as const;

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  variant?: 'default' | 'primary' | 'success' | 'warning';
  color?: string;
  isLoading?: boolean;
}

// ── Hero card — large, for top-row primary metrics ────────────────────────────
export interface HeroCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  subLabel?: string;
  change?: number;       // % change, positive = up
  todayDelta?: string;   // e.g. "+12 today"
  viewLabel?: string;
  onView?: () => void;
  onMore?: () => void;
  isLoading?: boolean;
  accentColor?: string;
}

export function HeroCard({
  title, value, subValue, subLabel, change, todayDelta, viewLabel, onView, onMore, isLoading, accentColor = C.amber,
}: HeroCardProps) {
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onView?.();
  };
  if (isLoading) {
    return (
      <div style={{
        background: C.surface, border: `2px solid var(--adm-card-border)`,
        boxShadow: 'var(--adm-card-shadow)',
        borderRadius: 16, padding: '24px 26px',
      }}>
        <Skeleton className="h-4 w-28 mb-6" style={{ background: 'var(--adm-skeleton)' }} />
        <Skeleton className="h-10 w-40 mb-3" style={{ background: 'var(--adm-skeleton)' }} />
        <Skeleton className="h-4 w-32 mb-8" style={{ background: 'var(--adm-skeleton)' }} />
        <Skeleton className="h-4 w-24" style={{ background: 'var(--adm-skeleton)' }} />
      </div>
    );
  }

  const isUp = change !== undefined ? change >= 0 : true;

  return (
    <div
      onClick={handleCardClick}
      style={{
        background: C.surface,
        border: `2px solid var(--adm-card-border)`,
        boxShadow: 'var(--adm-card-shadow)',
        borderRadius: 16,
        padding: '24px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.2s ease',
        cursor: onView ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--adm-border-hi)';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = 'var(--adm-hover-shadow)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--adm-card-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--adm-card-shadow)';
      }}
    >
      {/* Subtle glow top-right */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 160, height: 160, borderRadius: '50%',
        background: `${accentColor}`,
        opacity: 0.04, filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onMore?.(); }}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Main value */}
      <div style={{ fontSize: 36, fontWeight: 800, color: C.text, letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 10 }}>
        {value}
      </div>

      {/* Change row */}
      {(change !== undefined || todayDelta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          {change !== undefined && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, fontWeight: 700,
              color: isUp ? C.green : C.red,
              background: isUp ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
              border: `1px solid ${isUp ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
              padding: '2px 8px', borderRadius: 20,
            }}>
              {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(change)}%
            </span>
          )}
          {todayDelta && (
            <span style={{ fontSize: 12, color: C.muted }}>{todayDelta}</span>
          )}
        </div>
      )}

      {/* Sub value row */}
      {subValue && (
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>{subLabel && `${subLabel}: `}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{subValue}</span>
        </div>
      )}

      {/* View link */}
      {viewLabel && (
        <button
          onClick={onView}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', padding: 0,
            fontSize: 12.5, fontWeight: 700, color: accentColor,
            cursor: 'pointer', letterSpacing: '0.01em',
            marginTop: 'auto',
          }}
        >
          {viewLabel} <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

// ── Compact chip card — for secondary metrics row ─────────────────────────────
export interface ChipCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  sub?: string;
  iconColor?: string;
  onMore?: () => void;
  onClick?: () => void;
  isLoading?: boolean;
}

export function ChipCard({ title, value, icon, sub, iconColor = C.amber, onMore, onClick, isLoading }: ChipCardProps) {
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onClick?.();
  };
  if (isLoading) {
    return (
      <div style={{
        background: C.surface, border: `2px solid var(--adm-card-border)`,
        boxShadow: 'var(--adm-card-shadow)',
        borderRadius: 14, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <Skeleton className="h-10 w-10 rounded-xl" style={{ background: 'var(--adm-skeleton)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Skeleton className="h-3 w-20 mb-2" style={{ background: 'var(--adm-skeleton)' }} />
          <Skeleton className="h-6 w-16" style={{ background: 'var(--adm-skeleton)' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleCardClick}
      style={{
        background: C.surface, border: `2px solid var(--adm-card-border)`,
        boxShadow: 'var(--adm-card-shadow)',
        borderRadius: 14, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'relative',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--adm-border-hi)';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = 'var(--adm-hover-shadow)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--adm-card-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--adm-card-shadow)';
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: `${iconColor}18`,
        border: `1px solid ${iconColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
          {title}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>
        )}
      </div>
      {onMore && (
        <button
          onClick={e => { e.stopPropagation(); onMore(); }}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: 'none', border: 'none', color: C.muted,
            cursor: 'pointer', padding: '2px', lineHeight: 1,
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
    </div>
  );
}

// ── Legacy StatsCard — kept for other pages ───────────────────────────────────
export function StatsCard({ title, value, icon, subtitle, trend, isLoading }: StatsCardProps) {
  if (isLoading) {
    return (
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '18px 20px',
      }}>
        <Skeleton className="h-3 w-24 mb-3" style={{ background: 'var(--adm-skeleton)' }} />
        <Skeleton className="h-8 w-32 mb-2" style={{ background: 'var(--adm-skeleton)' }} />
        <Skeleton className="h-3 w-20" style={{ background: 'var(--adm-skeleton)' }} />
      </div>
    );
  }

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.2s ease',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(255,179,0,0.5)';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = 'var(--adm-hover-shadow)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>{title}</span>
        <span style={{ color: C.muted }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>{value}</div>
      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {trend && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: trend.isPositive ? C.green : C.red,
            }}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
          {subtitle && <span style={{ fontSize: 11.5, color: C.muted }}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
