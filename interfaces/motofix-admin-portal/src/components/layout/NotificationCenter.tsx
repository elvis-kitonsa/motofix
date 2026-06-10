import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, X, CheckCheck, Wrench, CreditCard, Car, BadgeCheck, AlertCircle, Mail } from 'lucide-react';
import { fetchAdminNotifications, AdminNotification } from '@/lib/api';

const C = {
  surface: 'var(--adm-surface)',
  border:  'var(--adm-divider)',
  amber:   'var(--adm-amber)',
  text:    'var(--adm-text)',
  muted:   'var(--adm-muted)',
} as const;

type NotifType = 'request' | 'payment' | 'provider' | 'driver' | 'system';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  detail: string;
  time: string;
  read: boolean;
}

const TYPE_META: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
  request:  { icon: Wrench,       color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  payment:  { icon: CreditCard,   color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  provider: { icon: BadgeCheck,   color: '#FFB300', bg: 'rgba(255,179,0,0.12)'  },
  driver:   { icon: Car,          color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  system:   { icon: AlertCircle,  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const READ_KEY = 'motofix_admin_notif_read';

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {}
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ n, onOpen, onMarkUnread }: {
  n: Notification;
  onOpen: (n: Notification) => void;
  onMarkUnread: (id: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const meta = TYPE_META[n.type];
  const Icon = meta.icon;

  return (
    <div
      onClick={() => onOpen(n)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 16px',
        background: hov
          ? 'var(--adm-row-hover)'
          : n.read ? 'transparent' : 'var(--adm-amber-dim)',
        borderBottom: '1px solid var(--adm-divider)',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={meta.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: n.read ? 500 : 700,
          color: n.read ? 'var(--adm-muted)' : C.text,
          marginBottom: 2,
        }}>
          {n.title}
        </div>
        <div style={{
          fontSize: 11.5, color: C.muted, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {n.body}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 10.5, color: 'var(--adm-muted)', fontWeight: 500 }}>{n.time}</span>
          {hov && n.read && (
            <button
              onClick={e => { e.stopPropagation(); onMarkUnread(n.id); }}
              style={{
                fontSize: 10, color: C.amber, background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0,
              }}
            >
              Mark unread
            </button>
          )}
        </div>
      </div>

      {!n.read && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: C.amber, flexShrink: 0, marginTop: 5,
        }} />
      )}
    </div>
  );
}

// ── Detail overlay ────────────────────────────────────────────────────────────

function NotifDetail({ n, onClose, onMarkUnread }: {
  n: Notification;
  onClose: () => void;
  onMarkUnread: () => void;
}) {
  const meta = TYPE_META[n.type];
  const Icon = meta.icon;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'nfade 0.2s ease',
      }}
    >
      <style>{`
        @keyframes nfade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nslide { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--adm-popup-bg)',
          border: '1px solid var(--adm-popup-border)',
          borderRadius: 18,
          boxShadow: 'var(--adm-popup-shadow)',
          overflow: 'hidden',
          animation: 'nslide 0.2s ease both',
          margin: '0 16px',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--adm-divider)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: meta.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={17} color={meta.color} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{n.title}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{n.time}</div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'var(--adm-list-hover)',
              border: '1px solid var(--adm-divider)',
              color: C.muted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--adm-list-hover)'; e.currentTarget.style.color = 'var(--adm-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--adm-list-hover)'; e.currentTarget.style.color = 'var(--adm-muted)'; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 22px' }}>
          <p style={{ fontSize: 13.5, color: 'var(--adm-text-sub)', lineHeight: 1.75, margin: 0 }}>
            {n.detail}
          </p>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: meta.color, background: meta.bg,
              border: `1px solid ${meta.color}33`,
              padding: '3px 10px', borderRadius: 20,
              textTransform: 'capitalize',
            }}>
              {n.type}
            </span>

            <button
              onClick={() => { onMarkUnread(); onClose(); }}
              style={{
                fontSize: 11, fontWeight: 600, color: C.amber,
                background: 'rgba(255,179,0,0.08)',
                border: '1px solid rgba(255,179,0,0.22)',
                padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Mail size={11} />
              Mark as unread
            </button>

            <button
              onClick={onClose}
              style={{
                marginLeft: 'auto',
                fontSize: 11, fontWeight: 600, color: C.muted,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--adm-divider)',
                padding: '3px 12px', borderRadius: 20, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function NotificationCenter() {
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState<'unread' | 'all'>('unread');
  const [rawItems, setRawItems] = useState<AdminNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [selected, setSelected] = useState<Notification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    const items = await fetchAdminNotifications(30);
    if (items.length > 0) setRawItems(items);
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const notifications: Notification[] = rawItems.map(n => ({
    id:     n.id,
    type:   n.type,
    title:  n.title,
    body:   n.body,
    detail: n.detail,
    time:   relativeTime(n.created_at),
    read:   readIds.has(n.id),
  }));

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayed   = tab === 'unread' ? notifications.filter(n => !n.read) : notifications;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = () => {
    const next = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(next);
    saveReadIds(next);
  };

  const markRead = (id: string) => {
    const next = new Set([...readIds, id]);
    setReadIds(next);
    saveReadIds(next);
  };

  const markUnread = (id: string) => {
    const next = new Set([...readIds]);
    next.delete(id);
    setReadIds(next);
    saveReadIds(next);
  };

  const openDetail = (n: Notification) => {
    markRead(n.id);
    setSelected({ ...n, read: true });
    setOpen(false);
  };

  return (
    <>
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        {/* Bell button */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: 34, height: 34, borderRadius: 9,
            background: open ? 'var(--adm-icon-hover)' : 'transparent',
            border: `1px solid ${open ? 'var(--adm-popup-border)' : 'transparent'}`,
            color: 'var(--adm-text-sub)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            flexShrink: 0, position: 'relative',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--adm-icon-hover)'; e.currentTarget.style.color = 'var(--adm-text)'; }}
          onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--adm-text-sub)'; } }}
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 18, height: 18, borderRadius: 99,
              background: C.amber,
              border: '2px solid hsl(var(--background))',
              fontSize: 10, fontWeight: 900, color: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: '0 4px',
              pointerEvents: 'none',
              boxShadow: '0 0 8px rgba(255,179,0,0.7)',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: 'absolute', top: 42, right: 0, width: 340,
            background: 'var(--adm-popup-bg)',
            border: '1px solid var(--adm-popup-border)',
            borderRadius: 14,
            boxShadow: 'var(--adm-popup-shadow)',
            overflow: 'hidden',
            animation: 'topbar-drop 0.18s ease both',
            zIndex: 100,
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 16px 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    fontSize: 11, fontWeight: 600, color: C.amber,
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', padding: '8px 16px 0',
              borderBottom: '1px solid var(--adm-divider)',
            }}>
              {(['unread', 'all'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '6px 14px 8px',
                    fontSize: 12, fontWeight: 600,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: tab === t ? C.amber : C.muted,
                    borderBottom: `2px solid ${tab === t ? C.amber : 'transparent'}`,
                    transition: 'color 0.15s, border-color 0.15s',
                    marginBottom: -1,
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'unread'
                    ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`
                    : 'All'}
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ maxHeight: 360, overflowY: 'auto', scrollbarWidth: 'none' }}>
              {displayed.length === 0 ? (
                <div style={{
                  padding: '32px 16px', textAlign: 'center',
                  color: C.muted, fontSize: 13,
                }}>
                  {tab === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </div>
              ) : (
                displayed.map(n => (
                  <NotifRow
                    key={n.id}
                    n={n}
                    onOpen={openDetail}
                    onMarkUnread={markUnread}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <NotifDetail
          n={selected}
          onClose={() => setSelected(null)}
          onMarkUnread={() => markUnread(selected.id)}
        />
      )}
    </>
  );
}
