// Notifications.tsx — the notifications inbox screen: lists the alerts collected in
// lib/notifications (job updates, reminders, system messages), newest first, with
// mark-read / clear actions. Separate from the maintenance checklist (Reminders).

import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, Wrench, Trash2, CheckCheck, Settings, CheckCircle2, Car, CreditCard } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/lib/notifications';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* Map a notification to a toast-style status colour + icon (mirrors the in-app
   sonner pop-ups, e.g. the green "OTP sent to your phone" success toast). */
function statusOf(n: AppNotification): { color: string; Icon: typeof Bell } {
  const t = `${n.title} ${n.body ?? ''}`.toLowerCase();
  if (n.kind === 'reminder')                              return { color: '#60A5FA', Icon: Bell };
  if (/paid|payment|momo|disburs/.test(t))                return { color: '#22C55E', Icon: CreditCard };
  if (/complet|confirm|success|approved|done|paid/.test(t)) return { color: '#22C55E', Icon: CheckCircle2 };
  if (/on the way|arrived|en route|dispatch/.test(t))     return { color: '#F59E0B', Icon: Car };
  if (/accept|start/.test(t))                             return { color: '#F59E0B', Icon: Wrench };
  return { color: '#F59E0B', Icon: Wrench };
}

export default function Notifications() {
  const navigate = useNavigate();
  const { items, unread, markRead, markAllRead, remove, clearAll } = useNotifications();

  const open = (n: AppNotification) => {
    markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', paddingBottom: 60 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 52, paddingBottom: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', color: 'var(--text-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft style={{ width: 18, height: 18 }} />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'rgba(245,158,11,0.75)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 2 }}>
              MOTOFIX
            </p>
            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Notifications
            </h1>
          </div>
          <button
            onClick={() => navigate('/reminder-settings')}
            title="Reminder settings"
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', color: 'var(--text-lo)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <Settings style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Actions */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14 }}>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: unread === 0 ? 'var(--text-faint)' : 'var(--text-hi)', fontWeight: 700, fontSize: 13, cursor: unread === 0 ? 'default' : 'pointer' }}
            >
              <CheckCheck style={{ width: 15, height: 15 }} /> Mark all read
            </button>
            <button
              onClick={clearAll}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: 'var(--text-lo)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              <Trash2 style={{ width: 15, height: 15 }} /> Clear
            </button>
          </div>
        )}

        {/* List */}
        {items.length === 0 ? (
          <div style={{ marginTop: 60, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Bell style={{ width: 28, height: 28, color: 'var(--text-faint)' }} />
            </div>
            <p style={{ color: 'var(--text-md)', fontWeight: 700, fontSize: 15 }}>You're all caught up</p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: 4, lineHeight: 1.5, maxWidth: 260, margin: '4px auto 0' }}>
              Updates about your mechanic and maintenance reminders will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: items.length > 0 ? 0 : 14 }}>
            {items.map(n => {
              const { color, Icon } = statusOf(n);
              return (
                <div
                  key={n.id}
                  onClick={() => open(n)}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 40px 14px 14px',
                    borderRadius: 14, cursor: n.link ? 'pointer' : 'default',
                    // Toast-style card: overlay background, hairline border, soft shadow.
                    background: 'var(--overlay-bg)',
                    border: '1px solid var(--border-3)',
                    boxShadow: '0 6px 22px rgba(0,0,0,0.16)',
                    opacity: n.read ? 0.78 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {/* Coloured status icon — like the toast's leading icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: `${color}1f`, border: `1px solid ${color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon style={{ width: 18, height: 18, color }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>{n.title}</p>
                    {n.body && <p style={{ color: 'var(--text-md)', fontSize: 12.5, marginTop: 3, lineHeight: 1.45 }}>{n.body}</p>}
                    <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 6 }}>{timeAgo(n.createdAt)}</p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && <span style={{ position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: '50%', background: color }} />}

                  {/* Delete (appears below the unread dot) */}
                  <button
                    onClick={e => { e.stopPropagation(); remove(n.id); }}
                    style={{ position: 'absolute', bottom: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-ghost)' }}
                    title="Remove"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
