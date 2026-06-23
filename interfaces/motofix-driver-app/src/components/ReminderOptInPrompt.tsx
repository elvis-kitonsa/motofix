// ReminderOptInPrompt.tsx — a one-time prompt asking the driver whether they'd like
// maintenance reminders (and notification permission). Shown once; once answered we
// remember the choice so we don't ask again.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadSettings,
  saveSettings,
  requestNotificationPermission,
  hasSeenReminderPrompt,
  markReminderPromptSeen,
} from '@/lib/reminders';

// One-time, gentle nudge shown on Home for drivers who haven't enabled
// maintenance reminders yet — so the opt-in actually gets discovered instead
// of waiting to be found under the settings gear.
export default function ReminderOptInPrompt() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show only if never prompted and reminders aren't already on.
    if (!hasSeenReminderPrompt() && !loadSettings().enabled) {
      const t = setTimeout(() => setOpen(true), 1200); // let Home settle first
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    markReminderPromptSeen();
    setOpen(false);
  };

  const enable = async () => {
    markReminderPromptSeen();
    const granted = await requestNotificationPermission();
    saveSettings({ ...loadSettings(), enabled: true });
    setOpen(false);
    if (granted) {
      toast.success('Reminders on — you can fine-tune the timing anytime');
    } else {
      toast('Reminders on', {
        description: 'Allow notifications in your browser to also get system pop-ups.',
      });
    }
  };

  const customize = () => {
    markReminderPromptSeen();
    setOpen(false);
    navigate('/reminder-settings');
  };

  if (!open) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'rop-fade 0.2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, background: 'var(--surface-1)',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          border: '1px solid var(--border-2)', borderBottom: 'none',
          padding: '22px 20px calc(24px + env(safe-area-inset-bottom))',
          animation: 'rop-slide 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Grab handle */}
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--surface-4)', margin: '0 auto 18px' }} />

        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', color: 'var(--text-lo)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X style={{ width: 15, height: 15 }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell style={{ width: 22, height: 22, color: '#F59E0B' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 18, lineHeight: 1.15 }}>
              Stay ahead of breakdowns
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: 3 }}>
              Quick safety checks, on a schedule
            </p>
          </div>
        </div>

        <p style={{ color: 'var(--text-md)', fontSize: 13.5, lineHeight: 1.55, marginBottom: 18 }}>
          Turn on reminders and MOTOFIX will nudge you for your daily pre-drive
          checks and a weekly vehicle check-in — so the list comes to you instead
          of waiting to be opened. You choose the times, and can turn it off anytime.
        </p>

        <button
          onClick={enable}
          style={{ width: '100%', padding: '13px 0', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
        >
          Turn on reminders
        </button>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            onClick={customize}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid var(--border-3)', background: 'var(--surface-2)', color: 'var(--text-md)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
          >
            Customize times
          </button>
          <button
            onClick={dismiss}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--text-lo)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
          >
            Not now
          </button>
        </div>
      </div>

      <style>{`
        @keyframes rop-fade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rop-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
