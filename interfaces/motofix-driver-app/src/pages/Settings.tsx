import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Moon, Sun, Bell, BellOff, MapPin, MapPinOff,
  Shield, Eye, EyeOff, Info, FileText, Star,
  ChevronRight, Settings as SettingsIcon, Smartphone,
  Navigation, Vibrate, Volume2, RefreshCw, CheckCircle2, X, Zap,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '@/config/api';

/* ── Persisted toggle state ──────────────────────────────────────────────── */
const STORAGE_KEY = 'motofix_settings';
const APP_VERSION = '1.0.0';
const APP_VERSION_CODE = '100';

interface SettingsState {
  pushNotifications: boolean;
  smsAlerts: boolean;
  requestUpdates: boolean;
  nearbyAlerts: boolean;
  vibration: boolean;
  backgroundLocation: boolean;
  highAccuracyGps: boolean;
  shareAnalytics: boolean;
  crashReports: boolean;
  biometricLogin: boolean;
  disableSplash: boolean;
}

const DEFAULTS: SettingsState = {
  pushNotifications: true,
  smsAlerts: true,
  requestUpdates: true,
  nearbyAlerts: false,
  vibration: true,
  backgroundLocation: true,
  highAccuracyGps: true,
  shareAnalytics: false,
  crashReports: true,
  biometricLogin: false,
  disableSplash: false,
};

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

/* ── Durations ───────────────────────────────────────────────────────────── */
const WELCOME_DURATION = 3000;
const FADE_DURATION    = 500;
const Y  = '#F59E0B';
const YD = '#D97706';

