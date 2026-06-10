import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, BellOff, Sun, CalendarDays, Send, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  SECTIONS,
  WEEKDAYS,
  loadSettings,
  saveSettings,
  requestNotificationPermission,
  type ReminderSettings,
} from '@/lib/reminders';
import { addNotification } from '@/lib/notifications';

/* ─── Tiny inline toggle ─── */
function Toggle({ on, onClick, accent = '#F59E0B' }: { on: boolean; onClick: () => void; accent?: string }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{
        width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? accent : 'var(--surface-4)', position: 'relative', flexShrink: 0,
        transition: 'background 0.2s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-3)', border: '1px solid var(--border-3)', borderRadius: 10,
  padding: '8px 10px', color: 'var(--text-hi)', fontSize: 13, fontWeight: 600, outline: 'none',
};

export default function ReminderSettings() {
  const navigate = useNavigate();
  const [s, setS] = useState<ReminderSettings>(() => loadSettings());
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  // Persist on every change so the scheduler & checklist pick it up live.
  useEffect(() => { saveSettings(s); }, [s]);

  const update = (patch: Partial<ReminderSettings>) => setS(prev => ({ ...prev, ...patch }));

  const toggleMaster = async () => {
    if (!s.enabled) {
      const granted = await requestNotificationPermission();
      setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
      update({ enabled: true });
      if (!granted) {
        toast('Reminders are on, but notifications are blocked', {
          description: 'Allow notifications in your browser to get nudged even when the app is in the background.',
        });
      }
    } else {
      update({ enabled: false });
    }
  };

  const toggleSection = (key: string) => {
    const muted = s.mutedSections.includes(key)
      ? s.mutedSections.filter(k => k !== key)
      : [...s.mutedSections, key];
    update({ mutedSections: muted });
  };

  const sendTest = async () => {
    const granted = await requestNotificationPermission();
    setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
    addNotification({
      kind: 'reminder',
      title: '🔔 Test reminder',
      body: 'This is how your maintenance nudges will appear.',
      link: '/reminders',
    });
    if (granted && typeof Notification !== 'undefined') {
      new Notification('🔔 MOTOFIX test reminder', {
        body: 'This is how your maintenance nudges will appear.',
      });
      toast.success('Test sent — check your notifications');
    } else {
      toast.success('Added to your in-app notifications');
    }
  };

  const disabled = !s.enabled;

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
              MOTOFIX · Reminders
            </p>
            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Reminder Settings
            </h1>
          </div>
        </div>

        {/* Master toggle */}
        <div style={{ marginTop: 20, background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: s.enabled ? 'rgba(245,158,11,0.16)' : 'var(--surface-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {s.enabled ? <Bell style={{ width: 20, height: 20, color: '#F59E0B' }} /> : <BellOff style={{ width: 20, height: 20, color: 'var(--text-faint)' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--text-hi)', fontWeight: 800, fontSize: 15 }}>Maintenance reminders</p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
              Get nudged to run your safety checks instead of remembering on your own.
            </p>
          </div>
          <Toggle on={s.enabled} onClick={toggleMaster} />
        </div>

        {/* Permission hint */}
        {s.enabled && perm !== 'granted' && (
          <div style={{ marginTop: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '11px 14px', display: 'flex', gap: 10 }}>
            <Info style={{ width: 16, height: 16, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: 'var(--text-md)', fontSize: 12, lineHeight: 1.5 }}>
              {perm === 'denied'
                ? 'Notifications are blocked for this site. You\'ll still see reminders inside the app, but to get system pop-ups, enable notifications in your browser settings.'
                : 'Allow notifications when prompted so reminders can reach you even when the app is in the background.'}
            </p>
          </div>
        )}

        {/* Daily pre-drive */}
        <div style={{ marginTop: 22, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', transition: 'opacity 0.2s ease' }}>
          <p style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700, marginBottom: 10 }}>
            Schedule
          </p>

          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'rgba(245,158,11,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sun style={{ width: 18, height: 18, color: '#F59E0B' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 14 }}>Daily pre-drive check</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 1 }}>A morning nudge for the 2-minute checks</p>
              </div>
              <Toggle on={s.daily.enabled} onClick={() => update({ daily: { ...s.daily, enabled: !s.daily.enabled } })} />
            </div>
            {s.daily.enabled && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-1)' }}>
                <span style={{ color: 'var(--text-md)', fontSize: 13, fontWeight: 600 }}>Remind me at</span>
                <input
                  type="time"
                  value={s.daily.time}
                  onChange={e => update({ daily: { ...s.daily, time: e.target.value } })}
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Weekly check-in */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-2)', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'rgba(96,165,250,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarDays style={{ width: 18, height: 18, color: '#60A5FA' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 14 }}>Weekly check-in</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 1 }}>A summary of what's still due this week</p>
              </div>
              <Toggle on={s.weekly.enabled} accent="#60A5FA" onClick={() => update({ weekly: { ...s.weekly, enabled: !s.weekly.enabled } })} />
            </div>
            {s.weekly.enabled && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-md)', fontSize: 13, fontWeight: 600 }}>Day</span>
                  <select
                    value={s.weekly.day}
                    onChange={e => update({ weekly: { ...s.weekly, day: Number(e.target.value) } })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {WEEKDAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-md)', fontSize: 13, fontWeight: 600 }}>Time</span>
                  <input
                    type="time"
                    value={s.weekly.time}
                    onChange={e => update({ weekly: { ...s.weekly, time: e.target.value } })}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mute categories */}
        <div style={{ marginTop: 22, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', transition: 'opacity 0.2s ease' }}>
          <p style={{ color: 'var(--text-md)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700, marginBottom: 4 }}>
            Categories
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
            Turn off any list you don't want to see or be reminded about.
          </p>
          <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface-1)', border: '1px solid var(--border-2)' }}>
            {SECTIONS.map((sec, idx) => {
              const on = !s.mutedSections.includes(sec.key);
              return (
                <div
                  key={sec.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: idx < SECTIONS.length - 1 ? '1px solid var(--border-1)' : 'none' }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{sec.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-hi)', fontWeight: 700, fontSize: 13.5 }}>{sec.label}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 1 }}>{sec.items.length} items</p>
                  </div>
                  <Toggle on={on} accent={sec.accent} onClick={() => toggleSection(sec.key)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Test + note */}
        <button
          onClick={sendTest}
          style={{ marginTop: 22, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: 'var(--text-hi)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          <Send style={{ width: 15, height: 15 }} /> Send a test reminder
        </button>

        <p style={{ color: 'var(--text-faint)', fontSize: 11, textAlign: 'center', lineHeight: 1.6, marginTop: 18, padding: '0 12px' }}>
          Reminders are delivered while MOTOFIX is open or running in the background.
          For nudges when the app is fully closed, install MOTOFIX to your home screen.
        </p>
      </div>
    </div>
  );
}
