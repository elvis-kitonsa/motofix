// ActivityLog.tsx — the audit trail screen: a chronological log of what's happened on the
// platform (logins, approvals, changes), so admins can see who did what and when.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { fetchActivityLog, ActivityLogEntry } from '@/lib/api';
import {
  ArrowLeft, Search, Filter, CheckCircle, Shield,
  User, LogIn, CreditCard, Wrench, BadgeCheck,
  Settings, Trash2, AlertTriangle,
  Car, Download, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

const C = {
  surface:  'var(--adm-surface)',
  surface2: 'var(--adm-surface-2)',
  border:   'var(--adm-border)',
  amber:    'var(--adm-amber)',
  amberDim: 'var(--adm-amber-dim)',
  text:     'var(--adm-text)',
  muted:    'var(--adm-muted)',
} as const;

type Category = 'all' | 'auth' | 'request' | 'payment' | 'provider' | 'driver' | 'system' | 'account';

interface LogEntry {
  id: string;
  category: Exclude<Category, 'all'>;
  action: string;
  detail: string;
  admin: string;
  timestamp: string;
  status: 'success' | 'warning' | 'danger';
}

const CAT_META: Record<Exclude<Category, 'all'>, { label: string; icon: React.ElementType; color: string }> = {
  auth:     { label: 'Auth',     icon: LogIn,       color: '#60a5fa' },
  request:  { label: 'Request',  icon: Wrench,      color: '#818cf8' },
  payment:  { label: 'Payment',  icon: CreditCard,  color: '#34d399' },
  provider: { label: 'Provider', icon: BadgeCheck,  color: '#FFB300' },
  driver:   { label: 'Driver',   icon: Car,         color: '#f59e0b' },
  system:   { label: 'System',   icon: Settings,    color: '#94a3b8' },
  account:  { label: 'Account',  icon: User,        color: '#c084fc' },
};

const STATUS_META = {
  success: { label: 'Success', color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  warning: { label: 'Warning', color: '#FFB300', bg: 'rgba(255,179,0,0.1)'  },
  danger:  { label: 'Failed',  color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'auth',     label: 'Auth'     },
  { key: 'request',  label: 'Requests' },
  { key: 'payment',  label: 'Payments' },
  { key: 'provider', label: 'Providers'},
  { key: 'driver',   label: 'Drivers'  },
  { key: 'system',   label: 'System'   },
  { key: 'account',  label: 'Account'  },
];

const AUTH_EVENTS    = new Set(['admin_login', 'admin_login_failed', 'user_logout', 'user_registered', 'otp_verified', 'otp_failed', 'otp_resent', 'token_refreshed', 'provider_login', 'provider_login_failed']);
const PROVIDER_EVENTS = new Set(['provider_approved', 'provider_rejected', 'provider_deleted', 'provider_created_by_admin', 'provider_credentials_reset', 'provider_registered', 'provider_banned', 'provider_unbanned', 'application_reopened']);
const ACCOUNT_EVENTS  = new Set(['admin_registered', 'admin_deleted', 'admin_profile_updated', 'admin_password_changed']);
const SYSTEM_EVENTS   = new Set(['platform_fees_updated', 'maintenance_scheduled', 'maintenance_ended']);

const ACTION_MAP: Record<string, string> = {
  admin_login:                  'Admin login',
  admin_login_failed:           'Failed login attempt',
  user_logout:                  'Admin logout',
  user_registered:              'User registered',
  otp_verified:                 'OTP verified',
  otp_failed:                   'OTP failed',
  otp_resent:                   'OTP resent',
  token_refreshed:              'Token refreshed',
  provider_login:               'Provider login',
  provider_login_failed:        'Provider login failed',
  provider_approved:            'Approved provider application',
  provider_rejected:            'Rejected provider application',
  provider_deleted:             'Deleted provider account',
  provider_created_by_admin:    'Created provider account',
  provider_credentials_reset:   'Reset provider credentials',
  provider_registered:          'Provider registered',
  provider_banned:              'Banned provider',
  provider_unbanned:            'Unbanned provider',
  application_reopened:         'Re-opened application',
  admin_registered:             'Registered admin account',
  admin_deleted:                'Deleted admin account',
  admin_profile_updated:        'Updated admin profile',
  admin_password_changed:       'Changed admin password',
  platform_fees_updated:        'Updated platform fees',
  maintenance_scheduled:        'Scheduled maintenance',
  maintenance_ended:            'Ended maintenance mode',
};

function mapEntry(e: ActivityLogEntry): LogEntry {
  let category: Exclude<Category, 'all'> = 'system';
  if (AUTH_EVENTS.has(e.event_type))     category = 'auth';
  else if (PROVIDER_EVENTS.has(e.event_type)) category = 'provider';
  else if (ACCOUNT_EVENTS.has(e.event_type))  category = 'account';
  else if (SYSTEM_EVENTS.has(e.event_type))   category = 'system';

  const et = e.event_type;
  let status: 'success' | 'warning' | 'danger' = 'success';
  if (et.includes('failed') || et.includes('rejected') || et.includes('banned') || et === 'provider_deleted') {
    status = 'danger';
  } else if (et.includes('reset') || et.includes('maintenance') || et.includes('fees') || et === 'application_reopened') {
    status = 'warning';
  }

  const action = ACTION_MAP[et] || et.replace(/_/g, ' ');
  const ts = e.created_at ? format(new Date(e.created_at), 'd MMM yyyy, HH:mm') : '—';

  return {
    id: String(e.id),
    category,
    action,
    detail: e.description,
    admin: e.admin_name,
    timestamp: ts,
    status,
  };
}

function actionIcon(category: Exclude<Category, 'all'>, status: LogEntry['status']) {
  const meta = CAT_META[category];
  const Icon = meta.icon;
  const statusColor = STATUS_META[status].color;
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
      background: `${meta.color}15`,
      border: `1px solid ${meta.color}25`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <Icon size={15} color={meta.color} />
      <span style={{
        position: 'absolute', bottom: -2, right: -2,
        width: 10, height: 10, borderRadius: '50%',
        background: statusColor,
        border: '2px solid var(--adm-surface)',
      }} />
    </div>
  );
}

export default function ActivityLog() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch]     = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['activity-log'],
    queryFn:  () => fetchActivityLog({ pageSize: 200 }),
    staleTime: 30000,
  });

  const allLogs: LogEntry[] = useMemo(
    () => (data?.data ?? []).map(mapEntry),
    [data],
  );

  const filtered = useMemo(() => {
    return allLogs.filter(l => {
      const matchCat = category === 'all' || l.category === category;
      const q = search.toLowerCase();
      const matchSearch = !q || l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allLogs, category, search]);

  const counts = useMemo(() => ({
    total:   allLogs.length,
    success: allLogs.filter(l => l.status === 'success').length,
    warning: allLogs.filter(l => l.status === 'warning').length,
    danger:  allLogs.filter(l => l.status === 'danger').length,
  }), [allLogs]);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: C.muted,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.amber}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <div style={{ width: 1, height: 18, background: C.border }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Activity Log</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Full audit trail of all admin actions</div>
          </div>
        </div>

        {/* Summary chips */}
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading activity log…
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Total Events',  value: counts.total,   color: C.amber,   bg: C.amberDim,                  icon: Filter        },
              { label: 'Successful',    value: counts.success, color: '#34d399', bg: 'rgba(52,211,153,0.08)',      icon: CheckCircle   },
              { label: 'Warnings',      value: counts.warning, color: '#FFB300', bg: 'rgba(255,179,0,0.08)',      icon: AlertTriangle },
              { label: 'Failed',        value: counts.danger,  color: '#f87171', bg: 'rgba(248,113,113,0.08)',     icon: Shield        },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '14px 18px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <s.icon size={15} color={s.color} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Log card */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, overflow: 'hidden',
        }}>
          {/* Toolbar */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: searchFocused ? 'var(--adm-search-focus)' : C.surface2,
              border: `1px solid ${searchFocused ? 'rgba(255,179,0,0.35)' : C.border}`,
              borderRadius: 9, padding: '0 12px', height: 36,
              flex: 1, maxWidth: 320,
              transition: 'border-color 0.15s, background 0.15s',
              boxShadow: searchFocused ? '0 0 0 3px rgba(255,179,0,0.1)' : 'none',
            }}>
              <Search size={13} color={searchFocused ? C.amber : C.muted} />
              <input
                type="text"
                placeholder="Search actions…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: C.text, fontSize: 12.5, width: '100%', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Category filter pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  style={{
                    fontSize: 11.5, fontWeight: 600,
                    padding: '5px 13px', borderRadius: 20,
                    cursor: 'pointer', border: 'none',
                    background: category === c.key ? C.amber : C.surface2,
                    color: category === c.key ? '#000' : C.muted,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Export */}
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, color: C.muted,
              background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
              flexShrink: 0,
            }}>
              <Download size={13} />
              Export
            </button>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '38px 1fr 130px 160px 130px',
            gap: 12,
            padding: '10px 20px',
            background: 'var(--adm-surface-2)',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {['', 'Action', 'Category', 'Timestamp', 'Status'].map((h, i) => (
              <span key={i} style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: 520, overflowY: 'auto', scrollbarWidth: 'none' }}>
            {isLoading ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: C.muted, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                No activity matches your filters
              </div>
            ) : filtered.map((log, i) => {
              const cat    = CAT_META[log.category];
              const statusMeta = STATUS_META[log.status];
              return (
                <div
                  key={log.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '38px 1fr 130px 160px 130px',
                    gap: 12, alignItems: 'center',
                    padding: '13px 20px',
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--adm-row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Icon */}
                  {actionIcon(log.category, log.status)}

                  {/* Action + detail */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{log.action}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.detail}</div>
                  </div>

                  {/* Category badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: cat.color, background: `${cat.color}15`,
                    border: `1px solid ${cat.color}30`,
                    padding: '3px 10px', borderRadius: 20,
                    width: 'fit-content',
                  }}>
                    {cat.label}
                  </span>

                  {/* Timestamp */}
                  <span style={{ fontSize: 11.5, color: C.muted }}>{log.timestamp}</span>

                  {/* Status */}
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: statusMeta.color, background: statusMeta.bg,
                    padding: '3px 10px', borderRadius: 20,
                    width: 'fit-content',
                  }}>
                    {statusMeta.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px',
            borderTop: `1px solid ${C.border}`,
            fontSize: 12, color: C.muted,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Showing {filtered.length} of {allLogs.length} events</span>
            <span>Last updated: just now</span>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