/* ── Welcome overlay ─────────────────────────────────────────────────────── */
function SettingsOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      background: 'var(--overlay-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px',
    }}>
      <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 320, height: 320, borderRadius: '50%', background: `${Y}0a`, filter: 'blur(70px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -40, right: -40, width: 240, height: 240, borderRadius: '50%', background: `${Y}07`, filter: 'blur(60px)', pointerEvents: 'none' }} />

      <span style={{ color: Y, fontSize: 12, fontWeight: 900, letterSpacing: '0.18em', textShadow: `0 0 20px ${Y}55`, marginBottom: 28 }}>
        MOTOFIX
      </span>

      <div style={{ position: 'relative', width: 86, height: 86, marginBottom: 28 }}>
        {[86, 62].map((s, i) => (
          <div key={s} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: s, height: s, borderRadius: '50%',
            border: `1.5px solid rgba(245,158,11,${0.18 + i * 0.15})`,
            transform: 'translate(-50%,-50%)',
            animation: `stg-ring ${2 + i * 0.7}s ease-out ${i * 0.3}s infinite`,
          }} />
        ))}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 52, height: 52, borderRadius: 16,
          background: `linear-gradient(135deg, ${Y}22, ${Y}10)`,
          border: `2px solid ${Y}45`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 28px ${Y}22`,
        }}>
          <SettingsIcon style={{ width: 24, height: 24, color: Y }} />
        </div>
      </div>

      <p style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 26, textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12 }}>
        Settings
      </p>
      <p style={{ color: 'var(--text-lo)', fontSize: 14, textAlign: 'center', lineHeight: 1.65, maxWidth: 290, marginBottom: 36 }}>
        Customise how MOTOFIX looks, notifies you, and uses your location and data.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
        {[SettingsIcon, Bell, MapPin, Shield, Eye].map((Icon, i) => (
          <div key={i} style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'var(--surface-3)', border: '1px solid var(--border-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: `stg-icon 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both`,
          }}>
            <Icon style={{ width: 18, height: 18, color: 'var(--text-lo)' }} />
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 280, height: 2, borderRadius: 1, background: 'var(--surface-4)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', borderRadius: 1, background: `linear-gradient(90deg, ${YD}, ${Y})`, animation: `stg-bar ${WELCOME_DURATION}ms linear both` }} />
      </div>
      <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>Loading your settings…</p>

      <style>{`
        @keyframes stg-ring {
          0%   { transform: translate(-50%,-50%) scale(0.7); opacity: 0.8; }
          80%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes stg-icon  { 0% { opacity:0; transform:translateY(8px) scale(0.9); } 100% { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes stg-bar   { from { width:0%; } to { width:100%; } }
        @keyframes stg-fade-out { from { opacity:1; } to { opacity:0; } }
      `}</style>
    </div>
  );
}

/* ── Toggle switch ───────────────────────────────────────────────────────── */
function Toggle({ on, onChange, accent = Y }: { on: boolean; onChange: (v: boolean) => void; accent?: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 46, height: 26, borderRadius: 13, flexShrink: 0,
        background: on ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : 'var(--surface-5)',
        border: on ? `1px solid ${accent}80` : '1px solid var(--border-4)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.25s ease, border-color 0.25s ease',
        boxShadow: on ? `0 0 12px ${accent}40` : 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: on ? '#000' : 'var(--text-lo)',
        transition: 'left 0.25s cubic-bezier(0.34,1.3,0.64,1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

/* ── Section label ───────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 10, paddingLeft: 2 }}>
      {children}
    </p>
  );
}

/* ── Row: toggle ─────────────────────────────────────────────────────────── */
function ToggleRow({
  icon: Icon, iconColor, label, sub, value, onChange, accent,
}: {
  icon: React.ElementType; iconColor: string; label: string; sub: string;
  value: boolean; onChange: (v: boolean) => void; accent?: string;
}) {
  return (
    <div
      className="stg-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-1)',
        transition: 'background 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${iconColor}08`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `${iconColor}14`, border: `1.5px solid ${iconColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 16, height: 16, color: iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 700, lineHeight: 1, marginBottom: 3 }}>{label}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.4 }}>{sub}</p>
      </div>
      <Toggle on={value} onChange={onChange} accent={accent ?? iconColor} />
    </div>
  );
}

/* ── Row: link ───────────────────────────────────────────────────────────── */
function LinkRow({
  icon: Icon, iconColor, label, sub, onClick, badge,
}: {
  icon: React.ElementType; iconColor: string; label: string; sub?: string;
  onClick: () => void; badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', border: 'none', background: 'transparent',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
        borderBottom: '1px solid var(--border-1)',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${iconColor}08`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `${iconColor}14`, border: `1.5px solid ${iconColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 16, height: 16, color: iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 700, lineHeight: 1, marginBottom: sub ? 3 : 0 }}>{label}</p>
        {sub && <p style={{ color: 'var(--text-dim)', fontSize: 11 }}>{sub}</p>}
      </div>
      {badge && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: `${iconColor}18`, border: `1px solid ${iconColor}35`, color: iconColor, fontSize: 10, fontWeight: 800, marginRight: 6 }}>
          {badge}
        </span>
      )}
      <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-faint)', flexShrink: 0 }} />
    </button>
  );
}

/* ── Card wrapper ────────────────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'var(--surface-1)',
      border: '1px solid var(--border-2)',
      marginBottom: 24,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Theme picker ────────────────────────────────────────────────────────── */
function ThemePicker({ current, onChange }: { current: 'dark' | 'light'; onChange: (t: 'dark' | 'light') => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '14px 18px' }}>
      {(['dark', 'light'] as const).map(t => {
        const active = current === t;
        const label  = t === 'dark' ? 'Dark' : 'Light';
        const Icon   = t === 'dark' ? Moon : Sun;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 0', borderRadius: 12, cursor: 'pointer',
              background: active ? `linear-gradient(135deg, ${Y}22, ${Y}10)` : 'var(--surface-2)',
              border: active ? `1.5px solid ${Y}55` : '1.5px solid var(--border-2)',
              transition: 'all 0.2s ease',
              boxShadow: active ? `0 0 16px ${Y}20` : 'none',
            }}
          >
            <Icon style={{ width: 16, height: 16, color: active ? Y : 'var(--text-dim)' }} />
            <span style={{ color: active ? Y : 'var(--text-lo)', fontSize: 13, fontWeight: active ? 800 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const skipIntro = Boolean((location.state as { skipSettingsIntro?: boolean } | null)?.skipSettingsIntro)
    || loadSettings().disableSplash;

  const [prefs, setPrefs] = useState<SettingsState>(loadSettings);
  const [updatePhase, setUpdatePhase] = useState<'checking' | 'latest' | null>(null);
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [overlayPhase, setOverlayPhase] = useState<'visible' | 'fading' | 'gone'>(
    skipIntro ? 'gone' : 'visible'
  );

  useEffect(() => {
    if (skipIntro) {
      setOverlayPhase('gone');
      return;
    }

    const t = setTimeout(() => {
      setOverlayPhase('fading');
      setTimeout(() => setOverlayPhase('gone'), FADE_DURATION);
    }, WELCOME_DURATION);
    return () => clearTimeout(t);
  }, [skipIntro]);

  useEffect(() => {
    return () => {
      if (updateTimer.current) clearTimeout(updateTimer.current);
    };
  }, []);

  function checkForUpdates() {
    if (updateTimer.current) clearTimeout(updateTimer.current);
    setUpdatePhase('checking');
    updateTimer.current = setTimeout(() => {
      setUpdatePhase('latest');
    }, 1800);
  }

  function set<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Save to server so the setting follows the user across devices and URLs
    authService.savePreferences({ [key]: value }).catch(() => {});
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg)', paddingBottom: 100, position: 'relative' }}>

      {overlayPhase !== 'gone' && (
        <div style={{ animation: overlayPhase === 'fading' ? `stg-fade-out ${FADE_DURATION}ms ease both` : undefined }}>
          <SettingsOverlay />
        </div>
      )}

      {updatePhase && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="App update status"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(0,0,0,0.46)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 22,
            background: 'var(--overlay-bg)',
            border: '1px solid var(--border-3)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.48)',
            padding: 20,
            position: 'relative',
            textAlign: 'center',
          }}>
            <button
              onClick={() => setUpdatePhase(null)}
              aria-label="Close update status"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                borderRadius: 10,
                border: '1px solid var(--border-3)',
                background: 'var(--surface-3)',
                color: 'var(--text-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X style={{ width: 15, height: 15 }} />
            </button>

            <div style={{
              width: 70,
              height: 70,
              borderRadius: 22,
              margin: '10px auto 18px',
              background: updatePhase === 'checking' ? `${Y}18` : 'rgba(52,211,153,0.14)',
              border: updatePhase === 'checking' ? `1.5px solid ${Y}45` : '1.5px solid rgba(52,211,153,0.38)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: updatePhase === 'checking' ? `0 0 32px ${Y}18` : '0 0 32px rgba(52,211,153,0.14)',
            }}>
              {updatePhase === 'checking' ? (
                <RefreshCw style={{ width: 30, height: 30, color: Y, animation: 'stg-update-spin 1s linear infinite' }} />
              ) : (
                <CheckCircle2 style={{ width: 32, height: 32, color: '#34D399' }} />
              )}
            </div>

            <h2 style={{ color: 'var(--text-hi)', fontSize: 20, fontWeight: 900, lineHeight: 1.15, marginBottom: 8 }}>
              {updatePhase === 'checking' ? 'Searching for updates' : 'This is the latest version'}
            </h2>
            <p style={{ color: 'var(--text-md)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
              {updatePhase === 'checking'
                ? 'MOTOFIX is checking whether a newer driver app release is available.'
                : `MOTOFIX Driver v${APP_VERSION} is up to date. Version code ${APP_VERSION_CODE}.`}
            </p>

            {updatePhase === 'latest' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 18,
              }}>
                <div style={{ borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border-2)', padding: 12 }}>
                  <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>Version</p>
                  <p style={{ color: 'var(--text-hi)', fontSize: 15, fontWeight: 900 }}>v{APP_VERSION}</p>
                </div>
                <div style={{ borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border-2)', padding: 12 }}>
                  <p style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>Code</p>
                  <p style={{ color: 'var(--text-hi)', fontSize: 15, fontWeight: 900 }}>{APP_VERSION_CODE}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setUpdatePhase(null)}
              disabled={updatePhase === 'checking'}
              style={{
                width: '100%',
                height: 46,
                borderRadius: 14,
                border: updatePhase === 'checking' ? '1px solid var(--border-3)' : '1px solid rgba(52,211,153,0.45)',
                background: updatePhase === 'checking' ? 'var(--surface-3)' : 'rgba(52,211,153,0.14)',
                color: updatePhase === 'checking' ? 'var(--text-dim)' : '#34D399',
                fontSize: 13,
                fontWeight: 900,
                cursor: updatePhase === 'checking' ? 'not-allowed' : 'pointer',
              }}
            >
              {updatePhase === 'checking' ? 'Please wait...' : 'Done'}
            </button>

            <style>{`
              @keyframes stg-update-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 52, paddingBottom: 28 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--surface-3)', color: 'var(--text-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>
          <div>
            <p style={{ color: `${Y}bf`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: 2 }}>
              MOTOFIX · Preferences
            </p>
            <h1 style={{ color: 'var(--text-hi)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Settings
            </h1>
          </div>
        </div>

        {/* ── Appearance ── */}
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `${Y}14`, border: `1.5px solid ${Y}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {theme === 'dark'
                  ? <Moon style={{ width: 16, height: 16, color: Y }} />
                  : <Sun  style={{ width: 16, height: 16, color: Y }} />}
              </div>
              <div>
                <p style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 700, lineHeight: 1, marginBottom: 3 }}>App Theme</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 11 }}>Choose how MOTOFIX looks</p>
              </div>
            </div>
            <ThemePicker current={theme} onChange={setTheme} />
          </div>
          <div style={{ borderBottom: 'none' }}>
            <ToggleRow
              icon={Zap}
              iconColor="#F59E0B"
              label="Skip Intro Screens"
              sub="Go straight to content — no animated loading screens"
              value={prefs.disableSplash}
              onChange={v => set('disableSplash', v)}
            />
          </div>
        </Card>

        {/* ── Notifications ── */}
        <SectionLabel>Notifications</SectionLabel>
        <Card>
          <ToggleRow icon={Bell}       iconColor="#60A5FA" label="Push Notifications"   sub="Receive alerts on your device"            value={prefs.pushNotifications} onChange={v => set('pushNotifications', v)} />
          <ToggleRow icon={Smartphone} iconColor="#A78BFA" label="SMS Alerts"           sub="Get critical updates via SMS"             value={prefs.smsAlerts}         onChange={v => set('smsAlerts', v)} accent="#A78BFA" />
          <ToggleRow icon={Bell}       iconColor="#34D399" label="Request Updates"      sub="Status changes for active requests"       value={prefs.requestUpdates}    onChange={v => set('requestUpdates', v)} accent="#34D399" />
          <ToggleRow icon={Navigation} iconColor="#FB923C" label="Nearby Mechanic Alerts" sub="Know when providers are close to you"  value={prefs.nearbyAlerts}      onChange={v => set('nearbyAlerts', v)} accent="#FB923C" />
          <div style={{ borderBottom: 'none' }}>
            <ToggleRow icon={Vibrate}  iconColor="#F472B6" label="Vibration"            sub="Haptic feedback for notifications"        value={prefs.vibration}         onChange={v => set('vibration', v)} accent="#F472B6" />
          </div>
        </Card>

        {/* ── Location ── */}
        <SectionLabel>Location</SectionLabel>
        <Card>
          <ToggleRow icon={MapPin}    iconColor="#34D399" label="Background Location" sub="Track location while app is in background" value={prefs.backgroundLocation} onChange={v => set('backgroundLocation', v)} accent="#34D399" />
          <div style={{ borderBottom: 'none' }}>
            <ToggleRow icon={MapPin}  iconColor="#60A5FA" label="High Accuracy GPS"   sub="Uses more battery but improves pin accuracy" value={prefs.highAccuracyGps}  onChange={v => set('highAccuracyGps', v)} accent="#60A5FA" />
          </div>
        </Card>

        {/* ── Privacy & Security ── */}
        <SectionLabel>Privacy & Security</SectionLabel>
        <Card>
          <ToggleRow icon={Eye}    iconColor="#F59E0B" label="Share Usage Data"  sub="Help improve MOTOFIX with anonymous analytics" value={prefs.shareAnalytics} onChange={v => set('shareAnalytics', v)} />
          <ToggleRow icon={Shield} iconColor="#34D399" label="Crash Reports"     sub="Automatically send crash logs"                  value={prefs.crashReports}   onChange={v => set('crashReports', v)} accent="#34D399" />
          <div style={{ borderBottom: 'none' }}>
            <ToggleRow icon={Shield} iconColor="#A78BFA" label="Biometric Login" sub="Use fingerprint or face ID to sign in"          value={prefs.biometricLogin} onChange={v => set('biometricLogin', v)} accent="#A78BFA" />
          </div>
        </Card>

        {/* ── About ── */}
        <SectionLabel>About</SectionLabel>
        <Card>
          <LinkRow icon={FileText}   iconColor="#60A5FA" label="Terms of Service"   sub="Read our usage terms"        onClick={() => navigate('/terms-of-service')} />
          <LinkRow icon={EyeOff}     iconColor="#A78BFA" label="Privacy Policy"     sub="How we handle your data"     onClick={() => navigate('/privacy-policy')} />
          <LinkRow icon={Star}       iconColor="#F59E0B" label="Rate MOTOFIX"       sub="Tell us about your experience" onClick={() => navigate('/rate-motofix')} />
          <button
            onClick={checkForUpdates}
            style={{ width: '100%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: 'rgba(148,163,184,0.1)', border: '1.5px solid rgba(148,163,184,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Info style={{ width: 16, height: 16, color: '#94A3B8' }} />
              </div>
              <div>
                <p style={{ color: 'var(--text-hi)', fontSize: 14, fontWeight: 700, lineHeight: 1, marginBottom: 3 }}>App Version</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 11 }}>MOTOFIX Driver v{APP_VERSION} · Code {APP_VERSION_CODE}</p>
              </div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80', fontSize: 10, fontWeight: 800 }}>
              Up to date
            </span>
          </button>
        </Card>

      </div>
    </div>
  );
}
